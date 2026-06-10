import type { InstanceAuditCheck } from '@sva/core';

import { CHECK_IDS, createCheck } from './service-audit-shared.js';

export const probeInstanceUrlReachability = async (primaryHostname: string): Promise<InstanceAuditCheck> => {
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

export const createRegistryChecks = (input: {
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

export const createLocalIamCheck = (assignmentCount: number): InstanceAuditCheck =>
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
