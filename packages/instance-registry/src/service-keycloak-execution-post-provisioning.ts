import type { InstanceKeycloakProvisioningRun } from '@sva/core';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import { loadInstanceWithSecret } from './service-keycloak-secrets.js';
import {
  completeRun,
  syncProvisionedClientSecretToRegistry,
  syncRotatedClientSecretToRegistry,
} from './service-keycloak-execution-shared.js';
import type { QueuedProvisioningInput } from './service-keycloak-execution-plan.js';
import {
  annotateInstanceRegistryError,
  readInstanceRegistryStepKey,
  runInstanceRegistryStep,
} from './observability.js';

const syncClientSecretAfterProvisioning = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceKeycloakProvisioningRun,
  loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>
) => {
  if (run.intent === 'rotate_client_secret') {
    await syncRotatedClientSecretToRegistry(deps, {
      loaded,
      requestId: run.requestId,
      actorId: run.actorId,
    });
    return;
  }
  if (run.intent === 'reset_tenant_admin') {
    return;
  }
  await syncProvisionedClientSecretToRegistry(deps, {
    loaded,
    requestId: run.requestId,
    actorId: run.actorId,
  });
};

const syncTenantAdminBootstrapAccountAfterProvisioning = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceKeycloakProvisioningRun,
  loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>
) => {
  if (!deps.syncTenantAdminBootstrapAccount) {
    return;
  }

  await deps.syncTenantAdminBootstrapAccount({
    instanceId: loaded.instance.instanceId,
    tenantAdminBootstrap: loaded.instance.tenantAdminBootstrap,
    tenantAdminClientSecret: loaded.tenantAdminClientSecret,
    requestId: run.requestId,
    actorId: run.actorId,
  });
};

export const cleanupNewRealmAfterPostProvisioningFailure = async (
  deps: InstanceRegistryServiceDeps,
  provisioningInput: QueuedProvisioningInput,
  failure: unknown
): Promise<void> => {
  if (provisioningInput.realmMode !== 'new') return;
  let current;
  try {
    current = await loadInstanceWithSecret(deps, provisioningInput.instanceId);
  } catch (stateError) {
    const cleanupUnverified = new Error(
      'new_realm_cleanup_state_unavailable_requires_manual_action'
    ) as Error & { cause?: unknown };
    cleanupUnverified.cause = stateError;
    throw cleanupUnverified;
  }
  if (!current) return;
  if (current.instance.realmMode === 'existing') {
    const retrySafeFailure = new Error(
      'new_realm_accepted_post_provisioning_sync_failed_retry_safe'
    ) as Error & { cause?: unknown };
    retrySafeFailure.cause = failure;
    throw annotateInstanceRegistryError(
      retrySafeFailure,
      readInstanceRegistryStepKey(failure) ?? 'admin_bootstrap'
    );
  }
  if (current.instance.realmMode !== 'new') return;
  if (!deps.deleteProvisionedRealm) {
    const cleanupUnavailable = new Error(
      'new_realm_post_provisioning_cleanup_unavailable_requires_manual_action'
    ) as Error & { cause?: unknown };
    cleanupUnavailable.cause = failure;
    throw cleanupUnavailable;
  }
  try {
    await deps.deleteProvisionedRealm(provisioningInput.authRealm);
  } catch (cleanupError) {
    const manualActionError = new Error(
      'new_realm_post_provisioning_cleanup_failed_requires_manual_action'
    ) as Error & { cause?: unknown };
    manualActionError.cause = cleanupError;
    throw manualActionError;
  }
};

export const finalizeProvisionedRun = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceKeycloakProvisioningRun,
  loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>,
  tenantAdminTemporaryPassword: string | undefined,
  provisioningInput: QueuedProvisioningInput
) => {
  try {
    await runInstanceRegistryStep('secret_sync', () =>
      syncClientSecretAfterProvisioning(deps, run, loaded)
    );
    const finalRunStatus = await runInstanceRegistryStep('worker_complete', () =>
      completeRun(deps, {
        loaded,
        runId: run.id,
        requestId: run.requestId,
        actorId: run.actorId,
        intent: run.intent,
        tenantAdminTemporaryPassword,
        pluginOidcClients: provisioningInput.pluginOidcClients,
      })
    );
    if (finalRunStatus === 'succeeded') {
      await runInstanceRegistryStep('admin_bootstrap', () =>
        syncTenantAdminBootstrapAccountAfterProvisioning(deps, run, loaded)
      );
    }
    return finalRunStatus;
  } catch (error) {
    await cleanupNewRealmAfterPostProvisioningFailure(deps, provisioningInput, error);
    throw error;
  }
};
