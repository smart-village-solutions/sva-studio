import { randomUUID } from 'node:crypto';

import type { TenantModuleActivationRecord } from '@sva/core';
import type { PluginTenantLifecycleRepository } from '@sva/data-repositories';
import {
  createPluginTenantReadinessReadModel,
  type PluginTenantLifecycleOperation,
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

const blocksAutomaticLifecycleRetryWhileSuspended = (
  lifecycle: NonNullable<Awaited<ReturnType<PluginTenantLifecycleRepository['getLifecycle']>>>
): boolean =>
  lifecycle.accessState === 'suspended' &&
  (lifecycle.retryKind !== 'retryable' || lifecycle.desiredOperation !== 'reactivate');

const resolveAutomaticProvisioningSchedule = (
  definition: PluginTenantLifecycleRegistryEntry,
  activation: TenantModuleActivationRecord,
  lifecycle: Awaited<ReturnType<PluginTenantLifecycleRepository['getLifecycle']>>
): Readonly<{ operation: PluginTenantLifecycleOperation; scheduledAt: string }> | null => {
  const now = new Date();
  const hasOperation = (operation: PluginTenantLifecycleOperation): boolean =>
    definition.operations.some((candidate) => candidate.operation === operation);
  const resolveInitialOperation = (): PluginTenantLifecycleOperation | null =>
    hasOperation('provision') ? 'provision' : hasOperation('readiness') ? 'readiness' : null;
  if (!lifecycle) {
    const operation = resolveInitialOperation();
    return operation ? { operation, scheduledAt: now.toISOString() } : null;
  }
  if (lifecycle.activeJobId || lifecycle.retryKind === 'terminal') return null;
  if (blocksAutomaticLifecycleRetryWhileSuspended(lifecycle)) {
    return null;
  }
  if (lifecycle.retryAfter && Date.parse(lifecycle.retryAfter) > now.getTime()) {
    return null;
  }
  if (lifecycle.retryKind === 'retryable') {
    return hasOperation(lifecycle.desiredOperation)
      ? { operation: lifecycle.desiredOperation, scheduledAt: now.toISOString() }
      : null;
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
  const operation = resolveInitialOperation();
  return operation ? { operation, scheduledAt: now.toISOString() } : null;
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
    markUnclaimedJobFailed: ({ instanceId, job, errorCode }) =>
      markStudioJobEnqueueFailed({
        instanceId,
        job,
        errorCode,
      }),
  }).start(input);

const automaticLifecycleRetryDelaysMs = [250, 1_000] as const;

const waitForAutomaticLifecycleRetry = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

const scheduleAutomaticLifecycleDefinition = async (input: {
  readonly instanceId: string;
  readonly definition: PluginTenantLifecycleRegistryEntry;
  readonly activation: TenantModuleActivationRecord;
  readonly attempt: number;
}): Promise<boolean> => {
  const pluginId = input.definition.pluginId;
  const lifecycle = await withPluginTenantLifecycleRepository(
    input.instanceId,
    (resolvedRepository) => resolvedRepository.getLifecycle(input.instanceId, pluginId)
  );
  const schedule = resolveAutomaticProvisioningSchedule(
    input.definition,
    input.activation,
    lifecycle
  );
  if (!schedule) return true;
  try {
    await startConfiguredPluginTenantLifecycle({
      instanceId: input.instanceId,
      pluginId,
      operation: schedule.operation,
      scheduledAt: schedule.scheduledAt,
    });
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('plugin_tenant_lifecycle_request_conflict')
    ) {
      return true;
    }
    logger.error('plugin_tenant_lifecycle_schedule_plugin_failed', {
      operation: 'plugin_tenant_lifecycle_schedule',
      result: 'failed',
      error_code: 'plugin_tenant_lifecycle_schedule_plugin_failed',
      error_type: error instanceof Error ? error.name : typeof error,
      instance_id: input.instanceId,
      plugin_id: pluginId,
      lifecycle_operation: schedule.operation,
      retry_attempt: input.attempt,
    });
    return false;
  }
};

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
  let pendingDefinitions = [...lifecycleRegistry.values()].flatMap((definition) => {
    const activation = effectiveActivations.get(definition.pluginId);
    return activation ? [{ definition, activation }] : [];
  });
  for (
    let attempt = 0;
    pendingDefinitions.length > 0 && attempt <= automaticLifecycleRetryDelaysMs.length;
    attempt += 1
  ) {
    const failedDefinitions: typeof pendingDefinitions = [];
    for (const target of pendingDefinitions) {
      const scheduled = await scheduleAutomaticLifecycleDefinition({
        instanceId,
        ...target,
        attempt,
      });
      if (!scheduled) failedDefinitions.push(target);
    }
    pendingDefinitions = failedDefinitions;
    const retryDelayMs = automaticLifecycleRetryDelaysMs[attempt];
    if (pendingDefinitions.length > 0 && retryDelayMs !== undefined) {
      await waitForAutomaticLifecycleRetry(retryDelayMs);
    }
  }
  if (pendingDefinitions.length > 0) {
    const pendingPluginIds = pendingDefinitions
      .map(({ definition }) => definition.pluginId)
      .sort()
      .join(',');
    throw new Error(
      `plugin_tenant_lifecycle_schedule_exhausted:${instanceId}:${pendingPluginIds}`
    );
  }
};
