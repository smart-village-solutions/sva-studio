import { getWorkspaceContext } from '@sva/server-runtime';
import {
  collectDsrExportPayload,
  serializeDsrExportPayload,
  type DsrExportAccountSnapshot,
  type DsrExportFormat,
} from '@sva/iam-governance/dsr-export-payload';

import { createPoolResolver, type QueryClient, withResolvedInstanceDb } from '../db.js';
import { getIamDatabaseUrl } from '../runtime-secrets.js';
import { createStudioJob, markStudioJobEnqueueFailed } from '../plugin-operations/core.shared.js';
import {
  queueStudioJob,
  type StudioJobExecutionRegistration,
} from '../plugin-operations/runner.js';

const resolvePool = createPoolResolver(getIamDatabaseUrl);

const withInstanceScopedDb = async <T>(
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
): Promise<T> => withResolvedInstanceDb(resolvePool, instanceId, work);

export const dsrExportStudioJobTypeId = 'dsr.export';

type DsrExportJobRow = {
  readonly id: string;
  readonly target_account_id: string;
  readonly format: DsrExportFormat;
  readonly status: 'queued' | 'processing' | 'completed' | 'failed';
};

const resolveAccountById = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
): Promise<DsrExportAccountSnapshot | undefined> => {
  const query = await client.query<DsrExportAccountSnapshot>(
    `
SELECT
  a.id,
  a.keycloak_subject,
  a.email_ciphertext,
  a.display_name_ciphertext,
  a.is_blocked,
  a.soft_deleted_at,
  a.delete_after,
  a.permanently_deleted_at,
  a.processing_restricted_at,
  a.processing_restriction_reason,
  a.non_essential_processing_opt_out_at,
  a.created_at,
  a.updated_at
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1
WHERE a.id = $2::uuid
LIMIT 1;
`,
    [input.instanceId, input.accountId]
  );

  return query.rowCount > 0 ? query.rows[0] : undefined;
};

const loadExportJob = async (
  client: QueryClient,
  input: { instanceId: string; exportJobId: string }
): Promise<DsrExportJobRow | undefined> => {
  const result = await client.query<DsrExportJobRow>(
    `
SELECT id, target_account_id, format, status
FROM iam.data_subject_export_jobs
WHERE instance_id = $1
  AND id = $2::uuid
LIMIT 1;
`,
    [input.instanceId, input.exportJobId]
  );

  return result.rowCount > 0 ? result.rows[0] : undefined;
};

const claimQueuedExportJob = async (
  client: QueryClient,
  input: { instanceId: string; exportJobId: string }
): Promise<DsrExportJobRow | undefined> => {
  const result = await client.query<DsrExportJobRow>(
    `
UPDATE iam.data_subject_export_jobs
SET
  status = 'processing',
  started_at = COALESCE(started_at, NOW()),
  error_message = NULL
WHERE instance_id = $1
  AND id = $2::uuid
  AND status = 'queued'
RETURNING id, target_account_id, format, status;
`,
    [input.instanceId, input.exportJobId]
  );

  return result.rowCount > 0 ? result.rows[0] : undefined;
};

const markExportJobFailed = async (
  client: QueryClient,
  input: { instanceId: string; exportJobId: string; errorMessage: string }
): Promise<void> => {
  await client.query(
    `
UPDATE iam.data_subject_export_jobs
SET
  status = 'failed',
  completed_at = NOW(),
  error_message = $3
WHERE instance_id = $1
  AND id = $2::uuid;
`,
    [input.instanceId, input.exportJobId, input.errorMessage]
  );
};

export const createAndQueueDsrExportStudioJob = async (input: {
  instanceId: string;
  exportJobId: string;
  requestedByAccountId: string;
  targetAccountId: string;
  format: DsrExportFormat;
}): Promise<{ id: string }> => {
  const job = await createStudioJob({
    instanceId: input.instanceId,
    initialProgress: {
      completedSteps: 0,
      totalSteps: 3,
      currentPhase: 'ingestion',
      currentStepKey: 'prepare-export',
    },
    create: {
      source: 'host',
      pluginId: undefined,
      jobTypeId: dsrExportStudioJobTypeId,
      queueName: 'host-operations',
      inputPayload: {
        exportJobId: input.exportJobId,
        targetAccountId: input.targetAccountId,
        format: input.format,
      },
      maxAttempts: 3,
      idempotencyKey: `dsr-export:${input.exportJobId}`,
      requestId: getWorkspaceContext().requestId ?? undefined,
      actorAccountId: input.requestedByAccountId,
      correlationId: input.exportJobId,
      scheduledAt: new Date().toISOString(),
    },
  });

  try {
    await queueStudioJob({
      instanceId: input.instanceId,
      jobId: job.id,
      queueName: job.queueName,
      maxAttempts: job.maxAttempts,
    });
  } catch (error) {
    await markStudioJobEnqueueFailed({
      instanceId: input.instanceId,
      job,
      errorCode: 'studio_job_enqueue_failed',
    });
    throw error;
  }

  return { id: job.id };
};

export const dsrExportStudioJobRegistration: StudioJobExecutionRegistration = {
  source: 'host',
  jobTypeId: dsrExportStudioJobTypeId,
  queueName: 'host-operations',
  handler: async ({ job, progressReporter }) => {
    const exportJobId = typeof job.inputPayload.exportJobId === 'string' ? job.inputPayload.exportJobId : '';
    if (!exportJobId) {
      throw new Error('export_job_id_missing');
    }

    try {
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

        const claimed = currentJob.status === 'queued'
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

      if (maybeCompleted.alreadyCompleted) {
        return {
          progress: {
            completedSteps: 3,
            totalSteps: 3,
            currentPhase: 'completed',
            currentStepKey: 'already-finished',
          },
          resultPayload: {
            summary: {
              processedItems: 1,
            },
          },
        };
      }
    } catch (error) {
      await withInstanceScopedDb(job.instanceId, async (client) => {
        await markExportJobFailed(client, {
          instanceId: job.instanceId,
          exportJobId,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }).catch(() => undefined);
      throw error;
    }

    await progressReporter.reportProgress({
      jobId: job.id,
      instanceId: job.instanceId,
      progress: {
        completedSteps: 3,
        totalSteps: 3,
        currentPhase: 'completed',
        currentStepKey: 'export-ready',
      },
    });

    return {
      progress: {
        completedSteps: 3,
        totalSteps: 3,
        currentPhase: 'completed',
        currentStepKey: 'export-ready',
      },
      resultPayload: {
        summary: {
          processedItems: 1,
          acceptedItems: 1,
        },
      },
    };
  },
};
