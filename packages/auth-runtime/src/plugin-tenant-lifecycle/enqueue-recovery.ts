import { randomUUID } from 'node:crypto';

import type { PluginTenantLifecycleRecord } from '@sva/data-repositories';
import type { PluginTenantLifecycleRegistryEntry } from '@sva/plugin-sdk';

import { withStudioJobLifecycleRepositories } from '../plugin-operations/repository.js';
import { getRegisteredPluginOperationExecutionRegistry } from '../plugin-operations/runner.js';

export const lifecycleHeartbeatIntervalMs = 30_000;
export const lifecycleLeaseStaleAfterMs = 120_000;
export const lifecycleRecoveryDeadlineMs = 150_000;

const isFreshLease = (input: {
  readonly heartbeatAt?: string;
  readonly startedAt?: string;
  readonly updatedAt: string;
}): boolean => {
  const timestamp = input.heartbeatAt ?? input.startedAt ?? input.updatedAt;
  return Date.now() - Date.parse(timestamp) < lifecycleLeaseStaleAfterMs;
};

export const reconcileClaimedLifecycleJob = async (input: {
  readonly instanceId: string;
  readonly definition: PluginTenantLifecycleRegistryEntry;
  readonly lifecycle: PluginTenantLifecycleRecord & { readonly activeJobId: string };
}): Promise<void> =>
  withStudioJobLifecycleRepositories(
    input.instanceId,
    async ({
      studioJobs,
      tenantLifecycle,
      enqueuePluginTenantLifecycleRecovery,
      enqueuePluginTenantLifecycleRetry,
      enqueueStudioJob,
    }) => {
      const job = await studioJobs.getJobById(input.instanceId, input.lifecycle.activeJobId);
      const retryLifecycle = async (errorCode: string): Promise<void> => {
        const retryAfter = new Date().toISOString();
        const failed = await tenantLifecycle.failLifecycle({
          instanceId: input.instanceId,
          pluginId: input.definition.pluginId,
          jobId: input.lifecycle.activeJobId,
          generation: input.lifecycle.claimedGeneration ?? input.lifecycle.desiredGeneration,
          readinessStatus: 'blocked',
          errorCode,
          retryKind: 'retryable',
          retryAfter,
        });
        if (failed.outcome === 'conflict') {
          throw new Error(`plugin_tenant_lifecycle_recovery_fence_conflict:${errorCode}`);
        }
        await enqueuePluginTenantLifecycleRetry({
          instanceId: input.instanceId,
          pluginId: input.definition.pluginId,
          runAt: new Date(retryAfter),
        });
      };

      if (!job) {
        await retryLifecycle('plugin_tenant_lifecycle_recovery_job_missing');
        return;
      }
      const operation = input.definition.operations.find(
        (candidate) =>
          candidate.operation === input.lifecycle.desiredOperation &&
          candidate.jobTypeId === job.jobTypeId
      );
      const registration = getRegisteredPluginOperationExecutionRegistry().get(job.jobTypeId);
      if (!operation || !registration || job.pluginId !== input.definition.pluginId) {
        await retryLifecycle('plugin_tenant_lifecycle_recovery_contract_mismatch');
        return;
      }

      if (job.status === 'queued' || job.status === 'retrying') {
        await enqueueStudioJob({
          instanceId: input.instanceId,
          jobId: job.id,
          queueName: job.queueName,
          maxAttempts: job.maxAttempts,
          executionLane: registration.executionLane ?? 'default',
          runAt: new Date(),
        });
        await enqueuePluginTenantLifecycleRecovery({
          instanceId: input.instanceId,
          pluginId: input.definition.pluginId,
          runAt: new Date(Date.now() + lifecycleHeartbeatIntervalMs),
        });
        return;
      }

      if (job.status === 'running' && isFreshLease(job)) {
        await enqueuePluginTenantLifecycleRecovery({
          instanceId: input.instanceId,
          pluginId: input.definition.pluginId,
          runAt: new Date(Date.now() + lifecycleHeartbeatIntervalMs),
        });
        return;
      }

      if (job.status === 'running' && job.workerId) {
        const retryAfter = new Date().toISOString();
        const failed = await tenantLifecycle.failLifecycle({
          instanceId: input.instanceId,
          pluginId: input.definition.pluginId,
          jobId: job.id,
          generation: input.lifecycle.claimedGeneration ?? input.lifecycle.desiredGeneration,
          readinessStatus: 'blocked',
          errorCode: 'plugin_tenant_lifecycle_lease_expired',
          retryKind: 'retryable',
          retryAfter,
        });
        if (failed.outcome === 'conflict') {
          throw new Error('plugin_tenant_lifecycle_recovery_fence_conflict:lease_expired');
        }
        const transition = await studioJobs.transitionJobStateAndAppendEvent({
          jobId: job.id,
          instanceId: input.instanceId,
          status: 'failed',
          attempts: job.attempts,
          startedAt: job.startedAt,
          finishedAt: retryAfter,
          progress: job.progress,
          errorPayload: { code: 'studio_job_lease_expired', category: 'retryable' },
          workerId: job.workerId,
          heartbeatAt: retryAfter,
          expectedStatuses: ['running'],
          expectedAttempts: job.attempts,
          expectedWorkerId: job.workerId,
          leasePredicate: { kind: 'expiredOwner' },
          event: {
            id: randomUUID(),
            jobId: job.id,
            instanceId: input.instanceId,
            eventType: 'job.failed',
            status: 'failed',
            attempts: job.attempts,
            progress: job.progress,
            message: 'studio_job_lease_expired',
            details: {
              host: {
                workerId: job.workerId,
                errorCode: 'studio_job_lease_expired',
                errorCategory: 'retryable',
              },
            },
          },
        });
        if (transition.outcome === 'conflict') {
          throw new Error('studio_job_lease_recovery_conflict');
        }
        await enqueuePluginTenantLifecycleRetry({
          instanceId: input.instanceId,
          pluginId: input.definition.pluginId,
          runAt: new Date(retryAfter),
        });
        return;
      }

      await retryLifecycle(`plugin_tenant_lifecycle_recovery_${job.status}`);
    }
  );
