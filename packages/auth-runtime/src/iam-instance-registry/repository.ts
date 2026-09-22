import { createPoolResolver } from '../db.js';
import { createInstanceRegistryRepository } from '@sva/data-repositories';
import {
  invalidateInstanceRegistryHost,
  loadWasteDataSourceRecord,
  saveWasteDataSourceRecord,
} from '@sva/data-repositories/server';
import { createInstanceRegistryRuntime } from '@sva/instance-registry/runtime-wiring';
import { createSdkLogger, getInstanceConfig } from '@sva/server-runtime';
import {
  readInstanceRegistryModuleIamRegistry,
  readInstanceRegistryPluginActivationPolicies,
  readInstanceRegistryPluginOidcClientRequirements,
  readInstanceRegistryPluginTenantLifecycleRegistry,
} from './plugin-activation-policy-snapshot.js';
import { notifyPermissionInvalidation } from '../iam-account-management/shared-activity.js';
import {
  deleteProvisionedRealmViaProvisioner,
  getInstanceKeycloakPlanViaProvisioner,
  getInstanceKeycloakPreflightViaProvisioner,
  getInstanceKeycloakStatusViaTenantAdmin,
  getInstanceKeycloakStatusViaProvisioner,
  provisionInstanceAuthArtifactsViaProvisioner,
} from './provisioning-auth.js';
import {
  listKeycloakRealmsViaProvisioner,
  readKeycloakRealmCreateCapabilityViaProvisioner,
  readKeycloakStateViaProvisioner,
} from './provisioning-auth-state.js';
import { protectField, revealField } from '../iam-account-management/encryption.js';
import { getIamDatabaseUrl } from '../runtime-secrets.js';
import { syncTenantAdminBootstrapAccount } from './tenant-admin-bootstrap-sync.js';
import { resolveConfiguredProvisioningAuthIssuerUrl } from '../kassel-provisioning-auth.js';
import { probeTenantIamAccess, reconcileTenantIamRoles } from './tenant-provisioning-iam.js';
import { readRoleCatalogFingerprint } from '../iam-account-management/reconcile-core.js';
import {
  projectAccountInvitationTemplate,
  readAccountInvitationProjection,
} from './account-invitation-projection.js';

const pluginTenantLifecycleLogger = createSdkLogger({
  component: 'plugin-tenant-lifecycle-scheduler',
  level: 'info',
});
const resolvePool = createPoolResolver(getIamDatabaseUrl);
export const closeInstanceRegistryRepositoryPoolForShutdown = async (): Promise<void> => {
  await resolvePool()?.end();
};
const readPersistablePluginTenantLifecycleRegistry = () =>
  new Map(
    [...readInstanceRegistryPluginTenantLifecycleRegistry()].flatMap(([pluginId, lifecycle]) =>
      lifecycle.contractRevision
        ? [[pluginId, { ...lifecycle, contractRevision: lifecycle.contractRevision }] as const]
        : []
    )
  );

const readReservedPluginOidcClientIds = (): readonly string[] =>
  readInstanceRegistryPluginOidcClientRequirements().map(({ clientId }) => clientId);

const readConfiguredProvisioningModuleReadiness: NonNullable<
  Parameters<
    typeof createInstanceRegistryRuntime
  >[0]['serviceDeps']['readProvisioningModuleReadiness']
> = async (input) => {
  const { readProvisioningModuleReadiness } =
    await import('../plugin-tenant-lifecycle/read-model.js');
  return readProvisioningModuleReadiness(input);
};

export const runConfiguredPluginTenantProvisioningSchedule = async (
  instanceId: string
): Promise<void> => {
  const { ensureConfiguredPluginTenantProvisioning } =
    await import('../plugin-tenant-lifecycle/runtime.js');
  await ensureConfiguredPluginTenantProvisioning(instanceId);
};

export const scheduleConfiguredPluginTenantProvisioning = (instanceId: string): void => {
  void runConfiguredPluginTenantProvisioningSchedule(instanceId).catch((error) => {
    pluginTenantLifecycleLogger.error('plugin_tenant_lifecycle_schedule_failed', {
      operation: 'plugin_tenant_lifecycle_schedule',
      result: 'failed',
      error_code: 'plugin_tenant_lifecycle_schedule_failed',
      error_type: error instanceof Error ? error.name : typeof error,
      instance_id: instanceId,
    });
  });
};

const getWorkerKeycloakPreflight = async (
  input: Parameters<typeof getInstanceKeycloakPreflightViaProvisioner>[0]
) => getInstanceKeycloakPreflightViaProvisioner(input);

const getWorkerKeycloakPlan = async (
  input: Parameters<typeof getInstanceKeycloakPlanViaProvisioner>[0]
) => getInstanceKeycloakPlanViaProvisioner(input);

