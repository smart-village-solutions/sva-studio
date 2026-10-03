import { randomUUID } from 'node:crypto';

import type { StudioJobRecord } from '@sva/core';

import { readInstanceRegistryPluginTenantLifecycleRegistry } from '../iam-instance-registry/plugin-activation-policy-snapshot.js';
import { createPluginTenantLifecycleJobCorrelation } from '../plugin-tenant-lifecycle/job-correlation.js';
import { scheduleConfiguredPluginTenantProvisioning } from '../iam-instance-registry/repository.js';
import { createJobLifecycleOrchestrator } from './job-lifecycle-orchestrator.js';
import { withStudioJobLifecycleRepositories } from './repository.js';
import { isConfiguredLifecycleJob } from './runner-lifecycle.js';
import type { PluginOperationExecutionResult } from './types.js';

type RepositoryPort = Awaited<
  ReturnType<Parameters<typeof createJobLifecycleOrchestrator>[0]['loadRepository']>
>;
type TerminalStateInput = Parameters<NonNullable<RepositoryPort['persistTerminalState']>>[0];

const enqueueFutureLifecycleRetry = async (input: {
  readonly instanceId: string;
  readonly pluginId: string;
  readonly lifecycle?: { readonly retryKind?: string; readonly retryAfter?: string } | null;
  readonly enqueue: (input: {
    readonly instanceId: string;
    readonly pluginId: string;
    readonly runAt: Date;
  }) => Promise<unknown>;
}): Promise<boolean> => {
  const retryAfter =
    input.lifecycle?.retryKind === 'retryable' ? input.lifecycle.retryAfter : undefined;
  if (!retryAfter || Date.parse(retryAfter) <= Date.now()) return false;
  const runAt = new Date(retryAfter);
  await input.enqueue({ instanceId: input.instanceId, pluginId: input.pluginId, runAt });
  return true;
};

export const persistStudioJobTerminalState = async (
  tenantInstanceId: string,
  loadedJob: StudioJobRecord | null,
  getSuccessfulResult: () => PluginOperationExecutionResult | void,
  { state: input, event }: TerminalStateInput
): Promise<StudioJobRecord> => {
  if (!loadedJob || !input.workerId) {
    throw new Error(`studio_job_terminal_owner_missing:${input.jobId}`);
  }
  const terminalWorkerId = input.workerId;
  const isLifecycleCompletion = isConfiguredLifecycleJob(loadedJob);
  if (isLifecycleCompletion && !loadedJob.pluginId) {
    throw new Error(`plugin_tenant_lifecycle_plugin_missing:${input.jobId}`);
  }
  const lifecycleJob = loadedJob;
  const lifecyclePluginId = loadedJob.pluginId;
  let lifecycleRetryEnqueued = false;
  const updatedJob = await withStudioJobLifecycleRepositories(
    tenantInstanceId,
    async ({ studioJobs, tenantLifecycle, enqueuePluginTenantLifecycleRetry }) => {
      const transactionCorrelation = createPluginTenantLifecycleJobCorrelation({
        lifecycleRegistry: readInstanceRegistryPluginTenantLifecycleRegistry(),
        withRepository: async (_instanceId, work) => work(tenantLifecycle),
      });
      if (isLifecycleCompletion && input.status === 'succeeded') {
        const completedLifecycle = await transactionCorrelation.complete({
          job: lifecycleJob,
          result: getSuccessfulResult(),
        });
        if (
          lifecyclePluginId &&
          completedLifecycle?.readinessStatus === 'pending' &&
          completedLifecycle.nextRecheckAt
        ) {
          await enqueuePluginTenantLifecycleRetry({
            instanceId: tenantInstanceId,
            pluginId: lifecyclePluginId,
            runAt: new Date(completedLifecycle.nextRecheckAt),
          });
        }
      } else if (isLifecycleCompletion && lifecyclePluginId) {
        const failedLifecycle = await transactionCorrelation.fail({
          job: lifecycleJob,
          error: input.errorPayload ?? {
            code: 'plugin_operation_cancelled',
            category: 'permanent',
          },
          reason: input.status === 'cancelled' ? 'cancelled' : 'failed',
        });
        lifecycleRetryEnqueued = await enqueueFutureLifecycleRetry({
          instanceId: tenantInstanceId,
          pluginId: lifecyclePluginId,
          lifecycle: failedLifecycle,
          enqueue: enqueuePluginTenantLifecycleRetry,
        });
      }
      const transition = await studioJobs.transitionJobStateAndAppendEvent({
        ...input,
        expectedStatuses: ['running'],
        expectedAttempts: input.attempts,
        expectedWorkerId: terminalWorkerId,
        leasePredicate: { kind: 'activeOwner' },
        event: {
          id: randomUUID(),
          jobId: input.jobId,
          instanceId: input.instanceId,
          ...event,
        },
      });
      if (transition.outcome === 'conflict') {
        throw new Error(`studio_job_terminal_transition_conflict:${input.jobId}`);
      }
      return transition.job;
    }
  );
  if (isLifecycleCompletion && input.status !== 'succeeded' && !lifecycleRetryEnqueued) {
    scheduleConfiguredPluginTenantProvisioning(tenantInstanceId);
  }
  return updatedJob;
};
