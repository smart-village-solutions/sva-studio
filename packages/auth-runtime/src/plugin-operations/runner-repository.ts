import type { StudioJobRecord } from '@sva/core';

import { createJobLifecycleOrchestrator } from './job-lifecycle-orchestrator.js';
import { withStudioJobRepository } from './repository.js';
import { persistStudioJobTerminalState } from './runner-terminal-state.js';
import type { PluginOperationExecutionResult } from './types.js';

type RepositoryPort = Awaited<
  ReturnType<Parameters<typeof createJobLifecycleOrchestrator>[0]['loadRepository']>
>;

export const loadStudioJobExecutionRepository = async (
  tenantInstanceId: string,
  getSuccessfulResult: () => PluginOperationExecutionResult | void
): Promise<RepositoryPort> => {
  let loadedJob: StudioJobRecord | null = null;
  return {
    getJobById: (repositoryInstanceId, repositoryJobId) =>
      withStudioJobRepository(tenantInstanceId, async (repository) => {
        loadedJob = await repository.getJobById(repositoryInstanceId, repositoryJobId);
        return loadedJob;
      }),
    updateJobState: async (input) => {
      return withStudioJobRepository(tenantInstanceId, async (repository) => {
        if (loadedJob && (input.status === 'running' || input.status === 'retrying')) {
          const transition = await repository.transitionJobState({
            ...input,
            expectedStatuses: [loadedJob.status],
            expectedAttempts: loadedJob.attempts,
            expectedWorkerId: loadedJob.workerId ?? null,
            ...(input.status === 'retrying'
              ? { leasePredicate: { kind: 'activeOwner' as const } }
              : {}),
          });
          if (transition.outcome === 'conflict') {
            throw new Error(`studio_job_lease_lost:${input.jobId}`);
          }
          loadedJob = transition.job;
          return transition.job;
        }
        return repository.updateJobState(input);
      });
    },
    persistTerminalState: (input) =>
      persistStudioJobTerminalState(tenantInstanceId, loadedJob, getSuccessfulResult, input),
    updateJobProgress: (input) =>
      withStudioJobRepository(tenantInstanceId, async (repository) => {
        if (!loadedJob?.workerId) throw new Error(`studio_job_lease_lost:${input.jobId}`);
        const updated = await repository.updateJobProgressWithLease({
          ...input,
          attempts: loadedJob.attempts,
          workerId: loadedJob.workerId,
        });
        if (!updated) throw new Error(`studio_job_lease_lost:${input.jobId}`);
        loadedJob = updated;
        return updated;
      }),
    touchJobHeartbeat: (input) =>
      withStudioJobRepository(tenantInstanceId, async (repository) => {
        const updated = await repository.touchJobHeartbeatWithLease(input);
        if (!updated) throw new Error(`studio_job_lease_lost:${input.jobId}`);
        loadedJob = updated;
        return updated;
      }),
    appendJobEvent: (input) =>
      withStudioJobRepository(tenantInstanceId, (repository) => repository.appendJobEvent(input)),
  };
};
