import type { StudioJobRecord } from '@sva/core';

import { readInstanceRegistryPluginTenantLifecycleRegistry } from '../iam-instance-registry/plugin-activation-policy-snapshot.js';
import {
  assertPluginTenantLifecycleJobContract,
  readPluginTenantLifecycleJobMetadata,
} from '../plugin-tenant-lifecycle/job-correlation.js';
import {
  isConfiguredPluginTenantEffectivelyActive,
  readConfiguredPluginTenantAccess,
} from '../plugin-tenant-lifecycle/access.js';
import { withPluginTenantLifecycleRepository } from './repository.js';
import type { StudioJobExecutionRegistration } from './runner-internal.js';
import { isConfiguredLifecycleJob } from './runner-lifecycle.js';

export const guardPluginTenantExecution = (
  job: StudioJobRecord,
  handler: StudioJobExecutionRegistration['handler']
): StudioJobExecutionRegistration['handler'] => {
  const pluginId = job.pluginId;
  if (job.source !== 'plugin' || !pluginId) {
    return handler;
  }
  const lifecycleJob = isConfiguredLifecycleJob(job);
  return async (context) => {
    if (lifecycleJob) {
      const lifecycleMetadata = readPluginTenantLifecycleJobMetadata(job);
      if (!lifecycleMetadata) {
        throw new Error('missing_plugin_tenant_lifecycle_job_metadata');
      }
      assertPluginTenantLifecycleJobContract(
        readInstanceRegistryPluginTenantLifecycleRegistry(),
        job
      );
      const effectivelyActive = await isConfiguredPluginTenantEffectivelyActive(
        job.instanceId,
        pluginId
      );
      if (!effectivelyActive) {
        throw Object.assign(new Error(`plugin_tenant_lifecycle_inactive:${pluginId}`), {
          cause: {
            category: 'permanent',
            code: 'plugin_tenant_lifecycle_inactive',
          },
        });
      }
      const lifecycle = await withPluginTenantLifecycleRepository(job.instanceId, (repository) =>
        repository.getLifecycle(job.instanceId, pluginId)
      );
      if (
        lifecycle?.activeJobId !== job.id ||
        lifecycle.claimedGeneration !== lifecycleMetadata.generation ||
        lifecycle.desiredOperation !== lifecycleMetadata.operation
      ) {
        throw Object.assign(
          new Error(`plugin_tenant_lifecycle_claim_stale:${pluginId}:${job.id}`),
          {
            cause: {
              category: 'permanent',
              code: 'plugin_tenant_lifecycle_claim_stale',
            },
          }
        );
      }
      return handler(context);
    }
    const access = await readConfiguredPluginTenantAccess(job.instanceId, pluginId);
    if (!access.allowed) {
      throw Object.assign(new Error(`plugin_tenant_access_blocked:${pluginId}:${access.reason}`), {
        cause: {
          category: 'permanent',
          code: 'plugin_tenant_access_blocked',
          reason: access.reason,
        },
      });
    }
    return handler(context);
  };
};
