import type { BaseStateInput, JobStateWriterDeps } from './job-state-writer-types.js';
import {
  markCancelled,
  markMissingHandler,
  markRetriedOrFailed,
  markSucceeded,
} from './job-state-writer-terminal.js';

export const createJobStateWriter = (deps: JobStateWriterDeps) => ({
  markRunning: async ({ job, attempts, startedAt, workerId }: BaseStateInput): Promise<void> => {
    await deps.updateJobState({
      jobId: job.id,
      instanceId: job.instanceId,
      status: 'running',
      attempts,
      startedAt: job.startedAt ?? startedAt,
      progress: job.progress,
      workerId,
      heartbeatAt: startedAt,
    });
    await deps.appendStartedEvent({
      eventType: 'job.started',
      jobId: job.id,
      instanceId: job.instanceId,
      progress: job.progress,
      attempts,
      hostDetails: {
        workerId,
      },
    });
  },

  markSucceeded: (input: Parameters<typeof markSucceeded>[1]) => markSucceeded(deps, input),
  markRetriedOrFailed: (input: Parameters<typeof markRetriedOrFailed>[1]) =>
    markRetriedOrFailed(deps, input),
  markMissingHandler: (input: Parameters<typeof markMissingHandler>[1]) =>
    markMissingHandler(deps, input),
  markCancelled: (input: Parameters<typeof markCancelled>[1]) => markCancelled(deps, input),
});
