import { createSdkLogger } from '@sva/server-runtime';
import type { InstanceAuditCheck } from '@sva/core';

import type { KeycloakTenantStatus } from './keycloak-types.js';
import { createGetKeycloakStatusHandler } from './service-keycloak.js';
import { loadInstanceWithSecret } from './service-keycloak-secrets.js';
import { CHECK_IDS, createCheck, createSkipCheck } from './service-audit-shared.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-audit', level: 'info' });

type RealmUnavailableInput = {
  evidenceSource: string;
  keycloakError?: string;
  fallbackStatus?: KeycloakTenantStatus | null;
  fallbackEvidenceSource?: string;
  fallbackError?: string;
};

export const resolveKeycloakStatus = async (
  deps: InstanceRegistryServiceDeps,
  instanceId: string
): Promise<{
  status: KeycloakTenantStatus | null;
  evidenceSource: string;
  error?: string;
  fallbackStatus?: KeycloakTenantStatus | null;
  fallbackEvidenceSource?: string;
  fallbackError?: string;
}> => {
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
      try {
        const fallback = await createGetKeycloakStatusHandler(deps)(instanceId);
        return {
          status: null,
          evidenceSource: 'keycloak_live',
          error: message,
          fallbackStatus: fallback,
          fallbackEvidenceSource: 'keycloak_snapshot',
        };
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        logger.warn('instance_audit_keycloak_fallback_failed', {
          instance_id: instanceId,
          error: fallbackMessage,
        });
        return {
          status: null,
          evidenceSource: 'keycloak_live',
          error: message,
          fallbackEvidenceSource: 'keycloak_snapshot',
          fallbackError: fallbackMessage,
        };
      }
    }
  }

  const fallback = await createGetKeycloakStatusHandler(deps)(instanceId);
  return { status: fallback, evidenceSource: 'keycloak_snapshot' };
};

const hasUsableFallbackStatus = (input: RealmUnavailableInput): boolean =>
  Boolean(input.fallbackEvidenceSource && input.fallbackStatus);

const createRealmUnavailableAccessDetails = (input: RealmUnavailableInput): Record<string, unknown> => {
  const accessDetails: Record<string, unknown> = { primaryEvidenceSource: input.evidenceSource };

  if (input.keycloakError) {
    accessDetails.primaryError = input.keycloakError;
  }
  if (input.fallbackEvidenceSource) {
    accessDetails.secondaryEvidenceSource = input.fallbackEvidenceSource;
  }
  if (input.fallbackError) {
    accessDetails.secondaryError = input.fallbackError;
  }
  if (input.fallbackStatus) {
    accessDetails.secondaryRealmExists = input.fallbackStatus.realmExists;
    accessDetails.secondaryLoginClientExists = input.fallbackStatus.clientExists;
    accessDetails.secondaryTenantAdminClientExists = input.fallbackStatus.tenantAdminClientExists;
    accessDetails.secondaryRuntimeSecretSource = input.fallbackStatus.runtimeSecretSource;
  }

  return accessDetails;
};

const createRealmUnavailableAccessCheck = (
  input: RealmUnavailableInput,
  hasFallback: boolean,
  accessDetails: Record<string, unknown>
): InstanceAuditCheck | null => {
  if (!input.keycloakError && !hasFallback) {
    return null;
  }

  return createCheck({
    checkId: CHECK_IDS.keycloakAccessRead,
    title: 'Technischer Keycloak-Zugriff',
    scope: 'keycloak',
    status: hasFallback ? 'warn' : 'fail',
    expected: 'Live-Lesung des Tenant-Realms erfolgreich',
    actual: input.keycloakError ?? 'nicht lesbar',
    evidenceSource: input.evidenceSource,
    details: accessDetails,
    message: hasFallback
      ? 'Die Live-Lesung des Tenant-Realm ist fehlgeschlagen. Ein sekundärer Snapshot-/Vertragspfad war noch auswertbar, ersetzt aber keinen erfolgreichen Live-Zugriff.'
      : 'Die Live-Lesung des Tenant-Realm ist fehlgeschlagen.',
    remediationHint: hasFallback
      ? 'Technischen Live-Keycloak-Zugriff und Credential-Verdrahtung prüfen; sekundäre Snapshot-Befunde nur als Referenz nutzen.'
      : 'Technischen Keycloak-Zugriff, Realm-Namen und Verbindungsdaten prüfen.',
  });
};

