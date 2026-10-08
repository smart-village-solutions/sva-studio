import type { InstanceRegistryRepository } from '@sva/data-repositories';
import { createSdkLogger } from '@sva/server-runtime';
import { buildKeycloakPlanLogFields } from './observability.js';
import type { KeycloakTenantPlan } from './keycloak-types.js';
import { buildMissingRealmReadState } from './provisioning-auth-state.js';
import { buildPlan } from './provisioning-auth-evaluation.js';
import { KEYCLOAK_SNAPSHOT_POLICY_VERSION } from './provisioning-auth-policy.js';
import type { PluginOidcClientRequirement } from './provisioning-auth-types.js';
import { readLatestQueuedPluginOidcClientRequirements } from './service-keycloak-execution-payload.js';
import { buildLocalPreflight } from './service-keycloak-readers-preflight.js';
import {
  loadInstanceWithSecret,
  loadPersistedSnapshotSecretVersions,
} from './service-keycloak-secrets.js';
import {
  buildSnapshotInputFingerprintForRun,
  loadRealmBaselineApplicability,
  readManagedRealmPlanSnapshot,
} from './service-keycloak-snapshot-reader.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-keycloak', level: 'info' });

const logKeycloakPlanCompleted = (
  instanceId: string,
  planSource: 'live' | 'local' | 'snapshot',
  plan: KeycloakTenantPlan
): void => {
  logger.info('keycloak_plan_completed', {
    operation: 'plan_keycloak_provisioning',
    result: 'completed',
    instance_id: instanceId,
    plan_source: planSource,
    snapshot_policy_version: KEYCLOAK_SNAPSHOT_POLICY_VERSION,
    ...buildKeycloakPlanLogFields(plan),
  });
};

const readPluginOidcClients = (
  deps: InstanceRegistryServiceDeps,
  runs: Awaited<ReturnType<InstanceRegistryRepository['listKeycloakProvisioningRuns']>>,
  instance: {
    readonly authClientId: string;
    readonly tenantAdminClient?: { readonly clientId: string; readonly secretConfigured?: boolean };
  }
): readonly PluginOidcClientRequirement[] =>
  readLatestQueuedPluginOidcClientRequirements(
    runs,
    instance,
    deps.readPluginOidcClientRequirements?.()
  );

export const createPlanKeycloakProvisioningHandler =
  (deps: InstanceRegistryServiceDeps) =>
  async (
    instanceId: string,
    options?: { readonly forceLive?: boolean }
  ): Promise<KeycloakTenantPlan | null> => {
    logger.debug('plan_keycloak_provisioning_started', {
      operation: 'plan_keycloak_provisioning',
      instance_id: instanceId,
    });
    const loaded = await loadInstanceWithSecret(deps, instanceId);
    if (!loaded) {
      return null;
    }
    const runs = await deps.repository.listKeycloakProvisioningRuns(instanceId);
    const secretVersions = await loadPersistedSnapshotSecretVersions(
      deps.repository,
      runs,
      ['status_snapshot', 'worker_plan_snapshot'],
      KEYCLOAK_SNAPSHOT_POLICY_VERSION,
      instanceId
    );
    const pluginOidcClients = readPluginOidcClients(deps, runs, loaded.instance);
    const inputFingerprint = (run: (typeof runs)[number]) =>
      buildSnapshotInputFingerprintForRun(deps, run, loaded.instance, secretVersions);
    const realmBaselineApplicable = await loadRealmBaselineApplicability(
      deps,
      loaded.instance,
      runs
    );
    // A local preview cannot confirm which clients/users already exist in an imported realm.
    const requiresLiveBootstrapPlan =
      loaded.instance.realmMode === 'existing' && !loaded.authClientSecret;
    if (options?.forceLive || requiresLiveBootstrapPlan) {
      if (!deps.planKeycloakProvisioning) return null;
      const completedNewRealmRun =
        loaded.instance.realmMode === 'new' &&
        runs[0]?.mode === 'new' &&
        runs[0].overallStatus === 'succeeded';
      const plan = await deps.planKeycloakProvisioning({
        ...loaded.instance,
        ...(completedNewRealmRun ? { realmMode: 'existing' as const } : {}),
        authClientSecret: loaded.authClientSecret,
        tenantAdminClientSecret: loaded.tenantAdminClientSecret,
        pluginOidcClients,
        realmBaselineApplicable,
      });
      logKeycloakPlanCompleted(instanceId, 'live', plan);
      return plan;
    }
    const snapshot = await readManagedRealmPlanSnapshot(
      deps,
      loaded.instance,
      runs,
      secretVersions,
      inputFingerprint
    );
    if (snapshot) {
      logKeycloakPlanCompleted(instanceId, 'snapshot', snapshot);
      return snapshot;
    }
    const preflight = buildLocalPreflight({
      realmMode: loaded.instance.realmMode,
      authClientSecretConfigured: loaded.instance.authClientSecretConfigured,
      authClientSecret: loaded.authClientSecret,
      tenantAdminClient: loaded.instance.tenantAdminClient,
      tenantAdminClientSecret: loaded.tenantAdminClientSecret,
      tenantAdminBootstrap: loaded.instance.tenantAdminBootstrap,
    });
    const plan = buildPlan({
      instanceId: loaded.instance.instanceId,
      realmMode: loaded.instance.realmMode,
      authClientSecret: loaded.authClientSecret,
      tenantAdminClient: loaded.instance.tenantAdminClient,
      tenantAdminClientSecret: loaded.tenantAdminClientSecret,
      tenantAdminBootstrap: loaded.instance.tenantAdminBootstrap,
      pluginOidcClients,
      state:
        loaded.instance.realmMode === 'new'
          ? buildMissingRealmReadState(loaded.instance)
          : undefined,
      realmBaselineApplicable,
      preflight,
    });
    logKeycloakPlanCompleted(instanceId, 'local', plan);
    return plan;
  };
