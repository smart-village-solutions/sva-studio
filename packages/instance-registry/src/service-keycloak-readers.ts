import { classifyHost, normalizeHost } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';
import type { InstanceRegistryRepository } from '@sva/data-repositories';

import type { InstanceRegistryServiceDeps } from './service-types.js';
import type {
  KeycloakTenantPlan,
  KeycloakTenantPreflight,
  KeycloakTenantStatus,
  ResolveRuntimeInstanceResult,
} from './keycloak-types.js';
import {
  buildMissingRealmStatus,
  buildPlan,
  toOverallPreflightStatus,
} from './provisioning-auth-evaluation.js';
import {
  buildKeycloakSnapshotInputFingerprint,
  KEYCLOAK_SNAPSHOT_POLICY_VERSION,
} from './provisioning-auth-policy.js';
import { toListItem } from './service-helpers.js';
import {
  readLatestQueuedPluginOidcClientRequirements,
  readQueuedPluginOidcClientRequirements,
} from './service-keycloak-execution-payload.js';
import type { PluginOidcClientRequirement } from './provisioning-auth-types.js';
import {
  loadInstanceWithSecret,
  loadPersistedSnapshotSecretVersions,
  loadRepositoryAuthClientSecret,
  loadRepositoryTenantAdminClientSecret,
} from './service-keycloak-secrets.js';
import {
  isRealmBaselineApplicable,
  readManagedRealmPlanSnapshot,
  readSnapshotFromRuns,
  refreshManagedRealmSmtpPasswordStatus,
} from './service-keycloak-snapshot-reader.js';
const logger = createSdkLogger({ component: 'iam-instance-registry-keycloak', level: 'info' });

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