const createRealmUnavailableChecks = (input: RealmUnavailableInput): readonly InstanceAuditCheck[] => {
  const hasFallback = hasUsableFallbackStatus(input);
  const accessDetails = createRealmUnavailableAccessDetails(input);
  const accessCheck = createRealmUnavailableAccessCheck(input, hasFallback, accessDetails);

  return [
  ...(accessCheck ? [accessCheck] : []),
  createCheck({
    checkId: CHECK_IDS.keycloakRealmExists,
    title: 'Keycloak-Realm vorhanden',
    scope: 'keycloak',
    status: hasFallback ? 'warn' : 'fail',
    expected: hasFallback ? 'Realm im Keycloak live lesbar' : 'Realm im Keycloak vorhanden',
    actual: hasFallback ? 'live_nicht_verifiziert' : input.keycloakError ?? 'nicht lesbar',
    evidenceSource: input.evidenceSource,
    details: hasFallback ? accessDetails : undefined,
    message: hasFallback
      ? 'Der Tenant-Realm konnte live nicht gelesen werden. Ein sekundärer Snapshot-/Vertragspfad liefert nur Referenzdaten und ersetzt keinen erfolgreichen Live-Read.'
      : 'Der Keycloak-Realm konnte nicht gelesen werden.',
    remediationHint: hasFallback
      ? 'Technischen Live-Keycloak-Zugriff und die verwendeten Runtime-Credentials prüfen.'
      : 'Technischen Keycloak-Zugriff, Realm-Namen und Verbindungsdaten prüfen.',
  }),
  createSkipCheck(
    CHECK_IDS.keycloakLoginClientExists,
    'Keycloak-Login-Client vorhanden',
    'keycloak',
    'Login-Client im Realm vorhanden',
    input.evidenceSource,
    'Wird erst geprüft, wenn der Tenant-Realm live gelesen werden kann.'
  ),
  createSkipCheck(
    CHECK_IDS.keycloakLoginSecretAligned,
    'Keycloak-Login-Secret abgeglichen',
    'keycloak',
    'Registry-Secret stimmt mit Keycloak überein',
    input.evidenceSource,
    'Wird erst geprüft, wenn Tenant-Realm und Login-Client live gelesen werden können.'
  ),
  createSkipCheck(
    CHECK_IDS.keycloakTenantAdminClientExists,
    'Keycloak-Tenant-Admin-Client vorhanden',
    'keycloak',
    'Tenant-Admin-Client im Realm vorhanden',
    input.evidenceSource,
    'Wird erst geprüft, wenn der Tenant-Realm live gelesen werden kann.'
  ),
  createSkipCheck(
    CHECK_IDS.keycloakTenantAdminSecretAligned,
    'Keycloak-Tenant-Admin-Secret abgeglichen',
    'keycloak',
    'Registry-Secret stimmt mit Keycloak überein',
    input.evidenceSource,
    'Wird erst geprüft, wenn Tenant-Realm und Tenant-Admin-Client live gelesen werden können.'
  ),
  createSkipCheck(
    CHECK_IDS.keycloakSystemAdminRoleExists,
    'Keycloak-Rolle system_admin vorhanden',
    'keycloak',
    'Realm-Rolle system_admin vorhanden',
    input.evidenceSource,
    'Wird erst geprüft, wenn der Tenant-Realm live gelesen werden kann.'
  ),
  createSkipCheck(
    CHECK_IDS.keycloakSystemAdminUserExists,
    'Keycloak-User mit system_admin vorhanden',
    'keycloak',
    'Mindestens ein User mit system_admin vorhanden',
    input.evidenceSource,
    'Wird erst geprüft, wenn Tenant-Realm, Rolle und Tenant-Admin-Status live gelesen werden können.'
  ),
];
};

const createPresenceCheck = (input: {
  checkId: string;
  title: string;
  expected: string;
  present: boolean;
  evidenceSource: string;
  presentMessage: string;
  missingMessage: string;
  remediationHint: string;
}): InstanceAuditCheck =>
  createCheck({
    checkId: input.checkId,
    title: input.title,
    scope: 'keycloak',
    status: input.present ? 'pass' : 'fail',
    expected: input.expected,
    actual: input.present ? 'vorhanden' : 'fehlt',
    evidenceSource: input.evidenceSource,
    message: input.present ? input.presentMessage : input.missingMessage,
    remediationHint: input.present ? undefined : input.remediationHint,
  });

