import { randomUUID } from 'node:crypto';

import { createReconcileModuleActivationPoliciesHandler } from './service-module-activation.js';
import { syncProtectedSystemAdminPermissions } from './service-module-mutations.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import {
  readTenantProvisioningPluginSnapshot,
  rebaseTenantProvisioningPluginSnapshot,
} from './tenant-provisioning-snapshot.js';

const RETRY_RESERVATION_MILLISECONDS = 5 * 60 * 1000;

type RetryAttribution = { readonly actorId?: string; readonly requestId?: string };
type ProvisioningRun = Parameters<typeof readTenantProvisioningPluginSnapshot>[0];

const prepareProvisioningRetry = async (
  deps: InstanceRegistryServiceDeps,
  run: ProvisioningRun,
  attribution: RetryAttribution
): Promise<
  Readonly<{
    desiredSnapshot: Readonly<Record<string, unknown>>;
    keycloakReconcileRequired: boolean;
  }>
> => {
  await syncProtectedSystemAdminPermissions(deps, run.instanceId);
  await createReconcileModuleActivationPoliciesHandler(deps, { forceIamSync: true })({
    instanceId: run.instanceId,
    actorId: attribution.actorId,
    requestId: attribution.requestId,
  });
  const { desiredSnapshot, lifecycles, keycloakReconcileRequired } =
    rebaseTenantProvisioningPluginSnapshot(run, deps);
  const persistedPluginIds = await deps.repository.persistPluginTenantLifecycleReconcileIntents({
    instanceId: run.instanceId,
    lifecycles,
    forcePluginIds: lifecycles.map(({ pluginId }) => pluginId),
  });
  if (
    persistedPluginIds.length !== lifecycles.length ||
    lifecycles.some(({ pluginId }) => !persistedPluginIds.includes(pluginId))
  ) {
    throw new Error('provisioning_retry_conflict');
  }
  return { desiredSnapshot, keycloakReconcileRequired };
};

const releaseProvisioningRetryReservation = async (
  deps: InstanceRegistryServiceDeps,
  input: {
    readonly instanceId: string;
    readonly idempotencyKey: string;
    readonly leaseOwner: string;
  }
): Promise<void> => {
  try {
    await deps.repository.releaseProvisioningRetryReservation(input);
  } catch {
    // The expiring reservation keeps a failed retry safely recoverable if release is unavailable.
  }
};

export const reserveAndPrepareProvisioningRetry = async (
  deps: InstanceRegistryServiceDeps,
  run: ProvisioningRun,
  attribution: RetryAttribution
) => {
  const leaseOwner = `retry:${randomUUID()}`;
  const reservedRun = await deps.repository.reserveProvisioningRetryRun({
    instanceId: run.instanceId,
    idempotencyKey: run.idempotencyKey,
    leaseOwner,
    leaseExpiresAt: new Date(Date.now() + RETRY_RESERVATION_MILLISECONDS).toISOString(),
  });
  if (!reservedRun) throw new Error('provisioning_retry_conflict');

  try {
    return {
      ...(await prepareProvisioningRetry(deps, run, attribution)),
      leaseOwner,
    };
  } catch (error) {
    await releaseProvisioningRetryReservation(deps, {
      instanceId: run.instanceId,
      idempotencyKey: run.idempotencyKey,
      leaseOwner,
    });
    throw error;
  }
};

export const retryReservedProvisioningRun = async (
  deps: InstanceRegistryServiceDeps,
  input: Parameters<InstanceRegistryServiceDeps['repository']['retryProvisioningRun']>[0]
) => {
  let retriedRun: Awaited<
    ReturnType<InstanceRegistryServiceDeps['repository']['retryProvisioningRun']>
  >;
  try {
    retriedRun = await deps.repository.retryProvisioningRun(input);
  } catch (error) {
    await releaseProvisioningRetryReservation(deps, input);
    throw error;
  }
  if (retriedRun) return retriedRun;
  await releaseProvisioningRetryReservation(deps, input);
  throw new Error('provisioning_retry_conflict');
};
