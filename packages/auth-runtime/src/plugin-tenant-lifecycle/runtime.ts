import { randomUUID } from 'node:crypto';

import type { PluginTenantLifecycleRepository } from '@sva/data-repositories';

import { readInstanceRegistryPluginTenantLifecycleRegistry } from '../iam-instance-registry/plugin-activation-policy-snapshot.js';
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

const repository: Pick<
  PluginTenantLifecycleRepository,
  'requestLifecycle' | 'claimLifecycle' | 'failLifecycle'
> = {
  requestLifecycle: (input) =>
    withPluginTenantLifecycleRepository(input.instanceId, (tenantLifecycleRepository) =>
      tenantLifecycleRepository.requestLifecycle(input)
    ),
  claimLifecycle: (input) =>
    withPluginTenantLifecycleRepository(input.instanceId, (tenantLifecycleRepository) =>
      tenantLifecycleRepository.claimLifecycle(input)
    ),
  failLifecycle: (input) =>
    withPluginTenantLifecycleRepository(input.instanceId, (tenantLifecycleRepository) =>
      tenantLifecycleRepository.failLifecycle(input)
    ),
};

export const startConfiguredPluginTenantLifecycle = (input: StartPluginTenantLifecycleInput) =>
  createPluginTenantLifecycleOrchestrator({
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
