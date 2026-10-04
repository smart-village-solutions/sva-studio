import {
  collectDsrExportPayload,
  serializeDsrExportPayload,
} from '@sva/iam-governance/dsr-export-payload';
import { createPoolResolver, type QueryClient, withResolvedInstanceDb } from '../db.js';
import { getIamDatabaseUrl } from '../runtime-secrets.js';
import type { StudioJobExecutionRegistration } from '../plugin-operations/runner.js';
import {
  resolveAccountById,
  loadExportJob,
  claimQueuedExportJob,
} from './export-worker-persistence.js';

const resolvePool = createPoolResolver(getIamDatabaseUrl);

const withInstanceScopedDb = async <T>(
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
): Promise<T> => withResolvedInstanceDb(resolvePool, instanceId, work);

export const processDsrExportJob = async (
  job: Parameters<StudioJobExecutionRegistration['handler']>[0]['job'],
  progressReporter: Parameters<StudioJobExecutionRegistration['handler']>[0]['progressReporter'],
  exportJobId: string
): Promise<boolean> => {
  const maybeCompleted = await withInstanceScopedDb(job.instanceId, async (client) => {
    const currentJob = await loadExportJob(client, {
      instanceId: job.instanceId,
      exportJobId,
    });
    if (!currentJob) {
      throw new Error('export_job_not_found');
    }
    if (currentJob.status === 'completed') {
      return { alreadyCompleted: true };
    }

    const claimed =
      currentJob.status === 'queued'
        ? await claimQueuedExportJob(client, {
            instanceId: job.instanceId,
            exportJobId,
          })
        : currentJob;
    if (!claimed) {
      return { alreadyCompleted: true };
    }

    await progressReporter.reportProgress({
      jobId: job.id,
      instanceId: job.instanceId,
      progress: {
        completedSteps: 1,
        totalSteps: 3,
        currentPhase: 'ingestion',
        currentStepKey: 'load-account',
      },
    });

    const account = await resolveAccountById(client, {
      instanceId: job.instanceId,
      accountId: claimed.target_account_id,
    });
    if (!account) {
      throw new Error('target_account_not_found');
    }

    const payload = await collectDsrExportPayload(client, {
      instanceId: job.instanceId,
      account,
      format: claimed.format,
    });

    await progressReporter.reportProgress({
      jobId: job.id,
      instanceId: job.instanceId,
      progress: {
        completedSteps: 2,
        totalSteps: 3,
        currentPhase: 'commit',
        currentStepKey: 'persist-export',
      },
    });

    await client.query(
      `
UPDATE iam.data_subject_export_jobs
SET
  status = 'completed',
  completed_at = NOW(),
  payload_json = $3::jsonb,
  payload_csv = $4,
  payload_xml = $5,
  error_message = NULL
WHERE instance_id = $1
  AND id = $2::uuid;
`,
      [
        job.instanceId,
        exportJobId,
        JSON.stringify(payload),
        serializeDsrExportPayload('csv', payload),
        serializeDsrExportPayload('xml', payload),
      ]
    );

    return { alreadyCompleted: false };
  });

  return maybeCompleted.alreadyCompleted;
};

export { withInstanceScopedDb };
