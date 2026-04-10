import { classifyHost, normalizeHost } from '@sva/core';
import { createSdkLogger } from '@sva/sdk/server';
import type { InstanceRegistryRepository } from '@sva/data';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import type {
  KeycloakTenantPlan,
  KeycloakTenantPreflight,
  KeycloakTenantStatus,
  ResolveRuntimeInstanceResult,
} from './keycloak-types.js';
import type { KeycloakProvisioningInput } from './provisioning-auth-types.js';
import { revealField } from '../iam-account-management/encryption.js';
import { buildPlan, toOverallPreflightStatus } from './provisioning-auth-evaluation.js';
import { toListItem } from './service-helpers.js';
import { createExecuteKeycloakProvisioningHandler, createReconcileKeycloakHandler } from './service-keycloak-execution.js';

const buildAuthClientSecretAad = (instanceId: string): string => `iam.instances.auth_client_secret:${instanceId}`;
const logger = createSdkLogger({ component: 'iam-instance-registry-keycloak', level: 'info' });

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const readSnapshotFromRun = <T>(
  runs: readonly Awaited<ReturnType<InstanceRegistryRepository['listKeycloakProvisioningRuns']>>[number][],
  stepKey: string,
  field: 'status' | 'preflight' | 'plan'
): T | null => {
  for (const run of runs) {
    const step = run.steps.find((candidate) => candidate.stepKey === stepKey);
    if (!isRecord(step?.details)) {
      continue;
    }
    const snapshot = step.details[field];
    if (snapshot) {
      return snapshot as T;
    }
  }
  return null;
};

const buildLocalPreflight = (input: {
  realmMode: 'new' | 'existing';
  authClientSecretConfigured: boolean;
  authClientSecret?: string;
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
      summary: 'Die technische Prüfung wird durch den Provisioning-Worker durchgeführt und ist noch nicht gelaufen.',
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
      status: input.authClientSecretConfigured && input.authClientSecret ? 'ready' : 'blocked',
      summary:
        input.authClientSecretConfigured && input.authClientSecret
          ? 'Ein lesbares Tenant-Client-Secret ist in der Registry vorhanden.'
          : 'Für diese Instanz fehlt ein lesbares Tenant-Client-Secret in der Registry.',
      details: {
        configured: input.authClientSecretConfigured,
        readable: Boolean(input.authClientSecret),
      },
    },
    {
      checkKey: 'tenant_admin_profile',
      title: 'Tenant-Admin-Profil',
      status: input.tenantAdminBootstrap?.username ? 'ready' : 'blocked',
      summary: input.tenantAdminBootstrap?.username
        ? 'Die Stammdaten für den Tenant-Admin sind gepflegt.'
        : 'Für den Tenant-Admin fehlen die erforderlichen Stammdaten.',
      details: { configured: Boolean(input.tenantAdminBootstrap?.username) },
    },
  ];

  return {
    overallStatus: toOverallPreflightStatus(checks),
    checkedAt: new Date().toISOString(),
    checks,
  };
};

const toProvisioningInput = (
  instance: NonNullable<Awaited<ReturnType<InstanceRegistryRepository['getInstanceById']>>>,
  authClientSecret?: string
): KeycloakProvisioningInput => ({
  instanceId: instance.instanceId,
  primaryHostname: instance.primaryHostname,
  realmMode: instance.realmMode,
  authRealm: instance.authRealm,
  authClientId: instance.authClientId,
  authIssuerUrl: instance.authIssuerUrl,
  authClientSecretConfigured: instance.authClientSecretConfigured,
  authClientSecret,
  tenantAdminBootstrap: instance.tenantAdminBootstrap,
});

export const decryptAuthClientSecret = (
  instanceId: string,
  ciphertext: string | null | undefined
): string | undefined => revealField(ciphertext, buildAuthClientSecretAad(instanceId));

export const loadRepositoryAuthClientSecret = async (
  repository: InstanceRegistryRepository,
  instanceId: string
): Promise<string | undefined> => {
  const ciphertext = await repository.getAuthClientSecretCiphertext(instanceId);
  return decryptAuthClientSecret(instanceId, ciphertext);
};

