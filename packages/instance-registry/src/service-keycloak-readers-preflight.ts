import { createSdkLogger } from '@sva/server-runtime';
import type { KeycloakTenantPreflight } from './keycloak-types.js';
import { toOverallPreflightStatus } from './provisioning-auth-evaluation.js';
import { KEYCLOAK_SNAPSHOT_POLICY_VERSION } from './provisioning-auth-policy.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import {
  loadInstanceWithSecret,
  loadPersistedSnapshotSecretVersions,
} from './service-keycloak-secrets.js';
import {
  buildSnapshotInputFingerprintForRun,
  readSnapshotFromRuns,
} from './service-keycloak-snapshot-reader.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-keycloak', level: 'info' });

export const buildLocalPreflight = (input: {
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
