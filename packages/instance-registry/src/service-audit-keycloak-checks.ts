import type { InstanceAuditCheck } from '@sva/core';
import type { KeycloakTenantStatus } from './keycloak-types.js';
import { CHECK_IDS, createCheck, createSkipCheck } from './service-audit-shared.js';

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
  createSkipCheck(CHECK_IDS.keycloakLoginClientExists, 'Keycloak-Login-Client vorhanden', 'keycloak', 'Login-Client im Realm vorhanden', evidenceSource, 'Wird erst geprüft, wenn der Realm erfolgreich gelesen werden kann.'),
  createSkipCheck(CHECK_IDS.keycloakLoginSecretAligned, 'Keycloak-Login-Secret abgeglichen', 'keycloak', 'Registry-Secret stimmt mit Keycloak überein', evidenceSource, 'Wird erst geprüft, wenn Realm und Login-Client erfolgreich gelesen werden können.'),
  createSkipCheck(CHECK_IDS.keycloakTenantAdminClientExists, 'Keycloak-Tenant-Admin-Client vorhanden', 'keycloak', 'Tenant-Admin-Client im Realm vorhanden', evidenceSource, 'Wird erst geprüft, wenn der Realm erfolgreich gelesen werden kann.'),
  createSkipCheck(CHECK_IDS.keycloakTenantAdminSecretAligned, 'Keycloak-Tenant-Admin-Secret abgeglichen', 'keycloak', 'Registry-Secret stimmt mit Keycloak überein', evidenceSource, 'Wird erst geprüft, wenn Realm und Tenant-Admin-Client erfolgreich gelesen werden können.'),
  createSkipCheck(CHECK_IDS.keycloakSystemAdminRoleExists, 'Keycloak-Rolle system_admin vorhanden', 'keycloak', 'Realm-Rolle system_admin vorhanden', evidenceSource, 'Wird erst geprüft, wenn der Realm erfolgreich gelesen werden kann.'),
  createSkipCheck(CHECK_IDS.keycloakSystemAdminUserExists, 'Keycloak-User mit system_admin vorhanden', 'keycloak', 'Mindestens ein User mit system_admin vorhanden', evidenceSource, 'Wird erst geprüft, wenn Realm, Rolle und Tenant-Admin-Status verfügbar sind.'),
];

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
    : createSkipCheck(input.checkId, input.title, 'keycloak', 'Registry-Secret stimmt mit Keycloak überein', input.evidenceSource, 'Wird erst geprüft, wenn der zugehörige Client vorhanden ist.');

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
    createSkipCheck(CHECK_IDS.keycloakLoginClientExists, 'Keycloak-Login-Client vorhanden', 'keycloak', 'Login-Client im Realm vorhanden', evidenceSource, 'Wird erst geprüft, wenn der Realm vorhanden ist.'),
    createSkipCheck(CHECK_IDS.keycloakLoginSecretAligned, 'Keycloak-Login-Secret abgeglichen', 'keycloak', 'Registry-Secret stimmt mit Keycloak überein', evidenceSource, 'Wird erst geprüft, wenn der Login-Client vorhanden ist.'),
    createSkipCheck(CHECK_IDS.keycloakTenantAdminClientExists, 'Keycloak-Tenant-Admin-Client vorhanden', 'keycloak', 'Tenant-Admin-Client im Realm vorhanden', evidenceSource, 'Wird erst geprüft, wenn der Realm vorhanden ist.'),
    createSkipCheck(CHECK_IDS.keycloakTenantAdminSecretAligned, 'Keycloak-Tenant-Admin-Secret abgeglichen', 'keycloak', 'Registry-Secret stimmt mit Keycloak überein', evidenceSource, 'Wird erst geprüft, wenn der Tenant-Admin-Client vorhanden ist.'),
    createSkipCheck(CHECK_IDS.keycloakSystemAdminRoleExists, 'Keycloak-Rolle system_admin vorhanden', 'keycloak', 'Realm-Rolle system_admin vorhanden', evidenceSource, 'Wird erst geprüft, wenn der Realm vorhanden ist.'),
    createSkipCheck(CHECK_IDS.keycloakSystemAdminUserExists, 'Keycloak-User mit system_admin vorhanden', 'keycloak', 'Mindestens ein User mit system_admin vorhanden', evidenceSource, 'Wird erst geprüft, wenn Rolle und Benutzerstatus lesbar sind.'),
  ];
};

