import { createSdkLogger } from '@sva/server-runtime';
import type { InstanceAuditCheck } from '@sva/core';

import type { KeycloakTenantStatus } from './keycloak-types.js';
import { createGetKeycloakStatusHandler } from './service-keycloak.js';
import { loadInstanceWithSecret } from './service-keycloak-secrets.js';
import { CHECK_IDS, createCheck, createSkipCheck } from './service-audit-shared.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-audit', level: 'info' });

export const resolveKeycloakStatus = async (
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

const createRealmUnavailableChecks = (evidenceSource: string, keycloakError?: string): readonly InstanceAuditCheck[] => [
  createCheck({
    checkId: CHECK_IDS.keycloakRealmExists,
    title: 'Keycloak-Realm vorhanden',
    scope: 'keycloak',
    status: 'fail',
    expected: 'Realm im Keycloak vorhanden',
    actual: keycloakError ?? 'nicht lesbar',
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
  ),
];

const createRealmChecks = (status: KeycloakTenantStatus, evidenceSource: string): readonly InstanceAuditCheck[] => {
  const realmCheck = createCheck({
    checkId: CHECK_IDS.keycloakRealmExists,
    title: 'Keycloak-Realm vorhanden',
    scope: 'keycloak',
    status: status.realmExists ? 'pass' : 'fail',
    expected: 'Realm im Keycloak vorhanden',
    actual: status.realmExists ? 'vorhanden' : 'fehlt',
    evidenceSource,
    message: status.realmExists ? 'Der Ziel-Realm ist in Keycloak vorhanden.' : 'Der Ziel-Realm fehlt in Keycloak.',
    remediationHint: status.realmExists ? undefined : 'Realm anlegen oder Registry-Realm korrigieren.',
  });

  if (status.realmExists) {
    return [realmCheck];
  }

  return [
    realmCheck,
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
    ),
  ];
};

const createLoginClientChecks = (status: KeycloakTenantStatus, evidenceSource: string): readonly InstanceAuditCheck[] => {
  const clientCheck = createCheck({
    checkId: CHECK_IDS.keycloakLoginClientExists,
    title: 'Keycloak-Login-Client vorhanden',
    scope: 'keycloak',
    status: status.clientExists ? 'pass' : 'fail',
    expected: 'Login-Client im Realm vorhanden',
    actual: status.clientExists ? 'vorhanden' : 'fehlt',
    evidenceSource,
    message: status.clientExists ? 'Der Login-Client ist im Realm vorhanden.' : 'Der Login-Client fehlt im Realm.',
    remediationHint: status.clientExists ? undefined : 'Login-Client neu provisionieren oder Client-ID korrigieren.',
  });

  const secretCheck = status.clientExists
    ? createCheck({
        checkId: CHECK_IDS.keycloakLoginSecretAligned,
        title: 'Keycloak-Login-Secret abgeglichen',
        scope: 'keycloak',
        status: status.clientSecretAligned ? 'pass' : 'fail',
        expected: 'Registry-Secret stimmt mit Keycloak überein',
        actual: status.clientSecretAligned ? 'aligned' : 'mismatch',
        evidenceSource,
        message: status.clientSecretAligned
          ? 'Das Login-Client-Secret ist zwischen Registry und Keycloak konsistent.'
          : 'Das Login-Client-Secret weicht zwischen Registry und Keycloak ab.',
        remediationHint: status.clientSecretAligned
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
      );

  return [clientCheck, secretCheck];
};

const createTenantAdminClientChecks = (
  status: KeycloakTenantStatus,
  evidenceSource: string
): readonly InstanceAuditCheck[] => {
  const clientCheck = createCheck({
    checkId: CHECK_IDS.keycloakTenantAdminClientExists,
    title: 'Keycloak-Tenant-Admin-Client vorhanden',
    scope: 'keycloak',
    status: status.tenantAdminClientExists ? 'pass' : 'fail',
    expected: 'Tenant-Admin-Client im Realm vorhanden',
    actual: status.tenantAdminClientExists ? 'vorhanden' : 'fehlt',
    evidenceSource,
    message: status.tenantAdminClientExists
      ? 'Der Tenant-Admin-Client ist im Realm vorhanden.'
      : 'Der Tenant-Admin-Client fehlt im Realm.',
    remediationHint:
      status.tenantAdminClientExists ? undefined : 'Tenant-Admin-Client provisionieren oder Registry-Daten korrigieren.',
  });

  const secretCheck = status.tenantAdminClientExists
    ? createCheck({
        checkId: CHECK_IDS.keycloakTenantAdminSecretAligned,
        title: 'Keycloak-Tenant-Admin-Secret abgeglichen',
        scope: 'keycloak',
        status: status.tenantAdminClientSecretAligned ? 'pass' : 'fail',
        expected: 'Registry-Secret stimmt mit Keycloak überein',
        actual: status.tenantAdminClientSecretAligned ? 'aligned' : 'mismatch',
        evidenceSource,
        message: status.tenantAdminClientSecretAligned
          ? 'Das Tenant-Admin-Client-Secret ist zwischen Registry und Keycloak konsistent.'
          : 'Das Tenant-Admin-Client-Secret weicht zwischen Registry und Keycloak ab.',
        remediationHint: status.tenantAdminClientSecretAligned
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
      );

  return [clientCheck, secretCheck];
};

const createSystemAdminChecks = (status: KeycloakTenantStatus, evidenceSource: string): readonly InstanceAuditCheck[] => {
  const roleCheck = createCheck({
    checkId: CHECK_IDS.keycloakSystemAdminRoleExists,
    title: 'Keycloak-Rolle system_admin vorhanden',
    scope: 'keycloak',
    status: status.systemAdminRoleExists ? 'pass' : 'fail',
    expected: 'Realm-Rolle system_admin vorhanden',
    actual: status.systemAdminRoleExists ? 'vorhanden' : 'fehlt',
    evidenceSource,
    message: status.systemAdminRoleExists ? 'Die Realm-Rolle system_admin ist vorhanden.' : 'Die Realm-Rolle system_admin fehlt.',
    remediationHint: status.systemAdminRoleExists ? undefined : 'Rollen-Baseline im Tenant-Realm provisionieren.',
  });

  const userCheck = status.systemAdminRoleExists
    ? createCheck({
        checkId: CHECK_IDS.keycloakSystemAdminUserExists,
        title: 'Keycloak-User mit system_admin vorhanden',
        scope: 'keycloak',
        status: status.tenantAdminExists && status.tenantAdminHasSystemAdmin ? 'pass' : 'fail',
        expected: 'Mindestens ein User mit system_admin vorhanden',
        actual:
          status.tenantAdminExists && status.tenantAdminHasSystemAdmin
            ? 'vorhanden'
            : status.tenantAdminExists
              ? 'benutzer_ohne_system_admin'
              : 'kein_benutzer_nachweis',
        evidenceSource,
        message:
          status.tenantAdminExists && status.tenantAdminHasSystemAdmin
            ? 'Mindestens ein bekannter Tenant-Admin trägt die Rolle system_admin.'
            : status.tenantAdminExists
              ? 'Der bekannte Tenant-Admin existiert, trägt aber die Rolle system_admin nicht.'
              : 'Für den bekannten Tenant-Admin wurde kein system_admin-Nachweis gefunden.',
        remediationHint:
          status.tenantAdminExists && status.tenantAdminHasSystemAdmin
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
      );

  return [roleCheck, userCheck];
};

export const buildKeycloakChecks = (input: {
  keycloakStatus: KeycloakTenantStatus | null;
  keycloakEvidenceSource: string;
  keycloakError?: string;
}): readonly InstanceAuditCheck[] => {
  if (!input.keycloakStatus) {
    return createRealmUnavailableChecks(input.keycloakEvidenceSource, input.keycloakError);
  }

  const realmChecks = createRealmChecks(input.keycloakStatus, input.keycloakEvidenceSource);
  if (!input.keycloakStatus.realmExists) {
    return realmChecks;
  }

  return [
    ...realmChecks,
    ...createLoginClientChecks(input.keycloakStatus, input.keycloakEvidenceSource),
    ...createTenantAdminClientChecks(input.keycloakStatus, input.keycloakEvidenceSource),
    ...createSystemAdminChecks(input.keycloakStatus, input.keycloakEvidenceSource),
  ];
};
