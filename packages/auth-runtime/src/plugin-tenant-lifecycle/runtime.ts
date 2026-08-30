import { randomUUID } from 'node:crypto';

import type { PluginTenantLifecycleRepository } from '@sva/data-repositories';
import { createSdkLogger } from '@sva/server-runtime';

import {
  readInstanceRegistryPluginActivationPolicies,
  readInstanceRegistryPluginTenantLifecycleRegistry,
} from '../iam-instance-registry/plugin-activation-policy-snapshot.js';
import { withRegistryRepository } from '../iam-instance-registry/repository.js';
import {
  createStudioJob,
  markPluginOperationEnqueueFailed,
} from '../plugin-operations/core.shared.js';
import { withPluginTenantLifecycleRepository } from '../plugin-operations/repository.js';
import {
  getRegisteredPluginOperationExecutionRegistry,
  queuePluginOperationJob,
} from '../plugin-operations/runner.js';
import { pluginTenantLifecycleJobInputKey } from './job-correlation.js';
import {
  createPluginTenantLifecycleOrchestrator,
  type StartPluginTenantLifecycleInput,
} from './orchestrator.js';

const logger = createSdkLogger({ component: 'plugin-tenant-lifecycle', level: 'info' });

const repository: Pick<
  PluginTenantLifecycleRepository,
  'requestLifecycle' | 'claimLifecycle' | 'failUnclaimedLifecycle' | 'failLifecycle'
> = {
  requestLifecycle: (input) =>
    withPluginTenantLifecycleRepository(input.instanceId, (tenantLifecycleRepository) =>
      tenantLifecycleRepository.requestLifecycle(input)
    ),
  claimLifecycle: (input) =>
    withPluginTenantLifecycleRepository(input.instanceId, (tenantLifecycleRepository) =>
      tenantLifecycleRepository.claimLifecycle(input)
    ),
  failUnclaimedLifecycle: (input) =>
    withPluginTenantLifecycleRepository(input.instanceId, (tenantLifecycleRepository) =>
      tenantLifecycleRepository.failUnclaimedLifecycle(input)
    ),
  failLifecycle: (input) =>
    withPluginTenantLifecycleRepository(input.instanceId, (tenantLifecycleRepository) =>
      tenantLifecycleRepository.failLifecycle(input)
    ),
};

const needsAutomaticProvisioning = (
  lifecycle: Awaited<ReturnType<PluginTenantLifecycleRepository['getLifecycle']>>
): boolean => {
  if (!lifecycle) return true;
  if (lifecycle.activeJobId || lifecycle.retryKind === 'terminal') return false;
  if (
    lifecycle.accessState === 'active' &&
    lifecycle.completedGeneration >= lifecycle.desiredGeneration &&
    (lifecycle.readinessStatus === 'ready' || lifecycle.readinessStatus === 'degraded')
  ) {
    return false;
  }
  return true;
};

export const startConfiguredPluginTenantLifecycle = (input: StartPluginTenantLifecycleInput) =>
  createPluginTenantLifecycleOrchestrator({
    logger,
    lifecycleRegistry: readInstanceRegistryPluginTenantLifecycleRegistry(),
    resolveActivation: (instanceId, pluginId) =>
      withRegistryRepository((instanceRegistryRepository) =>
        instanceRegistryRepository.getModuleActivationPolicy(instanceId, pluginId)
      ),
    repository,
    resolveJobRegistration: (jobTypeId) =>
      getRegisteredPluginOperationExecutionRegistry().get(jobTypeId),
    createJob: async (jobInput) =>
      createStudioJob({
        instanceId: jobInput.instanceId,
        initialProgress: { completedSteps: 0, totalSteps: 1 },
        create: {
          source: 'plugin',
          pluginId: jobInput.pluginId,
          jobTypeId: jobInput.jobTypeId,
          queueName: jobInput.queueName,
          inputPayload: {
            [pluginTenantLifecycleJobInputKey]: {
              operation: jobInput.operation,
              generation: jobInput.generation,
            },
          },
          maxAttempts: 5,
          idempotencyKey: `${jobInput.pluginId}:tenant-lifecycle:${jobInput.operation}:${jobInput.generation}`,
          requestId: jobInput.requestId,
          actorAccountId: jobInput.actorAccountId,
          correlationId: randomUUID(),
          scheduledAt: jobInput.scheduledAt,
        },
      }),
    queueJob: queuePluginOperationJob,
    markEnqueueFailed: markPluginOperationEnqueueFailed,
  }).start(input);

export const ensureConfiguredPluginTenantProvisioning = async (
  instanceId: string
): Promise<void> => {
  const lifecycleRegistry = readInstanceRegistryPluginTenantLifecycleRegistry();
  const automaticPluginIds = readInstanceRegistryPluginActivationPolicies().modules.flatMap(
    ({ moduleId, activationPolicy }) =>
      activationPolicy !== 'optional' &&
      lifecycleRegistry.get(moduleId)?.operations.some(({ operation }) => operation === 'provision')
        ? [moduleId]
        : []
  );
  for (const pluginId of automaticPluginIds) {
    const lifecycle = await withPluginTenantLifecycleRepository(instanceId, (resolvedRepository) =>
      resolvedRepository.getLifecycle(instanceId, pluginId)
    );
    if (!needsAutomaticProvisioning(lifecycle)) continue;
    try {
      await startConfiguredPluginTenantLifecycle({
        instanceId,
        pluginId,
        operation: 'provision',
        scheduledAt: new Date().toISOString(),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith('plugin_tenant_lifecycle_request_conflict')
      ) {
        continue;
      }
      throw error;
    }
  }
};
