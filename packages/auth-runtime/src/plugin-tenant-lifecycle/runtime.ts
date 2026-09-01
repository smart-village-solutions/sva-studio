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
import {
  withPluginTenantLifecycleRepository,
  withStudioJobLifecycleRepositories,
} from '../plugin-operations/repository.js';
import { getRegisteredPluginOperationExecutionRegistry } from '../plugin-operations/runner.js';
import { pluginTenantLifecycleJobInputKey } from './job-correlation.js';
import { reconcileClaimedLifecycleJob } from './enqueue-recovery.js';
import {
  createPluginTenantLifecycleOrchestrator,
  pluginTenantLifecycleHostErrorCodes,
  type PersistPluginTenantLifecycleStart,
  type StartPluginTenantLifecycleInput,
} from './orchestrator.js';

const logger = createSdkLogger({ component: 'plugin-tenant-lifecycle', level: 'info' });
export const lifecycleEnqueueRecoveryDelayMs = 120_000;

const persistAtomicLifecycleStart: PersistPluginTenantLifecycleStart = async ({
  request,
  jobTypeId,
  queueName,
  executionLane,
  contractRevision,
}) =>
  withStudioJobLifecycleRepositories(
    request.instanceId,
    async ({
      studioJobs,
      tenantLifecycle,
      enqueuePluginTenantLifecycleRecovery,
      enqueueStudioJob,
    }) => {
      const lifecycle = await tenantLifecycle.requestLifecycle({
        instanceId: request.instanceId,
        pluginId: request.pluginId,
        operation: request.operation,
      });
      const jobId = randomUUID();
      const job = await studioJobs.createJob({
        id: jobId,
        instanceId: request.instanceId,
        source: 'plugin',
        pluginId: request.pluginId,
        jobTypeId,
        queueName,
        status: 'queued',
        progress: { completedSteps: 0, totalSteps: 1 },
        inputPayload: {
          [pluginTenantLifecycleJobInputKey]: {
            operation: request.operation,
            generation: lifecycle.desiredGeneration,
            ...(contractRevision ? { contractRevision } : {}),
          },
        },
        attempts: 0,
        maxAttempts: 5,
        idempotencyKey: `${request.pluginId}:tenant-lifecycle:${request.operation}:${lifecycle.desiredGeneration}`,
        requestId: request.requestId,
        actorAccountId: request.actorAccountId,
        correlationId: randomUUID(),
        scheduledAt: request.scheduledAt,
      });
      await studioJobs.appendJobEvent({
        id: randomUUID(),
        jobId: job.id,
        instanceId: request.instanceId,
        eventType: 'job.queued',
        status: 'queued',
        progress: job.progress,
        attempts: 0,
      });
      const claimed = await tenantLifecycle.claimLifecycle({
        instanceId: request.instanceId,
        pluginId: request.pluginId,
        jobId: job.id,
        generation: lifecycle.desiredGeneration,
        operation: request.operation,
      });
      if (!claimed) throw new Error('plugin_tenant_lifecycle_claim_conflict');
      try {
        await enqueueStudioJob({
          instanceId: request.instanceId,
          jobId: job.id,
          queueName,
          maxAttempts: job.maxAttempts,
          executionLane,
          runAt: new Date(request.scheduledAt),
        });
      } catch {
        throw new Error(
          `${pluginTenantLifecycleHostErrorCodes.enqueueFailed}:${request.pluginId}:${request.operation}`
        );
      }
      await enqueuePluginTenantLifecycleRecovery({
        instanceId: request.instanceId,
        pluginId: request.pluginId,
        runAt: new Date(Date.now() + lifecycleEnqueueRecoveryDelayMs),
      });
      return { lifecycle: claimed, job };
    }
  );

const blocksAutomaticLifecycleRetryWhileSuspended = (
  lifecycle: NonNullable<Awaited<ReturnType<PluginTenantLifecycleRepository['getLifecycle']>>>
): boolean =>
  lifecycle.accessState === 'suspended' &&
  (lifecycle.retryKind !== 'retryable' ||
    (lifecycle.desiredOperation !== 'suspend' && lifecycle.desiredOperation !== 'reactivate'));

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
  if (lifecycle.activeJobId) return null;
  const contractDrift =
    definition.contractRevision !== undefined &&
    lifecycle.contractRevision !== undefined &&
    lifecycle.contractRevision !== definition.contractRevision;
  if (contractDrift) {
    const operation = hasOperation('reconcile') ? 'reconcile' : resolveInitialOperation();
    return operation ? { operation, scheduledAt: now.toISOString() } : null;
  }
  if (lifecycle.retryKind === 'terminal') return null;
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
  if (lifecycle.nextRecheckAt && Date.parse(lifecycle.nextRecheckAt) > now.getTime()) {
    return null;
  }
  if (
    lifecycle.desiredGeneration > lifecycle.completedGeneration &&
    hasOperation(lifecycle.desiredOperation)
  ) {
    return { operation: lifecycle.desiredOperation, scheduledAt: now.toISOString() };
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

export const startConfiguredPluginTenantLifecycle = (input: StartPluginTenantLifecycleInput) =>
  createPluginTenantLifecycleOrchestrator({
    logger,
    lifecycleRegistry: readInstanceRegistryPluginTenantLifecycleRegistry(),
    resolveActivation: (instanceId, pluginId) =>
      withRegistryRepository((instanceRegistryRepository) =>
        instanceRegistryRepository.getModuleActivationPolicy(instanceId, pluginId)
      ),
    resolveLifecycle: (instanceId, pluginId) =>
      withPluginTenantLifecycleRepository(instanceId, (repository) =>
        repository.getLifecycle(instanceId, pluginId)
      ),
    resolveJobRegistration: (jobTypeId) =>
      getRegisteredPluginOperationExecutionRegistry().get(jobTypeId),
    persistStart: persistAtomicLifecycleStart,
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
  if (lifecycle?.activeJobId) {
    try {
      await reconcileClaimedLifecycleJob({
        instanceId: input.instanceId,
        definition: input.definition,
        lifecycle: { ...lifecycle, activeJobId: lifecycle.activeJobId },
      });
      return true;
    } catch (error) {
      logger.error('plugin_tenant_lifecycle_recovery_failed', {
        operation: 'plugin_tenant_lifecycle_recovery',
        result: 'failed',
        error_code: 'plugin_tenant_lifecycle_recovery_failed',
        error_type: error instanceof Error ? error.name : typeof error,
        instance_id: input.instanceId,
        plugin_id: pluginId,
        job_id: lifecycle.activeJobId,
        retry_attempt: input.attempt,
      });
      return false;
    }
  }
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
    throw new Error(`plugin_tenant_lifecycle_schedule_exhausted:${instanceId}:${pendingPluginIds}`);
  }
};
