import type { TenantModuleActivationRecord } from '@sva/core';
import type { PluginTenantLifecycleRepository } from '@sva/data-repositories';
import {
  createPluginTenantReadinessReadModel,
  type PluginTenantLifecycleOperation,
  type PluginTenantLifecycleRegistryEntry,
} from '@sva/plugin-sdk';

type Lifecycle = Awaited<ReturnType<PluginTenantLifecycleRepository['getLifecycle']>>;
type PersistedLifecycle = NonNullable<Lifecycle>;
type Schedule = Readonly<{
  operation: PluginTenantLifecycleOperation;
  scheduledAt: string;
}>;

const hasOperation = (
  definition: PluginTenantLifecycleRegistryEntry,
  operation: PluginTenantLifecycleOperation
): boolean => definition.operations.some((candidate) => candidate.operation === operation);

const resolveInitialOperation = (
  definition: PluginTenantLifecycleRegistryEntry
): PluginTenantLifecycleOperation | null =>
  hasOperation(definition, 'provision')
    ? 'provision'
    : hasOperation(definition, 'readiness')
      ? 'readiness'
      : null;

const createSchedule = (
  operation: PluginTenantLifecycleOperation | null,
  now: Date
): Schedule | null => (operation ? { operation, scheduledAt: now.toISOString() } : null);

const blocksAutomaticRetryWhileSuspended = (lifecycle: PersistedLifecycle): boolean =>
  lifecycle.accessState === 'suspended' &&
  !(
    (lifecycle.retryKind === 'retryable' &&
      (lifecycle.desiredOperation === 'suspend' || lifecycle.desiredOperation === 'reactivate')) ||
    (lifecycle.desiredOperation === 'reactivate' && lifecycle.readinessStatus === 'pending')
  );

const hasContractDrift = (
  definition: PluginTenantLifecycleRegistryEntry,
  lifecycle: PersistedLifecycle
): boolean =>
  definition.contractRevision !== undefined &&
  lifecycle.contractRevision !== undefined &&
  lifecycle.contractRevision !== definition.contractRevision;

const isAfter = (timestamp: string | undefined, now: Date): boolean =>
  timestamp !== undefined && Date.parse(timestamp) > now.getTime();

const isDuePendingReactivation = (
  definition: PluginTenantLifecycleRegistryEntry,
  lifecycle: PersistedLifecycle
): boolean =>
  lifecycle.accessState === 'suspended' &&
  lifecycle.readinessStatus === 'pending' &&
  lifecycle.desiredOperation === 'reactivate' &&
  hasOperation(definition, 'reactivate');

const hasPendingGeneration = (
  definition: PluginTenantLifecycleRegistryEntry,
  lifecycle: PersistedLifecycle
): boolean =>
  lifecycle.desiredGeneration > lifecycle.completedGeneration &&
  hasOperation(definition, lifecycle.desiredOperation);

const hasCurrentReadinessEvidence = (
  definition: PluginTenantLifecycleRegistryEntry,
  activation: TenantModuleActivationRecord,
  lifecycle: PersistedLifecycle
): boolean => {
  const readiness = createPluginTenantReadinessReadModel({
    definition,
    activation,
    evidence: lifecycle,
  });
  return (
    readiness?.evidenceState === 'valid' &&
    lifecycle.completedGeneration >= lifecycle.desiredGeneration &&
    (readiness.status === 'ready' || readiness.status === 'degraded')
  );
};

export const resolveAutomaticProvisioningSchedule = (
  definition: PluginTenantLifecycleRegistryEntry,
  activation: TenantModuleActivationRecord,
  lifecycle: Lifecycle
): Schedule | null => {
  const now = new Date();
  if (!lifecycle) {
    return createSchedule(resolveInitialOperation(definition), now);
  }
  if (lifecycle.activeJobId) return null;
  if (hasContractDrift(definition, lifecycle)) {
    const operation = hasOperation(definition, 'reconcile')
      ? 'reconcile'
      : resolveInitialOperation(definition);
    return createSchedule(operation, now);
  }
  if (lifecycle.retryKind === 'terminal') return null;
  if (blocksAutomaticRetryWhileSuspended(lifecycle)) return null;
  if (isAfter(lifecycle.retryAfter, now)) return null;
  if (lifecycle.retryKind === 'retryable') {
    return createSchedule(
      hasOperation(definition, lifecycle.desiredOperation) ? lifecycle.desiredOperation : null,
      now
    );
  }
  if (isAfter(lifecycle.nextRecheckAt, now)) return null;
  if (isDuePendingReactivation(definition, lifecycle)) return createSchedule('reactivate', now);
  if (hasPendingGeneration(definition, lifecycle)) {
    return createSchedule(lifecycle.desiredOperation, now);
  }
  if (hasCurrentReadinessEvidence(definition, activation, lifecycle)) return null;
  return createSchedule(resolveInitialOperation(definition), now);
};