const buildSnapshotInputFingerprintForRun = (
  deps: InstanceRegistryServiceDeps,
  run: Awaited<ReturnType<InstanceRegistryRepository['listKeycloakProvisioningRuns']>>[number],
  instance: Parameters<typeof buildKeycloakSnapshotInputFingerprint>[0],
  secretVersions: Parameters<typeof buildKeycloakSnapshotInputFingerprint>[1]
): string | readonly string[] => {
  const queued = run.steps.find((step) => step.stepKey === 'queued');
  if (!queued) {
    return buildKeycloakSnapshotInputFingerprint(
      instance,
      secretVersions,
      deps.readPluginOidcClientRequirements?.()
    );
  }
  try {
    return buildKeycloakSnapshotInputFingerprint(
      instance,
      secretVersions,
      readQueuedPluginOidcClientRequirements(queued.details, instance)
    );
  } catch {
    return [];
  }
};
const buildLocalPreflight = (input: {
  realmMode: 'new' | 'existing';
  authClientSecretConfigured: boolean;
  authClientSecret?: string;
  tenantAdminClient?: {
    clientId: string;
    secretConfigured: boolean;
  };
  tenantAdminClientSecret?: string;
  tenantAdminBootstrap?: {
    username: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
}): KeycloakTenantPreflight => {
  const checks: KeycloakTenantPreflight['checks'] = [
    {
      checkKey: 'platform_access',
      title: 'Plattformzugriff',
      status: 'ready',
      summary: 'Der aufrufende Benutzer ist für die Root-Host-Instanzverwaltung autorisiert.',
      details: {},
    },
    {
      checkKey: 'keycloak_admin_access',
      title: 'Technischer Keycloak-Zugriff',
      status: 'warning',
      summary:
        'Die technische Prüfung wird durch den Provisioning-Worker durchgeführt und ist noch nicht gelaufen.',
      details: { source: 'worker_pending' },
    },
    {
      checkKey: 'realm_mode',
      title: 'Realm-Modus',
      status: 'warning',
      summary:
        input.realmMode === 'new'
          ? 'Der Ziel-Realm wird beim nächsten Worker-Lauf angelegt.'
          : 'Der Ziel-Realm wird beim nächsten Worker-Lauf geprüft und abgeglichen.',
      details: { realmMode: input.realmMode, source: 'worker_pending' },
    },
    {
      checkKey: 'tenant_secret',
      title: 'Tenant-Client-Secret',
      status: input.authClientSecretConfigured && input.authClientSecret ? 'ready' : 'warning',
      summary:
        input.authClientSecretConfigured && input.authClientSecret
          ? 'Ein lesbares Tenant-Client-Secret ist in der Registry vorhanden.'
          : input.realmMode === 'new'
            ? 'Das Tenant-Client-Secret wird beim Anlegen des neuen Realm automatisch erzeugt und danach gespeichert.'
            : 'Das Tenant-Client-Secret wird beim nächsten Worker-Lauf geprüft und bei Bedarf nachgezogen.',
      details: {
        configured: input.authClientSecretConfigured,
        readable: Boolean(input.authClientSecret),
        source: 'worker_pending',
        generatedDuringProvisioning: input.realmMode === 'new',
      },
    },
    {
      checkKey: 'tenant_admin_profile',
      title: 'Tenant-Admin-Profil',
      status: input.tenantAdminBootstrap?.username ? 'ready' : 'warning',
      summary: input.tenantAdminBootstrap?.username
        ? 'Die Stammdaten für den Tenant-Admin sind gepflegt.'
        : 'Das Tenant-Admin-Profil wird beim nächsten Worker-Lauf geprüft und ergänzt.',
      details: {
        configured: Boolean(input.tenantAdminBootstrap?.username),
        source: 'worker_pending',
      },
    },
    {
      checkKey: 'tenant_admin_client',
      title: 'Tenant-Admin-Client',
      status: input.tenantAdminClient?.clientId ? 'ready' : 'warning',
      summary: input.tenantAdminClient?.clientId
        ? 'Der technische Tenant-Admin-Client ist im Instanzvertrag gepflegt.'
        : 'Der technische Tenant-Admin-Client wird beim nächsten Worker-Lauf angelegt oder ergänzt.',
      details: {
        configured: Boolean(input.tenantAdminClient?.clientId),
        clientId: input.tenantAdminClient?.clientId,
        secretConfigured: input.tenantAdminClient?.secretConfigured ?? false,
        readable: Boolean(input.tenantAdminClientSecret),
        source: 'worker_pending',
      },
    },
  ];

  return {
    overallStatus: toOverallPreflightStatus(checks),
    checkedAt: new Date().toISOString(),
    checks,
  };
};
const buildLocalStatus = (input: {
  authClientSecretConfigured: boolean;
  authClientSecret?: string;
  tenantAdminClient?: {
    clientId: string;
    secretConfigured: boolean;
  };
  tenantAdminClientSecret?: string;
}): KeycloakTenantStatus =>
  buildMissingRealmStatus(
    input.authClientSecretConfigured,
    input.authClientSecret,
    input.tenantAdminClient,
    input.tenantAdminClientSecret
  );
export const createGetKeycloakStatusHandler =
  (deps: InstanceRegistryServiceDeps) =>
  async (instanceId: string): Promise<KeycloakTenantStatus | null> => {
    logger.debug('get_keycloak_status_started', {
      operation: 'get_keycloak_status',
      instance_id: instanceId,
    });
    const instance = await deps.repository.getInstanceById(instanceId);
    if (!instance) {
      return null;
    }

    const runs = await deps.repository.listKeycloakProvisioningRuns(instanceId);
    const secretVersions = await loadPersistedSnapshotSecretVersions(
      deps.repository,
      runs,
      ['status_snapshot'],
      KEYCLOAK_SNAPSHOT_POLICY_VERSION,
      instanceId
    );
    const inputFingerprint = (run: (typeof runs)[number]) =>
      buildSnapshotInputFingerprintForRun(deps, run, instance, secretVersions);
    const status = readSnapshotFromRuns<KeycloakTenantStatus>(
      runs,
      ['status_snapshot'],
      'status',
      KEYCLOAK_SNAPSHOT_POLICY_VERSION,
      inputFingerprint
    );
    if (status) {
      const refreshedStatus = await refreshManagedRealmSmtpPasswordStatus(
        deps,
        instance,
        runs,
        secretVersions,
        status
      );
      logger.info('keycloak_status_check_completed', {
        operation: 'get_keycloak_status',
        instance_id: instanceId,
      });
      return refreshedStatus;
    }

    let authClientSecret: string | undefined;
    let tenantAdminClientSecret: string | undefined;
    if (deps.revealSecret) {
      authClientSecret = await loadRepositoryAuthClientSecret(
        deps,
        deps.repository,
        instance.instanceId
      );
      tenantAdminClientSecret = await loadRepositoryTenantAdminClientSecret(
        deps,
        deps.repository,
        instance.instanceId
      );
    }

    const result = buildLocalStatus({
      authClientSecretConfigured: instance.authClientSecretConfigured,
      authClientSecret,
      tenantAdminClient: instance.tenantAdminClient,
      tenantAdminClientSecret,
    });

    logger.info('keycloak_status_check_completed', {
      operation: 'get_keycloak_status',
      instance_id: instanceId,
    });
    return result;
  };

export const createGetKeycloakPreflightHandler =
  (deps: InstanceRegistryServiceDeps) =>
  async (instanceId: string): Promise<KeycloakTenantPreflight | null> => {
    logger.debug('get_keycloak_preflight_started', {
      operation: 'get_keycloak_preflight',
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
      ['status_snapshot', 'worker_preflight_snapshot'],
      KEYCLOAK_SNAPSHOT_POLICY_VERSION,
      instanceId
    );
    const snapshot = readSnapshotFromRuns<KeycloakTenantPreflight>(
      runs,
      ['status_snapshot', 'worker_preflight_snapshot'],
      'preflight',
      KEYCLOAK_SNAPSHOT_POLICY_VERSION,
      (run) => buildSnapshotInputFingerprintForRun(deps, run, loaded.instance, secretVersions)
    );
    const result =
      snapshot ??
      buildLocalPreflight({
        realmMode: loaded.instance.realmMode,
        authClientSecretConfigured: loaded.instance.authClientSecretConfigured,
        authClientSecret: loaded.authClientSecret,
        tenantAdminClient: loaded.instance.tenantAdminClient,
        tenantAdminClientSecret: loaded.tenantAdminClientSecret,
        tenantAdminBootstrap: loaded.instance.tenantAdminBootstrap,
      });

    logger.info('keycloak_preflight_completed', {
      operation: 'get_keycloak_preflight',
      instance_id: instanceId,
    });
    return result;
  };

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
    if (options?.forceLive) {
      if (!deps.planKeycloakProvisioning) return null;
      const plan = await deps.planKeycloakProvisioning({
        ...loaded.instance,
        authClientSecret: loaded.authClientSecret,
        tenantAdminClientSecret: loaded.tenantAdminClientSecret,
        pluginOidcClients,
      });
      logger.info('keycloak_plan_completed', {
        operation: 'plan_keycloak_provisioning',
        instance_id: instanceId,
      });
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
      logger.info('keycloak_plan_completed', {
        operation: 'plan_keycloak_provisioning',
        instance_id: instanceId,
      });
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
      realmBaselineApplicable: isRealmBaselineApplicable(
        loaded.instance.realmMode,
        runs,
        loaded.instance.authRealm,
        loaded.instance.authClientId
      ),
      preflight,
    });
    logger.info('keycloak_plan_completed', {
      operation: 'plan_keycloak_provisioning',
      instance_id: instanceId,
    });
    return plan;
  };

export const createGetKeycloakProvisioningRunHandler =
  (deps: InstanceRegistryServiceDeps) => async (instanceId: string, runId: string) =>
    deps.repository.getKeycloakProvisioningRun(instanceId, runId);

export const createRuntimeResolver =
  (repository: InstanceRegistryRepository) =>
  async (host: string): Promise<ResolveRuntimeInstanceResult> => {
    const normalizedHost = normalizeHost(host);
    const instance = await repository.resolveHostname(normalizedHost);
    if (!instance) {
      return {
        hostClassification: {
          kind: 'invalid',
          normalizedHost,
          reason: 'unknown_host',
        },
        instance: null,
      };
    }

    return {
      hostClassification: classifyHost(normalizedHost, instance.parentDomain),
      instance: toListItem(instance),
    };
  };
