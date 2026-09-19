import { randomUUID } from 'node:crypto';

import { createReconcileModuleActivationPoliciesHandler } from './service-module-activation.js';
import { syncProtectedSystemAdminPermissions } from './service-module-mutations.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import {
  readTenantProvisioningPluginSnapshot,
  rebaseTenantProvisioningPluginSnapshot,
} from './tenant-provisioning-snapshot.js';

const RETRY_RESERVATION_MILLISECONDS = 5 * 60 * 1000;
const RETRY_RESERVATION_HEARTBEAT_MILLISECONDS = 15 * 1000;

type RetryAttribution = { readonly actorId?: string; readonly requestId?: string };
type ProvisioningRun = Parameters<typeof readTenantProvisioningPluginSnapshot>[0];
type RetryReservationInput = {
  readonly instanceId: string;
  readonly idempotencyKey: string;
  readonly leaseOwner: string;
  readonly leaseExpiresAt: string;
};

const prepareProvisioningRetry = async (
  deps: InstanceRegistryServiceDeps,
  run: ProvisioningRun,
  attribution: RetryAttribution,
  assertReservationActive: () => void
): Promise<
  Readonly<{
    desiredSnapshot: Readonly<Record<string, unknown>>;
    keycloakReconcileRequired: boolean;
  }>
> => {
  assertReservationActive();
  await syncProtectedSystemAdminPermissions(deps, run.instanceId);
  assertReservationActive();
  await createReconcileModuleActivationPoliciesHandler(deps, { forceIamSync: true })({
    instanceId: run.instanceId,
    actorId: attribution.actorId,
    requestId: attribution.requestId,
  });
  assertReservationActive();
  const { desiredSnapshot, lifecycles, keycloakReconcileRequired } =
    rebaseTenantProvisioningPluginSnapshot(run, deps);
  const persistedPluginIds = await deps.repository.persistPluginTenantLifecycleReconcileIntents({
    instanceId: run.instanceId,
    lifecycles,
    forcePluginIds: lifecycles.map(({ pluginId }) => pluginId),
  });
  assertReservationActive();
  if (
    persistedPluginIds.length !== lifecycles.length ||
    lifecycles.some(({ pluginId }) => !persistedPluginIds.includes(pluginId))
  ) {
    throw new Error('provisioning_retry_conflict');
  }
  return { desiredSnapshot, keycloakReconcileRequired };
};

const executeWithRetryReservationHeartbeat = async <T>(
  deps: InstanceRegistryServiceDeps,
  input: RetryReservationInput,
  execute: (assertReservationActive: () => void) => Promise<T>
): Promise<T> => {
  let reservationFailure: Error | undefined;
  let stopped = false;
  const renewReservation = async (): Promise<void> => {
    const renewed = await deps.repository.renewProvisioningRetryReservation({
      ...input,
      leaseExpiresAt: new Date(Date.now() + RETRY_RESERVATION_MILLISECONDS).toISOString(),
    });
    if (!renewed) throw new Error('provisioning_retry_conflict');
  };
  await renewReservation();
  let renewal: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (renewal) return;
    renewal = renewReservation()
      .catch(() => {
        if (!stopped) reservationFailure = new Error('provisioning_retry_conflict');
      })
      .finally(() => {
        renewal = undefined;
      });
  }, RETRY_RESERVATION_HEARTBEAT_MILLISECONDS);
  timer.unref();
  const assertReservationActive = () => {
    if (reservationFailure) throw reservationFailure;
  };
  try {
    const result = await execute(assertReservationActive);
    assertReservationActive();
    return result;
  } finally {
    stopped = true;
    clearInterval(timer);
  }
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
  const reservation = {
    instanceId: run.instanceId,
    idempotencyKey: run.idempotencyKey,
    leaseOwner,
    leaseExpiresAt: new Date(Date.now() + RETRY_RESERVATION_MILLISECONDS).toISOString(),
  };
  const reservedRun = await deps.repository.reserveProvisioningRetryRun(reservation);
  if (!reservedRun) throw new Error('provisioning_retry_conflict');

  try {
    return {
      ...(await executeWithRetryReservationHeartbeat(deps, reservation, (assertReservationActive) =>
        prepareProvisioningRetry(deps, run, attribution, assertReservationActive)
      )),
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