export const loadInstanceWithSecret = async (deps: InstanceRegistryServiceDeps, instanceId: string) => {
  const instance = await deps.repository.getInstanceById(instanceId);
  if (!instance) {
    return null;
  }
  const authClientSecret = await loadRepositoryAuthClientSecret(deps.repository, instance.instanceId);
  return {
    instance,
    authClientSecret,
  };
};

export const createGetKeycloakStatusHandler =
  (deps: InstanceRegistryServiceDeps) =>
  async (instanceId: string): Promise<KeycloakTenantStatus | null> => {
    logger.debug('get_keycloak_status_started', { operation: 'get_keycloak_status', instance_id: instanceId });
    const instance = await deps.repository.getInstanceById(instanceId);
    if (!instance) {
      return null;
    }

    const runs = await deps.repository.listKeycloakProvisioningRuns(instanceId);
    const status = readSnapshotFromRun<KeycloakTenantStatus>(runs, 'status_snapshot', 'status');
    if (!status) {
      return null;
    }

    logger.info('keycloak_status_check_completed', { operation: 'get_keycloak_status', instance_id: instanceId });
    return status;
  };

export const createGetKeycloakPreflightHandler =
  (deps: InstanceRegistryServiceDeps) =>
  async (instanceId: string): Promise<KeycloakTenantPreflight | null> => {
    logger.debug('get_keycloak_preflight_started', { operation: 'get_keycloak_preflight', instance_id: instanceId });
    const loaded = await loadInstanceWithSecret(deps, instanceId);
    if (!loaded) {
      return null;
    }

    const runs = await deps.repository.listKeycloakProvisioningRuns(instanceId);
    const snapshot = readSnapshotFromRun<KeycloakTenantPreflight>(runs, 'worker_preflight_snapshot', 'preflight');
    const result = snapshot ?? buildLocalPreflight({
      realmMode: loaded.instance.realmMode,
      authClientSecretConfigured: loaded.instance.authClientSecretConfigured,
      authClientSecret: loaded.authClientSecret,
      tenantAdminBootstrap: loaded.instance.tenantAdminBootstrap,
    });

    logger.info('keycloak_preflight_completed', { operation: 'get_keycloak_preflight', instance_id: instanceId });
    return result;
  };

export const createPlanKeycloakProvisioningHandler =
  (deps: InstanceRegistryServiceDeps) =>
  async (instanceId: string): Promise<KeycloakTenantPlan | null> => {
    logger.debug('plan_keycloak_provisioning_started', {
      operation: 'plan_keycloak_provisioning',
      instance_id: instanceId,
    });
    const loaded = await loadInstanceWithSecret(deps, instanceId);
    if (!loaded) {
      return null;
    }

    const runs = await deps.repository.listKeycloakProvisioningRuns(instanceId);
    const snapshot = readSnapshotFromRun<KeycloakTenantPlan>(runs, 'worker_plan_snapshot', 'plan');
    if (snapshot) {
      logger.info('keycloak_plan_completed', { operation: 'plan_keycloak_provisioning', instance_id: instanceId });
      return snapshot;
    }

    const preflight = buildLocalPreflight({
      realmMode: loaded.instance.realmMode,
      authClientSecretConfigured: loaded.instance.authClientSecretConfigured,
      authClientSecret: loaded.authClientSecret,
      tenantAdminBootstrap: loaded.instance.tenantAdminBootstrap,
    });
    const plan = buildPlan({
      realmMode: loaded.instance.realmMode,
      authClientSecret: loaded.authClientSecret,
      preflight,
    });

    logger.info('keycloak_plan_completed', { operation: 'plan_keycloak_provisioning', instance_id: instanceId });
    return plan;
  };

export { createExecuteKeycloakProvisioningHandler, createReconcileKeycloakHandler };

export const createGetKeycloakProvisioningRunHandler =
  (deps: InstanceRegistryServiceDeps) =>
  async (instanceId: string, runId: string) => deps.repository.getKeycloakProvisioningRun(instanceId, runId);

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
