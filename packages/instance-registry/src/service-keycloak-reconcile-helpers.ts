import { buildProvisioningInput } from './service-keycloak-execution-shared.js';
import { loadRealmBaselineApplicability } from './service-keycloak-snapshot-reader.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

type LoadedInstanceForReconcile = {
  readonly instance: {
    readonly realmMode: string;
    readonly tenantAdminClient?: {
      readonly clientId?: string | null;
    } | null;
  };
  readonly tenantAdminClientSecret?: string | null;
};

const buildBlockingSummary = (
  preflight:
    | Awaited<ReturnType<NonNullable<InstanceRegistryServiceDeps['getKeycloakPreflight']>>>
    | undefined,
  plan:
    | Awaited<ReturnType<NonNullable<InstanceRegistryServiceDeps['planKeycloakProvisioning']>>>
    | undefined
) => {
  if (preflight?.overallStatus === 'blocked') {
    return preflight.checks
      .filter((check) => check.status === 'blocked')
      .map((check) => check.summary)
      .filter((summary) => summary.length > 0)
      .join(' ');
  }

  if (plan?.overallStatus === 'blocked') {
    return plan.driftSummary;
  }

  return '';
};

export const buildProvisioningExecutionOptions = (
  intent: 'provision' | 'provision_admin_client' | 'rotate_client_secret' | 'reset_tenant_admin'
) => ({
  reconcileAuthClient: intent !== 'reset_tenant_admin',
  reconcileTenantAdminClient: intent !== 'reset_tenant_admin',
});

export const shouldReconcileTenantAdminClient = (loaded: LoadedInstanceForReconcile) => {
  if (loaded.instance.realmMode !== 'existing') {
    return false;
  }

  const clientId = loaded.instance.tenantAdminClient?.clientId?.trim();
  if (!clientId) {
    return true;
  }

  return !loaded.tenantAdminClientSecret;
};

export const resolveReconcileIntent = (
  loaded: LoadedInstanceForReconcile,
  rotateClientSecret: boolean | undefined
) => {
  if (rotateClientSecret) {
    return 'rotate_client_secret' as const;
  }

  return shouldReconcileTenantAdminClient(loaded) ? 'provision_admin_client' : 'provision';
};

export const ensureReconcilePreconditions = async (
  deps: InstanceRegistryServiceDeps,
  loaded: Parameters<typeof buildProvisioningInput>[0],
  options: { readonly allowMissingTenantSecret?: boolean } = {}
): Promise<void> => {
  const provisioningInput = buildProvisioningInput(loaded);
  const realmBaselineApplicable = await loadRealmBaselineApplicability(deps, loaded.instance);
  const [preflight, plan] = await Promise.all([
    deps.getKeycloakPreflight?.(provisioningInput),
    deps.planKeycloakProvisioning?.({ ...provisioningInput, realmBaselineApplicable }),
  ]);

  const blockingChecks =
    preflight?.checks.filter(
      (check) =>
        check.status === 'blocked' &&
        !(options.allowMissingTenantSecret && check.checkKey === 'tenant_secret')
    ) ?? [];
  const missingTenantSecretIsOnlyBlocker =
    options.allowMissingTenantSecret &&
    preflight?.overallStatus === 'blocked' &&
    preflight.checks.some(
      (check) => check.status === 'blocked' && check.checkKey === 'tenant_secret'
    ) &&
    blockingChecks.length === 0;

  if (
    blockingChecks.length > 0 ||
    (preflight?.overallStatus === 'blocked' && !missingTenantSecretIsOnlyBlocker) ||
    (plan?.overallStatus === 'blocked' && !missingTenantSecretIsOnlyBlocker)
  ) {
    throw new Error(
      `registry_or_provisioning_drift_blocked:${buildBlockingSummary(preflight, plan) || 'Provisioning blockiert.'}`
    );
  }
};