const createSecretAlignmentCheck = (input: {
  checkId: string;
  title: string;
  clientExists: boolean;
  aligned: boolean;
  evidenceSource: string;
  presentMessage: string;
  missingMessage: string;
  remediationHint: string;
}): InstanceAuditCheck =>
  input.clientExists
    ? createCheck({
        checkId: input.checkId,
        title: input.title,
        scope: 'keycloak',
        status: input.aligned ? 'pass' : 'fail',
        expected: 'Registry-Secret stimmt mit Keycloak überein',
        actual: input.aligned ? 'konsistent' : 'abweichend',
        evidenceSource: input.evidenceSource,
        message: input.aligned ? input.presentMessage : input.missingMessage,
        remediationHint: input.aligned ? undefined : input.remediationHint,
      })
    : createSkipCheck(
        input.checkId,
        input.title,
        'keycloak',
        'Registry-Secret stimmt mit Keycloak überein',
        input.evidenceSource,
        'Wird erst geprüft, wenn der zugehörige Client vorhanden ist.'
      );

const createRealmChecks = (status: KeycloakTenantStatus, evidenceSource: string): readonly InstanceAuditCheck[] => {
  const realmCheck = createPresenceCheck({
    checkId: CHECK_IDS.keycloakRealmExists,
    title: 'Keycloak-Realm vorhanden',
    expected: 'Realm im Keycloak vorhanden',
    present: status.realmExists,
    evidenceSource,
    presentMessage: 'Der Ziel-Realm ist in Keycloak vorhanden.',
    missingMessage: 'Der Ziel-Realm fehlt in Keycloak.',
    remediationHint: 'Realm anlegen oder Registry-Realm korrigieren.',
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
  const clientCheck = createPresenceCheck({
    checkId: CHECK_IDS.keycloakLoginClientExists,
    title: 'Keycloak-Login-Client vorhanden',
    expected: 'Login-Client im Realm vorhanden',
    present: status.clientExists,
    evidenceSource,
    presentMessage: 'Der Login-Client ist im Realm vorhanden.',
    missingMessage: 'Der Login-Client fehlt im Realm.',
    remediationHint: 'Login-Client neu provisionieren oder Client-ID korrigieren.',
  });

  const secretCheck = createSecretAlignmentCheck({
    checkId: CHECK_IDS.keycloakLoginSecretAligned,
    title: 'Keycloak-Login-Secret abgeglichen',
    clientExists: status.clientExists,
    aligned: status.clientSecretAligned,
    evidenceSource,
    presentMessage: 'Das Login-Client-Secret ist zwischen Registry und Keycloak konsistent.',
    missingMessage: 'Das Login-Client-Secret weicht zwischen Registry und Keycloak ab.',
    remediationHint: 'Secret rotieren oder Registry-Wert gezielt mit Keycloak abgleichen.',
  });

  return [clientCheck, secretCheck];
};

const createTenantAdminClientChecks = (
  status: KeycloakTenantStatus,
  evidenceSource: string
): readonly InstanceAuditCheck[] => {
  const clientCheck = createPresenceCheck({
    checkId: CHECK_IDS.keycloakTenantAdminClientExists,
    title: 'Keycloak-Tenant-Admin-Client vorhanden',
    expected: 'Tenant-Admin-Client im Realm vorhanden',
    present: status.tenantAdminClientExists,
    evidenceSource,
    presentMessage: 'Der Tenant-Admin-Client ist im Realm vorhanden.',
    missingMessage: 'Der Tenant-Admin-Client fehlt im Realm.',
    remediationHint: 'Tenant-Admin-Client provisionieren oder Registry-Daten korrigieren.',
  });

  const secretCheck = createSecretAlignmentCheck({
    checkId: CHECK_IDS.keycloakTenantAdminSecretAligned,
    title: 'Keycloak-Tenant-Admin-Secret abgeglichen',
    clientExists: status.tenantAdminClientExists,
    aligned: status.tenantAdminClientSecretAligned,
    evidenceSource,
    presentMessage: 'Das Tenant-Admin-Client-Secret ist zwischen Registry und Keycloak konsistent.',
    missingMessage: 'Das Tenant-Admin-Client-Secret weicht zwischen Registry und Keycloak ab.',
    remediationHint: 'Tenant-Admin-Client-Secret rotieren oder Registry-Wert mit Keycloak abgleichen.',
  });

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
  fallbackStatus?: KeycloakTenantStatus | null;
  fallbackEvidenceSource?: string;
  fallbackError?: string;
}): readonly InstanceAuditCheck[] => {
  if (!input.keycloakStatus) {
    return createRealmUnavailableChecks({
      evidenceSource: input.keycloakEvidenceSource,
      keycloakError: input.keycloakError,
      fallbackStatus: input.fallbackStatus,
      fallbackEvidenceSource: input.fallbackEvidenceSource,
      fallbackError: input.fallbackError,
    });
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
