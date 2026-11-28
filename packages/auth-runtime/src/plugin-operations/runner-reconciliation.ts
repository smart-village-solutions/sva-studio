import { randomUUID } from 'node:crypto';
import { metrics } from '@opentelemetry/api';
import { createSdkLogger } from '@sva/server-runtime';

import { listActiveInstanceIdsForWorker } from '../iam-instance-registry/repository.js';
import {
  listStudioJobReconciliationCandidates,
  withStudioJobReconciliationCandidate,
} from './repository.js';
import {
  getRegisteredStudioJobExecutionRegistry,
  privilegedStudioJobTaskIdentifier,
  studioJobTaskIdentifier,
  toRegistryKey,
} from './runner-internal.js';

const batchSize = 25;
const logger = createSdkLogger({ component: 'studio-job-reconciliation' });
const meter = metrics.getMeter('sva.studio-job-reconciliation');
const observations = meter.createObservableGauge('sva_studio_job_reconciliation_jobs');
const lastSuccessfulRound = meter.createObservableGauge(
  'sva_studio_job_reconciliation_last_success_timestamp_seconds'
);

export const reconcileStudioJob = (instanceId: string, jobId: string) => {
  let confirmed = false;
  return withStudioJobReconciliationCandidate(
    instanceId,
    jobId,
    async (job, repository, lockQueue) => {
      const registration = getRegisteredStudioJobExecutionRegistry().get(
        toRegistryKey(job.source, job.jobTypeId)
      );
      if (!registration) return 'unknown';

      const taskIdentifier =
        registration.executionLane === 'privileged'
          ? privilegedStudioJobTaskIdentifier
          : studioJobTaskIdentifier;
      const exhausted = await lockQueue(taskIdentifier);
      if (exhausted === null) return 'unknown';
      if (!exhausted) return 'available';
      confirmed = true;

      const cancelledBeforeStart =
        job.status === 'queued' && job.attempts === 0 && !job.startedAt && !!job.cancelRequestedAt;
      const status = cancelledBeforeStart ? 'cancelled' : 'failed';
      const errorCode = 'studio_job_execution_abandoned';
      const finishedAt = new Date().toISOString();
      const transition = await repository.transitionJobStateAndAppendEvent({
        jobId: job.id,
        instanceId: job.instanceId,
        status,
        attempts: job.attempts,
        startedAt: job.startedAt,
        finishedAt,
        progress: job.progress,
        workerId: job.workerId,
        heartbeatAt: job.heartbeatAt,
        ...(cancelledBeforeStart
          ? {}
          : { errorPayload: { code: errorCode, category: 'permanent' } }),
        expectedStatuses: [job.status],
        expectedAttempts: job.attempts,
        expectedWorkerId: job.workerId ?? null,
        leasePredicate: { kind: 'expiredOwner' },
        event: {
          id: randomUUID(),
          jobId: job.id,
          instanceId: job.instanceId,
          status,
          attempts: job.attempts,
          progress: job.progress,
          eventType: cancelledBeforeStart ? 'job.cancelled' : 'job.failed',
          message: cancelledBeforeStart ? undefined : errorCode,
          details: {
            host: {
              ...(cancelledBeforeStart ? {} : { errorCode, errorCategory: 'permanent' }),
              cancellationRequestedAt: job.cancelRequestedAt,
            },
          },
        },
      });
      return transition.outcome === 'conflict' ? 'unresolved' : 'finalized';
    }
  ).catch((error: unknown) => {
    if (!confirmed) throw error;
    return 'unresolved' as const;
  });
};

const emptyCounts = () => ({ confirmed: 0, finalized: 0, unresolved: 0, unknown: 0 });
let latest: { counts: ReturnType<typeof emptyCounts>; lastSuccess: number } | undefined;

type InstanceScan = {
  readonly afterId?: string;
  readonly pending: Partial<Record<'unresolved' | 'unknown', string>>;
};

const observeJob = (instanceId: string, id: string) =>
  reconcileStudioJob(instanceId, id).catch(() => 'unknown' as const);

const reconcileInstanceJobs = async (
  instanceId: string,
  scan: InstanceScan | undefined,
  counts: ReturnType<typeof emptyCounts>
): Promise<InstanceScan> => {
  // Recheck one representative of each outstanding outcome within the page budget.
  const outstanding = scan ? Object.values(scan.pending) : [];
  const pageSize = batchSize - outstanding.length;
  const ids = await listStudioJobReconciliationCandidates(
    instanceId,
    scan?.afterId ?? null,
    pageSize
  );
  const pending: InstanceScan['pending'] = {};
  for (const id of new Set([...outstanding, ...ids])) {
    const outcome = await observeJob(instanceId, id);
    if (outcome && outcome !== 'available') counts[outcome]++;
    if (outcome === 'unknown' || outcome === 'unresolved') {
      pending[outcome] ??= id;
    }
  }
  return {
    afterId: ids.length === pageSize ? ids[ids.length - 1] : undefined,
    pending,
  };
};

observations.addCallback((result) => {
  if (!latest) return;
  for (const [outcome, count] of Object.entries(latest.counts)) {
    result.observe(count, { outcome });
  }
});
lastSuccessfulRound.addCallback((result) => {
  if (latest) result.observe(latest.lastSuccess);
});

export const createStudioJobReconciliation = () => {
  const scans = new Map<string, InstanceScan>();
  let running = false;
  return async (): Promise<void> => {
    if (running) return;
    running = true;
    const counts = emptyCounts();
    let observationOk = true;
    try {
      const instanceIds = await listActiveInstanceIdsForWorker();
      const activeInstances = new Set(instanceIds);
      for (const instanceId of scans.keys()) {
        if (!activeInstances.has(instanceId)) scans.delete(instanceId);
      }
      for (const instanceId of instanceIds) {
        try {
          scans.set(
            instanceId,
            await reconcileInstanceJobs(instanceId, scans.get(instanceId), counts)
          );
        } catch {
          observationOk = false;
        }
      }
    } catch {
      observationOk = false;
    } finally {
      observationOk &&= counts.unknown === 0;
      counts.confirmed = counts.finalized + counts.unresolved;
      latest = {
        counts,
        lastSuccess: observationOk ? Math.floor(Date.now() / 1000) : (latest?.lastSuccess ?? 0),
      };
      running = false;
    }
    const metadata = {
      operation: 'studio_job_reconciliation',
      observation_ok: observationOk,
      ...counts,
    };
    if (!observationOk || counts.unresolved > 0) {
      logger.warn('studio_job_reconciliation', metadata);
    } else if (counts.confirmed > 0) {
      logger.info('studio_job_reconciliation', metadata);
    }
  };
};
