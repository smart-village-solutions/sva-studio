import { createSdkLogger } from '@sva/server-runtime';
import type {
  InstanceAuditCheck,
  InstanceAuditCheckStatus,
  InstanceAuditInstanceResult,
  InstanceAuditRun,
} from '@sva/core';

import type { KeycloakTenantStatus } from './keycloak-types.js';
import { createGetKeycloakStatusHandler } from './service-keycloak.js';
import { loadInstanceWithSecret } from './service-keycloak-secrets.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-audit', level: 'info' });

const CHECK_IDS = {
  runTargetsPresent: 'run.targets.present',
  instanceUrlReachable: 'instance.url.reachable',
  registryInstanceActive: 'registry.instance.active',
  registryRealmPresent: 'registry.realm.present',
  registryLoginClientPresent: 'registry.loginClient.present',
  registryTenantAdminClientPresent: 'registry.tenantAdminClient.present',
  registryLoginSecretConfigured: 'registry.loginSecret.configured',
  registryTenantAdminSecretConfigured: 'registry.tenantAdminSecret.configured',
  keycloakRealmExists: 'keycloak.realm.exists',
  keycloakLoginClientExists: 'keycloak.client.login.exists',
  keycloakLoginSecretAligned: 'keycloak.client.login.secretAligned',
  keycloakTenantAdminClientExists: 'keycloak.client.tenantAdmin.exists',
  keycloakTenantAdminSecretAligned: 'keycloak.client.tenantAdmin.secretAligned',
  keycloakSystemAdminRoleExists: 'keycloak.role.systemAdmin.exists',
  keycloakSystemAdminUserExists: 'keycloak.user.systemAdmin.exists',
  localSystemAdminAssignmentExists: 'localIam.systemAdminAssignment.exists',
} as const;

const aggregateStatuses = (statuses: readonly InstanceAuditCheckStatus[]): InstanceAuditCheckStatus => {
  if (statuses.some((status) => status === 'fail')) {
    return 'fail';
  }
  if (statuses.some((status) => status === 'warn')) {
    return 'warn';
  }
  if (statuses.some((status) => status === 'pass')) {
    return 'pass';
  }
  return 'skip';
};

const createCheck = (input: InstanceAuditCheck): InstanceAuditCheck => input;

const createSkipCheck = (
  checkId: string,
  title: string,
  scope: InstanceAuditCheck['scope'],
  expected: string,
  evidenceSource: string,
  message: string
): InstanceAuditCheck =>
  createCheck({
    checkId,
    title,
    scope,
    status: 'skip',
    expected,
    actual: 'nicht geprüft',
    evidenceSource,
    message,
  });

const toSummary = (instances: readonly InstanceAuditInstanceResult[], runChecks: readonly InstanceAuditCheck[]) => {
  const allStatuses = [...instances.flatMap((instance) => instance.checks), ...runChecks].map((check) => check.status);
  return {
    totalInstances: instances.length,
    passCount: allStatuses.filter((status) => status === 'pass').length,
    failCount: allStatuses.filter((status) => status === 'fail').length,
    warnCount: allStatuses.filter((status) => status === 'warn').length,
    skipCount: allStatuses.filter((status) => status === 'skip').length,
  };
};

