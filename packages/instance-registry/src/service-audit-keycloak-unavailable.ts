import type { InstanceAuditCheck } from '@sva/core';
import type { KeycloakTenantStatus } from './keycloak-types.js';
import { CHECK_IDS, createCheck, createSkipCheck } from './service-audit-shared.js';

type RealmUnavailableInput = {
  evidenceSource: string;
  keycloakError?: string;
  fallbackStatus?: KeycloakTenantStatus | null;
  fallbackEvidenceSource?: string;
  fallbackError?: string;
};

const hasUsableFallbackStatus = (input: RealmUnavailableInput): boolean =>
  Boolean(input.fallbackEvidenceSource && input.fallbackStatus);

const createRealmUnavailableAccessDetails = (
  input: RealmUnavailableInput
): Record<string, unknown> => {
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

export const createRealmUnavailableChecks = (
  input: RealmUnavailableInput
): readonly InstanceAuditCheck[] => {
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
      actual: hasFallback ? 'live_nicht_verifiziert' : (input.keycloakError ?? 'nicht lesbar'),
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
      CHECK_IDS.keycloakPluginOidcClientsAligned,
      'Plugin-OIDC-Clients abgeglichen',
      'keycloak',
      'Deklarierte Plugin-OIDC-Clients entsprechen dem Sollzustand',
      input.evidenceSource,
      'Wird erst geprüft, wenn der Tenant-Realm live gelesen werden kann.'
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