const createLoginClientChecks = (status: KeycloakTenantStatus, evidenceSource: string): readonly InstanceAuditCheck[] => [
  createPresenceCheck({
    checkId: CHECK_IDS.keycloakLoginClientExists,
    title: 'Keycloak-Login-Client vorhanden',
    expected: 'Login-Client im Realm vorhanden',
    present: status.clientExists,
    evidenceSource,
    presentMessage: 'Der Login-Client ist im Realm vorhanden.',
    missingMessage: 'Der Login-Client fehlt im Realm.',
    remediationHint: 'Login-Client neu provisionieren oder Client-ID korrigieren.',
  }),
  createSecretAlignmentCheck({
    checkId: CHECK_IDS.keycloakLoginSecretAligned,
    title: 'Keycloak-Login-Secret abgeglichen',
    clientExists: status.clientExists,
    aligned: status.clientSecretAligned,
    evidenceSource,
    presentMessage: 'Das Login-Client-Secret ist zwischen Registry und Keycloak konsistent.',
    missingMessage: 'Das Login-Client-Secret weicht zwischen Registry und Keycloak ab.',
    remediationHint: 'Secret rotieren oder Registry-Wert gezielt mit Keycloak abgleichen.',
  }),
];

const createTenantAdminClientChecks = (status: KeycloakTenantStatus, evidenceSource: string): readonly InstanceAuditCheck[] => [
  createPresenceCheck({
    checkId: CHECK_IDS.keycloakTenantAdminClientExists,
    title: 'Keycloak-Tenant-Admin-Client vorhanden',
    expected: 'Tenant-Admin-Client im Realm vorhanden',
    present: status.tenantAdminClientExists,
    evidenceSource,
    presentMessage: 'Der Tenant-Admin-Client ist im Realm vorhanden.',
    missingMessage: 'Der Tenant-Admin-Client fehlt im Realm.',
    remediationHint: 'Tenant-Admin-Client provisionieren oder Registry-Daten korrigieren.',
  }),
  createSecretAlignmentCheck({
    checkId: CHECK_IDS.keycloakTenantAdminSecretAligned,
    title: 'Keycloak-Tenant-Admin-Secret abgeglichen',
    clientExists: status.tenantAdminClientExists,
    aligned: status.tenantAdminClientSecretAligned,
    evidenceSource,
    presentMessage: 'Das Tenant-Admin-Client-Secret ist zwischen Registry und Keycloak konsistent.',
    missingMessage: 'Das Tenant-Admin-Client-Secret weicht zwischen Registry und Keycloak ab.',
    remediationHint: 'Tenant-Admin-Client-Secret rotieren oder Registry-Wert mit Keycloak abgleichen.',
  }),
];

const createSystemAdminChecks = (status: KeycloakTenantStatus, evidenceSource: string): readonly InstanceAuditCheck[] => {
  const roleCheck = createPresenceCheck({
    checkId: CHECK_IDS.keycloakSystemAdminRoleExists,
    title: 'Keycloak-Rolle system_admin vorhanden',
    expected: 'Realm-Rolle system_admin vorhanden',
    present: status.systemAdminRoleExists,
    evidenceSource,
    presentMessage: 'Die Realm-Rolle system_admin ist vorhanden.',
    missingMessage: 'Die Realm-Rolle system_admin fehlt.',
    remediationHint: 'Rollen-Baseline im Tenant-Realm provisionieren.',
  });

  const userCheck = status.systemAdminRoleExists
    ? createCheck({
        checkId: CHECK_IDS.keycloakSystemAdminUserExists,
        title: 'Keycloak-User mit system_admin vorhanden',
        scope: 'keycloak',
        status: status.tenantAdminExists && status.tenantAdminHasSystemAdmin ? 'pass' : 'fail',
        expected: 'Mindestens ein User mit system_admin vorhanden',
        actual: status.tenantAdminExists && status.tenantAdminHasSystemAdmin ? 'vorhanden' : status.tenantAdminExists ? 'benutzer_ohne_system_admin' : 'kein_benutzer_nachweis',
        evidenceSource,
        message: status.tenantAdminExists && status.tenantAdminHasSystemAdmin ? 'Mindestens ein bekannter Tenant-Admin trägt die Rolle system_admin.' : status.tenantAdminExists ? 'Der bekannte Tenant-Admin existiert, trägt aber die Rolle system_admin nicht.' : 'Für den bekannten Tenant-Admin wurde kein system_admin-Nachweis gefunden.',
        remediationHint: status.tenantAdminExists && status.tenantAdminHasSystemAdmin ? undefined : 'Tenant-Admin-Benutzer und seine Keycloak-Rollenzuordnung prüfen.',
      })
    : createSkipCheck(CHECK_IDS.keycloakSystemAdminUserExists, 'Keycloak-User mit system_admin vorhanden', 'keycloak', 'Mindestens ein User mit system_admin vorhanden', evidenceSource, 'Wird erst geprüft, wenn die Realm-Rolle system_admin vorhanden ist.');

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
