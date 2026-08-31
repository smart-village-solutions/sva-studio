import type { PluginTenantLifecycleRecord } from '@sva/data-repositories';
import type { PluginTenantLifecycleRegistryEntry } from '@sva/plugin-sdk';

import { withStudioJobRepository } from '../plugin-operations/repository.js';
import {
  getRegisteredPluginOperationExecutionRegistry,
  queuePluginOperationJob,
} from '../plugin-operations/runner.js';

export const reconcileClaimedLifecycleJob = async (input: {
  readonly instanceId: string;
  readonly definition: PluginTenantLifecycleRegistryEntry;
  readonly lifecycle: PluginTenantLifecycleRecord & { readonly activeJobId: string };
}): Promise<void> => {
  const job = await withStudioJobRepository(input.instanceId, (studioJobs) =>
    studioJobs.getJobById(input.instanceId, input.lifecycle.activeJobId)
  );
  if (!job || job.status !== 'queued') return;
  const operation = input.definition.operations.find(
    (candidate) =>
      candidate.operation === input.lifecycle.desiredOperation &&
      candidate.jobTypeId === job.jobTypeId
  );
  const registration = getRegisteredPluginOperationExecutionRegistry().get(job.jobTypeId);
  if (!operation || !registration || job.pluginId !== input.definition.pluginId) {
    throw new Error('plugin_tenant_lifecycle_recovery_contract_mismatch');
  }
  await queuePluginOperationJob({
    instanceId: input.instanceId,
    jobId: job.id,
    queueName: job.queueName,
    maxAttempts: job.maxAttempts,
    executionLane: registration.executionLane ?? 'default',
    runAt: new Date(job.scheduledAt),
  });
};
