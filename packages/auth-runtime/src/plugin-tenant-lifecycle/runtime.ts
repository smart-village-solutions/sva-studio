import { randomUUID } from 'node:crypto';

import type { TenantModuleActivationRecord } from '@sva/core';
import type { PluginTenantLifecycleRepository } from '@sva/data-repositories';
import {
  createPluginTenantReadinessReadModel,
  type PluginTenantLifecycleRegistryEntry,
} from '@sva/plugin-sdk';
import { createSdkLogger } from '@sva/server-runtime';

import { readInstanceRegistryPluginTenantLifecycleRegistry } from '../iam-instance-registry/plugin-activation-policy-snapshot.js';
import { withRegistryRepository } from '../iam-instance-registry/repository.js';
import { createStudioJob, markStudioJobEnqueueFailed } from '../plugin-operations/core.shared.js';
import {
  withPluginTenantLifecycleRepository,
  withStudioJobLifecycleRepositories,
} from '../plugin-operations/repository.js';
import {
  getRegisteredPluginOperationExecutionRegistry,
  queuePluginOperationJob,
} from '../plugin-operations/runner.js';
import { pluginTenantLifecycleJobInputKey } from './job-correlation.js';
import {
  createPluginTenantLifecycleOrchestrator,
  pluginTenantLifecycleHostErrorCodes,
  type StartPluginTenantLifecycleInput,
} from './orchestrator.js';

const logger = createSdkLogger({ component: 'plugin-tenant-lifecycle', level: 'info' });

const repository: Pick<
  PluginTenantLifecycleRepository,
  'requestLifecycle' | 'claimLifecycle' | 'failUnclaimedLifecycle'
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
};

const resolveAutomaticProvisioningSchedule = (
  definition: PluginTenantLifecycleRegistryEntry,
  activation: TenantModuleActivationRecord,
  lifecycle: Awaited<ReturnType<PluginTenantLifecycleRepository['getLifecycle']>>
): string | null => {
  const now = new Date();
  if (!lifecycle) return now.toISOString();
  if (lifecycle.accessState === 'suspended') return null;
  if (lifecycle.activeJobId || lifecycle.retryKind === 'terminal') return null;
  if (lifecycle.retryAfter && Date.parse(lifecycle.retryAfter) > now.getTime()) {
    return lifecycle.retryAfter;
  }
  const readiness = createPluginTenantReadinessReadModel({
    definition,
    activation,
    evidence: lifecycle,
  });
  if (
    readiness?.evidenceState === 'valid' &&
    lifecycle.completedGeneration >= lifecycle.desiredGeneration &&
    (readiness.status === 'ready' || readiness.status === 'degraded')
  ) {
    return null;
  }
  return now.toISOString();
};

const persistLifecycleEnqueueFailure = async (input: {
  readonly instanceId: string;
  readonly pluginId: string;
  readonly job: Awaited<ReturnType<typeof createStudioJob>>;
  readonly generation: number;
}): Promise<void> =>
  withStudioJobLifecycleRepositories(input.instanceId, async ({ studioJobs, tenantLifecycle }) => {
    const lifecycle = await tenantLifecycle.failLifecycle({
      instanceId: input.instanceId,
      pluginId: input.pluginId,
      jobId: input.job.id,
      generation: input.generation,
      readinessStatus: 'blocked',
      errorCode: pluginTenantLifecycleHostErrorCodes.enqueueFailed,
      retryKind: 'retryable',
    });
    if (!lifecycle) {
      throw new Error('plugin_tenant_lifecycle_enqueue_cleanup_conflict');
    }
    const job = await studioJobs.updateJobState({
      jobId: input.job.id,
      instanceId: input.instanceId,
      status: 'failed',
      attempts: input.job.attempts,
      startedAt: input.job.startedAt,
      finishedAt: new Date().toISOString(),
      progress: input.job.progress,
      errorPayload: {
        code: 'plugin_operation_enqueue_failed',
        category: 'permanent',
      },
    });
    if (!job) {
      throw new Error('plugin_operation_enqueue_cleanup_conflict');
    }
  });

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
    persistEnqueueFailure: persistLifecycleEnqueueFailure,
    markClaimConflict: ({ instanceId, job }) =>
      markStudioJobEnqueueFailed({
        instanceId,
        job,
        errorCode: 'plugin_tenant_lifecycle_claim_conflict',
      }),
  }).start(input);

export const ensureConfiguredPluginTenantProvisioning = async (
  instanceId: string
): Promise<void> => {
  const lifecycleRegistry = readInstanceRegistryPluginTenantLifecycleRegistry();
  const activations = await withRegistryRepository((repository) =>
    repository.listModuleActivations(instanceId)
  );
  const effectiveActivations = new Map(
    activations
      .filter(({ effectiveActive }) => effectiveActive)
      .map((activation) => [activation.moduleId, activation])
  );
  const provisioningDefinitions = [...lifecycleRegistry.values()].filter(
    (definition) =>
      effectiveActivations.has(definition.pluginId) &&
      definition.operations.some(({ operation }) => operation === 'provision')
  );
  for (const definition of provisioningDefinitions) {
    const pluginId = definition.pluginId;
    const activation = effectiveActivations.get(pluginId);
    if (!activation) continue;
    const lifecycle = await withPluginTenantLifecycleRepository(instanceId, (resolvedRepository) =>
      resolvedRepository.getLifecycle(instanceId, pluginId)
    );
    const scheduledAt = resolveAutomaticProvisioningSchedule(definition, activation, lifecycle);
    if (!scheduledAt) continue;
    try {
      await startConfiguredPluginTenantLifecycle({
        instanceId,
        pluginId,
        operation: 'provision',
        scheduledAt,
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
