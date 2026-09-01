import type { TenantModuleActivationRecord } from '@sva/core';
import type { PluginTenantLifecycleRepository } from '@sva/data-repositories';
import {
  createPluginTenantReadinessReadModel,
  type PluginTenantLifecycleOperation,
  type PluginTenantLifecycleRegistryEntry,
} from '@sva/plugin-sdk';

const blocksAutomaticRetryWhileSuspended = (
  lifecycle: NonNullable<Awaited<ReturnType<PluginTenantLifecycleRepository['getLifecycle']>>>
): boolean =>
  lifecycle.accessState === 'suspended' &&
  !(
    (lifecycle.retryKind === 'retryable' &&
      (lifecycle.desiredOperation === 'suspend' || lifecycle.desiredOperation === 'reactivate')) ||
    (lifecycle.desiredOperation === 'reactivate' && lifecycle.readinessStatus === 'pending')
  );

export const resolveAutomaticProvisioningSchedule = (
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
  if (blocksAutomaticRetryWhileSuspended(lifecycle)) return null;
  if (lifecycle.retryAfter && Date.parse(lifecycle.retryAfter) > now.getTime()) return null;
  if (lifecycle.retryKind === 'retryable') {
    return hasOperation(lifecycle.desiredOperation)
      ? { operation: lifecycle.desiredOperation, scheduledAt: now.toISOString() }
      : null;
  }
  if (lifecycle.nextRecheckAt && Date.parse(lifecycle.nextRecheckAt) > now.getTime()) return null;
  if (
    lifecycle.accessState === 'suspended' &&
    lifecycle.readinessStatus === 'pending' &&
    lifecycle.desiredOperation === 'reactivate' &&
    hasOperation('reactivate')
  ) {
    return { operation: 'reactivate', scheduledAt: now.toISOString() };
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