const probeInstanceUrlReachability = async (primaryHostname: string): Promise<InstanceAuditCheck> => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 8_000);
  const url = `https://${primaryHostname}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });
    const reachable = response.status < 500;
    return createCheck({
      checkId: CHECK_IDS.instanceUrlReachable,
      title: 'Instanz-URL erreichbar',
      scope: 'instance',
      status: reachable ? 'pass' : 'fail',
      expected: `Antwort auf ${url}`,
      actual: `HTTP ${response.status}`,
      evidenceSource: 'https_probe',
      message: reachable
        ? 'Die Instanz antwortet über HTTPS.'
        : 'Die Instanz ist erreichbar, liefert aber einen Serverfehler zurück.',
      remediationHint: reachable ? undefined : 'HTTP-Routing, Deployment und Upstream-Health prüfen.',
    });
  } catch (error) {
    return createCheck({
      checkId: CHECK_IDS.instanceUrlReachable,
      title: 'Instanz-URL erreichbar',
      scope: 'instance',
      status: 'fail',
      expected: `Antwort auf ${url}`,
      actual: error instanceof Error ? error.name : 'unbekannter_fehler',
      evidenceSource: 'https_probe',
      message: 'Die Instanz-URL konnte nicht erreicht werden.',
      remediationHint: 'DNS, Ingress, TLS-Zertifikat und Container-Erreichbarkeit prüfen.',
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }
};

const resolveKeycloakStatus = async (
  deps: InstanceRegistryServiceDeps,
  instanceId: string
): Promise<{ status: KeycloakTenantStatus | null; evidenceSource: string; error?: string }> => {
  const loaded = await loadInstanceWithSecret(deps, instanceId);
  if (!loaded) {
    return { status: null, evidenceSource: 'instance_registry' };
  }

  if (deps.getKeycloakStatus) {
    try {
      const status = await deps.getKeycloakStatus({
        instanceId: loaded.instance.instanceId,
        primaryHostname: loaded.instance.primaryHostname,
        realmMode: loaded.instance.realmMode,
        authRealm: loaded.instance.authRealm,
        authClientId: loaded.instance.authClientId,
        authIssuerUrl: loaded.instance.authIssuerUrl,
        authClientSecretConfigured: loaded.instance.authClientSecretConfigured,
        authClientSecret: loaded.authClientSecret,
        tenantAdminClient: loaded.instance.tenantAdminClient,
        tenantAdminClientSecret: loaded.tenantAdminClientSecret,
        tenantAdminBootstrap: loaded.instance.tenantAdminBootstrap,
      });
      return { status, evidenceSource: 'keycloak_live' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('instance_audit_keycloak_status_failed', {
        instance_id: instanceId,
        error: message,
      });
      return { status: null, evidenceSource: 'keycloak_live', error: message };
    }
  }

  const fallback = await createGetKeycloakStatusHandler(deps)(instanceId);
  return { status: fallback, evidenceSource: 'keycloak_snapshot' };
};

const createRegistryChecks = (input: {
  status: string;
  authRealm: string;
  authClientId: string;
  authClientSecretConfigured: boolean;
  tenantAdminClientId?: string;
  tenantAdminSecretConfigured: boolean;
}): readonly InstanceAuditCheck[] => [
  createCheck({
    checkId: CHECK_IDS.registryInstanceActive,
    title: 'Registry-Status aktiv',
    scope: 'registry',
    status: input.status === 'active' ? 'pass' : 'fail',
    expected: 'Instanzstatus active',
    actual: input.status,
    evidenceSource: 'instance_registry',
    message:
      input.status === 'active'
        ? 'Die Instanz ist in der Registry als aktiv markiert.'
        : 'Die Instanz ist in der Registry nicht als aktiv markiert.',
    remediationHint: input.status === 'active' ? undefined : 'Registry-Status und Lifecycle der Instanz prüfen.',
  }),
  createCheck({
    checkId: CHECK_IDS.registryRealmPresent,
    title: 'Registry-Realm vorhanden',
    scope: 'registry',
    status: input.authRealm.trim().length > 0 ? 'pass' : 'fail',
    expected: 'Nicht-leerer authRealm',
    actual: input.authRealm.trim().length > 0 ? input.authRealm : 'leer',
    evidenceSource: 'instance_registry',
    message:
      input.authRealm.trim().length > 0
        ? 'Ein Auth-Realm ist im Registry-Vertrag hinterlegt.'
        : 'Im Registry-Vertrag fehlt der Auth-Realm.',
    remediationHint: input.authRealm.trim().length > 0 ? undefined : 'Instanzvertrag um einen gültigen Auth-Realm ergänzen.',
  }),
  createCheck({
    checkId: CHECK_IDS.registryLoginClientPresent,
    title: 'Registry-Login-Client vorhanden',
    scope: 'registry',
    status: input.authClientId.trim().length > 0 ? 'pass' : 'fail',
    expected: 'Nicht-leere authClientId',
    actual: input.authClientId.trim().length > 0 ? input.authClientId : 'leer',
    evidenceSource: 'instance_registry',
    message:
      input.authClientId.trim().length > 0
        ? 'Ein Login-Client ist im Registry-Vertrag hinterlegt.'
        : 'Im Registry-Vertrag fehlt die Login-Client-ID.',
    remediationHint:
      input.authClientId.trim().length > 0 ? undefined : 'Instanzvertrag um die Login-Client-ID ergänzen.',
  }),
  createCheck({
    checkId: CHECK_IDS.registryTenantAdminClientPresent,
    title: 'Registry-Tenant-Admin-Client vorhanden',
    scope: 'registry',
    status: input.tenantAdminClientId ? 'pass' : 'fail',
    expected: 'Tenant-Admin-Client-ID konfiguriert',
    actual: input.tenantAdminClientId ?? 'nicht konfiguriert',
    evidenceSource: 'instance_registry',
    message: input.tenantAdminClientId
      ? 'Ein Tenant-Admin-Client ist im Registry-Vertrag hinterlegt.'
      : 'Im Registry-Vertrag fehlt der Tenant-Admin-Client.',
    remediationHint:
      input.tenantAdminClientId ? undefined : 'Instanzvertrag um Tenant-Admin-Client-ID und Secret ergänzen.',
  }),
  createCheck({
    checkId: CHECK_IDS.registryLoginSecretConfigured,
    title: 'Registry-Login-Secret konfiguriert',
    scope: 'registry',
    status: input.authClientSecretConfigured ? 'pass' : 'fail',
    expected: 'Login-Client-Secret hinterlegt',
    actual: input.authClientSecretConfigured ? 'konfiguriert' : 'nicht konfiguriert',
    evidenceSource: 'instance_registry',
    message: input.authClientSecretConfigured
      ? 'Für den Login-Client ist ein Secret in der Registry hinterlegt.'
      : 'Für den Login-Client fehlt das Secret in der Registry.',
    remediationHint:
      input.authClientSecretConfigured ? undefined : 'Login-Client-Secret in der Root-Instanz nachpflegen.',
  }),
  createCheck({
    checkId: CHECK_IDS.registryTenantAdminSecretConfigured,
    title: 'Registry-Tenant-Admin-Secret konfiguriert',
    scope: 'registry',
    status: input.tenantAdminSecretConfigured ? 'pass' : 'fail',
    expected: 'Tenant-Admin-Client-Secret hinterlegt',
    actual: input.tenantAdminSecretConfigured ? 'konfiguriert' : 'nicht konfiguriert',
    evidenceSource: 'instance_registry',
    message: input.tenantAdminSecretConfigured
      ? 'Für den Tenant-Admin-Client ist ein Secret in der Registry hinterlegt.'
      : 'Für den Tenant-Admin-Client fehlt das Secret in der Registry.',
    remediationHint:
      input.tenantAdminSecretConfigured ? undefined : 'Tenant-Admin-Client-Secret in der Root-Instanz nachpflegen.',
  }),
];

const buildKeycloakChecks = (input: {
  keycloakStatus: KeycloakTenantStatus | null;
  keycloakEvidenceSource: string;
  keycloakError?: string;
}): readonly InstanceAuditCheck[] => {
  const evidenceSource = input.keycloakEvidenceSource;
  const keycloakStatus = input.keycloakStatus;
  const checks: InstanceAuditCheck[] = [];

  if (!keycloakStatus) {
    checks.push(
      createCheck({
        checkId: CHECK_IDS.keycloakRealmExists,
        title: 'Keycloak-Realm vorhanden',
        scope: 'keycloak',
        status: 'fail',
        expected: 'Realm im Keycloak vorhanden',
        actual: input.keycloakError ?? 'nicht lesbar',
        evidenceSource,
        message: 'Der Keycloak-Realm konnte nicht gelesen werden.',
        remediationHint: 'Technischen Keycloak-Zugriff, Realm-Namen und Verbindungsdaten prüfen.',
      }),
      createSkipCheck(
        CHECK_IDS.keycloakLoginClientExists,
        'Keycloak-Login-Client vorhanden',
        'keycloak',
        'Login-Client im Realm vorhanden',
        evidenceSource,
        'Wird erst geprüft, wenn der Realm erfolgreich gelesen werden kann.'
      ),
      createSkipCheck(
        CHECK_IDS.keycloakLoginSecretAligned,
        'Keycloak-Login-Secret abgeglichen',
        'keycloak',
        'Registry-Secret stimmt mit Keycloak überein',
        evidenceSource,
        'Wird erst geprüft, wenn Realm und Login-Client erfolgreich gelesen werden können.'
      ),
      createSkipCheck(
        CHECK_IDS.keycloakTenantAdminClientExists,
        'Keycloak-Tenant-Admin-Client vorhanden',
        'keycloak',
        'Tenant-Admin-Client im Realm vorhanden',
        evidenceSource,
        'Wird erst geprüft, wenn der Realm erfolgreich gelesen werden kann.'
      ),
      createSkipCheck(
        CHECK_IDS.keycloakTenantAdminSecretAligned,
        'Keycloak-Tenant-Admin-Secret abgeglichen',
        'keycloak',
        'Registry-Secret stimmt mit Keycloak überein',
        evidenceSource,
        'Wird erst geprüft, wenn Realm und Tenant-Admin-Client erfolgreich gelesen werden können.'
      ),
      createSkipCheck(
        CHECK_IDS.keycloakSystemAdminRoleExists,
        'Keycloak-Rolle system_admin vorhanden',
        'keycloak',
        'Realm-Rolle system_admin vorhanden',
        evidenceSource,
        'Wird erst geprüft, wenn der Realm erfolgreich gelesen werden kann.'
      ),
      createSkipCheck(
        CHECK_IDS.keycloakSystemAdminUserExists,
        'Keycloak-User mit system_admin vorhanden',
        'keycloak',
        'Mindestens ein User mit system_admin vorhanden',
        evidenceSource,
        'Wird erst geprüft, wenn Realm, Rolle und Tenant-Admin-Status verfügbar sind.'
      )
    );
    return checks;
  }

  const realmCheck = createCheck({
    checkId: CHECK_IDS.keycloakRealmExists,
    title: 'Keycloak-Realm vorhanden',
    scope: 'keycloak',
    status: keycloakStatus.realmExists ? 'pass' : 'fail',
    expected: 'Realm im Keycloak vorhanden',
    actual: keycloakStatus.realmExists ? 'vorhanden' : 'fehlt',
    evidenceSource,
    message: keycloakStatus.realmExists
      ? 'Der Ziel-Realm ist in Keycloak vorhanden.'
      : 'Der Ziel-Realm fehlt in Keycloak.',
    remediationHint: keycloakStatus.realmExists ? undefined : 'Realm anlegen oder Registry-Realm korrigieren.',
  });
  checks.push(realmCheck);

  if (!keycloakStatus.realmExists) {
    checks.push(
      createSkipCheck(
        CHECK_IDS.keycloakLoginClientExists,
        'Keycloak-Login-Client vorhanden',
        'keycloak',
        'Login-Client im Realm vorhanden',
        evidenceSource,
        'Wird erst geprüft, wenn der Realm vorhanden ist.'
      ),
      createSkipCheck(
        CHECK_IDS.keycloakLoginSecretAligned,
        'Keycloak-Login-Secret abgeglichen',
        'keycloak',
        'Registry-Secret stimmt mit Keycloak überein',
        evidenceSource,
        'Wird erst geprüft, wenn der Login-Client vorhanden ist.'
      ),
      createSkipCheck(
        CHECK_IDS.keycloakTenantAdminClientExists,
        'Keycloak-Tenant-Admin-Client vorhanden',
        'keycloak',
        'Tenant-Admin-Client im Realm vorhanden',
        evidenceSource,
        'Wird erst geprüft, wenn der Realm vorhanden ist.'
      ),
      createSkipCheck(
        CHECK_IDS.keycloakTenantAdminSecretAligned,
        'Keycloak-Tenant-Admin-Secret abgeglichen',
        'keycloak',
        'Registry-Secret stimmt mit Keycloak überein',
        evidenceSource,
        'Wird erst geprüft, wenn der Tenant-Admin-Client vorhanden ist.'
      ),
      createSkipCheck(
        CHECK_IDS.keycloakSystemAdminRoleExists,
        'Keycloak-Rolle system_admin vorhanden',
        'keycloak',
        'Realm-Rolle system_admin vorhanden',
        evidenceSource,
        'Wird erst geprüft, wenn der Realm vorhanden ist.'
      ),
      createSkipCheck(
        CHECK_IDS.keycloakSystemAdminUserExists,
        'Keycloak-User mit system_admin vorhanden',
        'keycloak',
        'Mindestens ein User mit system_admin vorhanden',
        evidenceSource,
        'Wird erst geprüft, wenn Rolle und Benutzerstatus lesbar sind.'
      )
    );
    return checks;
  }

  const loginClientCheck = createCheck({
    checkId: CHECK_IDS.keycloakLoginClientExists,
    title: 'Keycloak-Login-Client vorhanden',
    scope: 'keycloak',
    status: keycloakStatus.clientExists ? 'pass' : 'fail',
    expected: 'Login-Client im Realm vorhanden',
    actual: keycloakStatus.clientExists ? 'vorhanden' : 'fehlt',
    evidenceSource,
    message: keycloakStatus.clientExists
      ? 'Der Login-Client ist im Realm vorhanden.'
      : 'Der Login-Client fehlt im Realm.',
    remediationHint: keycloakStatus.clientExists ? undefined : 'Login-Client neu provisionieren oder Client-ID korrigieren.',
  });
  checks.push(loginClientCheck);
  checks.push(
    keycloakStatus.clientExists
      ? createCheck({
          checkId: CHECK_IDS.keycloakLoginSecretAligned,
          title: 'Keycloak-Login-Secret abgeglichen',
          scope: 'keycloak',
          status: keycloakStatus.clientSecretAligned ? 'pass' : 'fail',
          expected: 'Registry-Secret stimmt mit Keycloak überein',
          actual: keycloakStatus.clientSecretAligned ? 'aligned' : 'mismatch',
          evidenceSource,
          message: keycloakStatus.clientSecretAligned
            ? 'Das Login-Client-Secret ist zwischen Registry und Keycloak konsistent.'
            : 'Das Login-Client-Secret weicht zwischen Registry und Keycloak ab.',
          remediationHint: keycloakStatus.clientSecretAligned
            ? undefined
            : 'Secret rotieren oder Registry-Wert gezielt mit Keycloak abgleichen.',
        })
      : createSkipCheck(
          CHECK_IDS.keycloakLoginSecretAligned,
          'Keycloak-Login-Secret abgeglichen',
          'keycloak',
          'Registry-Secret stimmt mit Keycloak überein',
          evidenceSource,
          'Wird erst geprüft, wenn der Login-Client vorhanden ist.'
        )
  );

  const tenantAdminClientCheck = createCheck({
    checkId: CHECK_IDS.keycloakTenantAdminClientExists,
    title: 'Keycloak-Tenant-Admin-Client vorhanden',
    scope: 'keycloak',
    status: keycloakStatus.tenantAdminClientExists ? 'pass' : 'fail',
    expected: 'Tenant-Admin-Client im Realm vorhanden',
    actual: keycloakStatus.tenantAdminClientExists ? 'vorhanden' : 'fehlt',
    evidenceSource,
    message: keycloakStatus.tenantAdminClientExists
      ? 'Der Tenant-Admin-Client ist im Realm vorhanden.'
      : 'Der Tenant-Admin-Client fehlt im Realm.',
    remediationHint:
      keycloakStatus.tenantAdminClientExists ? undefined : 'Tenant-Admin-Client provisionieren oder Registry-Daten korrigieren.',
  });
  checks.push(tenantAdminClientCheck);
  checks.push(
    keycloakStatus.tenantAdminClientExists
      ? createCheck({
          checkId: CHECK_IDS.keycloakTenantAdminSecretAligned,
          title: 'Keycloak-Tenant-Admin-Secret abgeglichen',
          scope: 'keycloak',
          status: keycloakStatus.tenantAdminClientSecretAligned ? 'pass' : 'fail',
          expected: 'Registry-Secret stimmt mit Keycloak überein',
          actual: keycloakStatus.tenantAdminClientSecretAligned ? 'aligned' : 'mismatch',
          evidenceSource,
          message: keycloakStatus.tenantAdminClientSecretAligned
            ? 'Das Tenant-Admin-Client-Secret ist zwischen Registry und Keycloak konsistent.'
            : 'Das Tenant-Admin-Client-Secret weicht zwischen Registry und Keycloak ab.',
          remediationHint: keycloakStatus.tenantAdminClientSecretAligned
            ? undefined
            : 'Tenant-Admin-Client-Secret rotieren oder Registry-Wert mit Keycloak abgleichen.',
        })
      : createSkipCheck(
          CHECK_IDS.keycloakTenantAdminSecretAligned,
          'Keycloak-Tenant-Admin-Secret abgeglichen',
          'keycloak',
          'Registry-Secret stimmt mit Keycloak überein',
          evidenceSource,
          'Wird erst geprüft, wenn der Tenant-Admin-Client vorhanden ist.'
        )
  );

  const roleCheck = createCheck({
    checkId: CHECK_IDS.keycloakSystemAdminRoleExists,
    title: 'Keycloak-Rolle system_admin vorhanden',
    scope: 'keycloak',
    status: keycloakStatus.systemAdminRoleExists ? 'pass' : 'fail',
    expected: 'Realm-Rolle system_admin vorhanden',
    actual: keycloakStatus.systemAdminRoleExists ? 'vorhanden' : 'fehlt',
    evidenceSource,
    message: keycloakStatus.systemAdminRoleExists
      ? 'Die Realm-Rolle system_admin ist vorhanden.'
      : 'Die Realm-Rolle system_admin fehlt.',
    remediationHint:
      keycloakStatus.systemAdminRoleExists ? undefined : 'Rollen-Baseline im Tenant-Realm provisionieren.',
  });
  checks.push(roleCheck);
  checks.push(
    keycloakStatus.systemAdminRoleExists
      ? createCheck({
          checkId: CHECK_IDS.keycloakSystemAdminUserExists,
          title: 'Keycloak-User mit system_admin vorhanden',
          scope: 'keycloak',
          status: keycloakStatus.tenantAdminExists && keycloakStatus.tenantAdminHasSystemAdmin ? 'pass' : 'fail',
          expected: 'Mindestens ein User mit system_admin vorhanden',
          actual:
            keycloakStatus.tenantAdminExists && keycloakStatus.tenantAdminHasSystemAdmin
              ? 'vorhanden'
              : keycloakStatus.tenantAdminExists
                ? 'benutzer_ohne_system_admin'
                : 'kein_benutzer_nachweis',
          evidenceSource,
          message:
            keycloakStatus.tenantAdminExists && keycloakStatus.tenantAdminHasSystemAdmin
              ? 'Mindestens ein bekannter Tenant-Admin trägt die Rolle system_admin.'
              : keycloakStatus.tenantAdminExists
                ? 'Der bekannte Tenant-Admin existiert, trägt aber die Rolle system_admin nicht.'
                : 'Für den bekannten Tenant-Admin wurde kein system_admin-Nachweis gefunden.',
          remediationHint:
            keycloakStatus.tenantAdminExists && keycloakStatus.tenantAdminHasSystemAdmin
              ? undefined
              : 'Tenant-Admin-Benutzer und seine Keycloak-Rollenzuordnung prüfen.',
        })
      : createSkipCheck(
          CHECK_IDS.keycloakSystemAdminUserExists,
          'Keycloak-User mit system_admin vorhanden',
          'keycloak',
          'Mindestens ein User mit system_admin vorhanden',
          evidenceSource,
          'Wird erst geprüft, wenn die Realm-Rolle system_admin vorhanden ist.'
        )
  );

  return checks;
};

const createLocalIamCheck = (assignmentCount: number): InstanceAuditCheck =>
  createCheck({
    checkId: CHECK_IDS.localSystemAdminAssignmentExists,
    title: 'Lokale system_admin-Zuordnung vorhanden',
    scope: 'localIam',
    status: assignmentCount > 0 ? 'pass' : 'fail',
    expected: 'Mindestens eine aktive lokale system_admin-Zuordnung',
    actual: `${assignmentCount} aktive Zuordnungen`,
    evidenceSource: 'iam_database',
    message:
      assignmentCount > 0
        ? 'Im lokalen IAM existiert mindestens eine aktive system_admin-Zuordnung.'
        : 'Im lokalen IAM wurde keine aktive system_admin-Zuordnung gefunden.',
    remediationHint:
      assignmentCount > 0 ? undefined : 'Lokale Rollen-Synchronisierung und Bootstrap-Zuordnung des Tenant-Admins prüfen.',
  });

const buildInstanceAuditResult = async (
  deps: InstanceRegistryServiceDeps,
  instanceId: string
): Promise<InstanceAuditInstanceResult | null> => {
  const instance = await deps.repository.getInstanceById(instanceId);
  if (!instance) {
    return null;
  }

  const [urlCheck, keycloak, localSystemAdminCount] = await Promise.all([
    probeInstanceUrlReachability(instance.primaryHostname),
    resolveKeycloakStatus(deps, instance.instanceId),
    deps.repository.countLocalSystemAdminAssignments(instance.instanceId),
  ]);

  const checks = [
    urlCheck,
    ...createRegistryChecks({
      status: instance.status,
      authRealm: instance.authRealm,
      authClientId: instance.authClientId,
      authClientSecretConfigured: instance.authClientSecretConfigured,
      tenantAdminClientId: instance.tenantAdminClient?.clientId,
      tenantAdminSecretConfigured: instance.tenantAdminClient?.secretConfigured ?? false,
    }),
    ...buildKeycloakChecks({
      keycloakStatus: keycloak.status,
      keycloakEvidenceSource: keycloak.evidenceSource,
      keycloakError: keycloak.error,
    }),
    createLocalIamCheck(localSystemAdminCount),
  ];

  return {
    instanceId: instance.instanceId,
    displayName: instance.displayName,
    status: instance.status,
    primaryHostname: instance.primaryHostname,
    overallStatus: aggregateStatuses(checks.map((check) => check.status)),
    checks,
  };
};

export const createRunInstanceAuditHandler =
  (deps: InstanceRegistryServiceDeps) =>
  async (input: {
    instanceIds?: readonly string[];
    includeOnlyActive?: boolean;
    actorId?: string;
    requestId?: string;
  }): Promise<InstanceAuditRun> => {
    const includeOnlyActive = input.includeOnlyActive ?? true;
    const requestedInstanceIds = [...new Set((input.instanceIds ?? []).map((instanceId) => instanceId.trim()).filter(Boolean))];

    const instances =
      requestedInstanceIds.length > 0
        ? (
            await Promise.all(
              requestedInstanceIds.map(async (instanceId) => {
                const instance = await deps.repository.getInstanceById(instanceId);
                if (!instance) {
                  return null;
                }
                if (includeOnlyActive && instance.status !== 'active') {
                  return null;
                }
                return instance;
              })
            )
          ).filter((instance): instance is NonNullable<typeof instance> => Boolean(instance))
        : await deps.repository.listInstances(includeOnlyActive ? { status: 'active' } : undefined);

    const runChecks =
      instances.length > 0
        ? [
            createCheck({
              checkId: CHECK_IDS.runTargetsPresent,
              title: 'Zielinstanzen geladen',
              scope: 'run',
              status: 'pass',
              expected: 'Mindestens eine Zielinstanz',
              actual: `${instances.length} Instanzen`,
              evidenceSource: 'instance_registry',
              message: 'Für den Audit-Lauf wurden Zielinstanzen geladen.',
            }),
          ]
        : [
            createCheck({
              checkId: CHECK_IDS.runTargetsPresent,
              title: 'Zielinstanzen geladen',
              scope: 'run',
              status: 'fail',
              expected: 'Mindestens eine Zielinstanz',
              actual: '0 Instanzen',
              evidenceSource: 'instance_registry',
              message: 'Der Audit-Lauf hat keine Zielinstanzen geladen.',
              remediationHint: 'Filter, Registry-Daten und den aktiven Status der Zielinstanzen prüfen.',
            }),
          ];

    const results = (
      await Promise.all(instances.map((instance) => buildInstanceAuditResult(deps, instance.instanceId)))
    ).filter((instance): instance is InstanceAuditInstanceResult => Boolean(instance));

    const overallStatus = aggregateStatuses([
      ...runChecks.map((check) => check.status),
      ...results.map((result) => result.overallStatus),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      requestId: input.requestId,
      actorId: input.actorId,
      includeOnlyActive,
      targetInstanceIds: requestedInstanceIds.length > 0 ? requestedInstanceIds : instances.map((instance) => instance.instanceId),
      overallStatus,
      summary: toSummary(results, runChecks),
      checks: runChecks,
      instances: results,
    };
  };
