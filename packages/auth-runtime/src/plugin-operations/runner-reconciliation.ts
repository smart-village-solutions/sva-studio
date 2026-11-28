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

const reconcileInstanceJobs = async (
  instanceId: string,
  afterId: string | null,
  counts: ReturnType<typeof emptyCounts>
) => {
  const ids = await listStudioJobReconciliationCandidates(instanceId, afterId, batchSize);
  let observationOk = true;
  for (const id of ids) {
    try {
      const outcome = await reconcileStudioJob(instanceId, id);
      if (outcome && outcome !== 'available') counts[outcome]++;
    } catch {
      counts.unknown++;
      observationOk = false;
    }
  }
  return {
    nextCursor: ids.length === batchSize ? ids[ids.length - 1] : undefined,
    observationOk,
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
  const cursors = new Map<string, string>();
  let running = false;
  return async (): Promise<void> => {
    if (running) return;
    running = true;
    const counts = emptyCounts();
    let observationOk = true;
    try {
      const instanceIds = await listActiveInstanceIdsForWorker();
      const activeInstances = new Set(instanceIds);
      for (const instanceId of cursors.keys()) {
        if (!activeInstances.has(instanceId)) cursors.delete(instanceId);
      }
      for (const instanceId of instanceIds) {
        try {
          const result = await reconcileInstanceJobs(
            instanceId,
            cursors.get(instanceId) ?? null,
            counts
          );
          observationOk &&= result.observationOk;
          if (result.nextCursor) cursors.set(instanceId, result.nextCursor);
          else cursors.delete(instanceId);
        } catch {
          observationOk = false;
        }
      }
    } catch {
      observationOk = false;
    } finally {
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