const getWorkerKeycloakStatus = async (
  input: Parameters<typeof getInstanceKeycloakStatusViaProvisioner>[0]
) => getInstanceKeycloakStatusViaProvisioner(input);

const getTenantAuditKeycloakStatus = async (
  input: Parameters<typeof getInstanceKeycloakStatusViaTenantAdmin>[0]
) => getInstanceKeycloakStatusViaTenantAdmin(input);

const invalidateInstancePermissionSnapshots = async (input: {
  instanceId: string;
  trigger: string;
}) => {
  const pool = resolvePool();
  if (!pool) {
    throw new Error('IAM database not configured');
  }

  const client = await pool.connect();
  try {
    await notifyPermissionInvalidation(client, {
      instanceId: input.instanceId,
      trigger: input.trigger,
    });
  } finally {
    client.release();
  }
};

const readReservedInstanceHostnames = (): readonly string[] => {
  const config = getInstanceConfig();
  return config ? [config.canonicalAuthHost] : [];
};

const registryRuntime = createInstanceRegistryRuntime({
  resolvePool,
  createRepository: createInstanceRegistryRepository,
  serviceDeps: {
    invalidateHost: invalidateInstanceRegistryHost,
    projectAccountInvitationTemplate,
    readAccountInvitationProjection,
    resolveProvisioningAuthIssuerUrl: resolveConfiguredProvisioningAuthIssuerUrl,
    isAutomatedTenantProvisioningEnabled: ({ parentDomain }) =>
      process.env.SVA_TENANT_INGRESS_MODE === 'kassel-traefik-file' &&
      parentDomain === 'dialog.kassel.de',
    reservedOidcClientIds: readReservedPluginOidcClientIds,
    reservedHostnames: readReservedInstanceHostnames,
    invalidatePermissionSnapshots: invalidateInstancePermissionSnapshots,
    get moduleIamRegistry() {
      return readInstanceRegistryModuleIamRegistry();
    },
    get pluginTenantLifecycleRegistry() {
      return readPersistablePluginTenantLifecycleRegistry();
    },
    readModuleActivationPolicySnapshot: readInstanceRegistryPluginActivationPolicies,
    readPluginOidcClientRequirements: readInstanceRegistryPluginOidcClientRequirements,
    readRoleCatalogFingerprint,
    readKeycloakStateViaProvisioner,
    listKeycloakRealms: listKeycloakRealmsViaProvisioner,
    readKeycloakRealmCreateCapability: readKeycloakRealmCreateCapabilityViaProvisioner,
    protectSecret: protectField,
    revealSecret: revealField,
    loadWasteDataSourceRecord,
    saveWasteDataSourceRecord,
    readProvisioningModuleReadiness: readConfiguredProvisioningModuleReadiness,
    planKeycloakProvisioning: getWorkerKeycloakPlan,
    getKeycloakStatus: getTenantAuditKeycloakStatus,
    probeTenantIamAccess,
  },
  afterModuleActivationPolicyReconcile: ({ instanceId }) =>
    runConfiguredPluginTenantProvisioningSchedule(instanceId),
  provisioningWorkerServiceDeps: {
    invalidateHost: invalidateInstanceRegistryHost,
    resolveProvisioningAuthIssuerUrl: resolveConfiguredProvisioningAuthIssuerUrl,
    reservedOidcClientIds: readReservedPluginOidcClientIds,
    reservedHostnames: readReservedInstanceHostnames,
    invalidatePermissionSnapshots: invalidateInstancePermissionSnapshots,
    get moduleIamRegistry() {
      return readInstanceRegistryModuleIamRegistry();
    },
    get pluginTenantLifecycleRegistry() {
      return readPersistablePluginTenantLifecycleRegistry();
    },
    readModuleActivationPolicySnapshot: readInstanceRegistryPluginActivationPolicies,
    readPluginOidcClientRequirements: readInstanceRegistryPluginOidcClientRequirements,
    readRoleCatalogFingerprint,
    protectSecret: protectField,
    revealSecret: revealField,
    syncTenantAdminBootstrapAccount,
    loadWasteDataSourceRecord,
    saveWasteDataSourceRecord,
    readKeycloakStateViaProvisioner,
    provisionInstanceAuth: provisionInstanceAuthArtifactsViaProvisioner,
    deleteProvisionedRealm: deleteProvisionedRealmViaProvisioner,
    getKeycloakPreflight: getWorkerKeycloakPreflight,
    planKeycloakProvisioning: getWorkerKeycloakPlan,
    getKeycloakStatus: getWorkerKeycloakStatus,
    probeTenantIamAccess,
    reconcileTenantIamRoles,
  },
});

export const {
  withRegistryRepository,
  withScopedRegistryRepository,
  withRegistryService,
  withRegistryCreateService,
  withScopedRegistryService,
  withRegistryProvisioningWorkerService,
  withRegistryProvisioningWorkerDeps,
} = registryRuntime;
