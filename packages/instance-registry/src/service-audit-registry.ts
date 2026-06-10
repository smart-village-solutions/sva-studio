import type { InstanceAuditCheck } from '@sva/core';

import { CHECK_IDS, createCheck } from './service-audit-shared.js';

const hasConfiguredValue = (value?: string): value is string => typeof value === 'string' && value.trim().length > 0;

const createConfiguredValueCheck = (input: {
  checkId: string;
  title: string;
  expected: string;
  configuredValue?: string;
  configuredMessage: string;
  missingMessage: string;
  remediationHint: string;
}): InstanceAuditCheck =>
  createCheck({
    checkId: input.checkId,
    title: input.title,
    scope: 'registry',
    status: hasConfiguredValue(input.configuredValue) ? 'pass' : 'fail',
    expected: input.expected,
    actual: hasConfiguredValue(input.configuredValue) ? input.configuredValue : 'leer',
    evidenceSource: 'instance_registry',
    message: hasConfiguredValue(input.configuredValue) ? input.configuredMessage : input.missingMessage,
    remediationHint: hasConfiguredValue(input.configuredValue) ? undefined : input.remediationHint,
  });

const createSecretConfiguredCheck = (input: {
  checkId: string;
  title: string;
  configured: boolean;
  expected: string;
  configuredMessage: string;
  missingMessage: string;
  remediationHint: string;
}): InstanceAuditCheck =>
  createCheck({
    checkId: input.checkId,
    title: input.title,
    scope: 'registry',
    status: input.configured ? 'pass' : 'fail',
    expected: input.expected,
    actual: input.configured ? 'konfiguriert' : 'nicht konfiguriert',
    evidenceSource: 'instance_registry',
    message: input.configured ? input.configuredMessage : input.missingMessage,
    remediationHint: input.configured ? undefined : input.remediationHint,
  });

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
  createConfiguredValueCheck({
    checkId: CHECK_IDS.registryRealmPresent,
    title: 'Registry-Realm vorhanden',
    expected: 'Nicht-leerer authRealm',
    configuredValue: input.authRealm,
    configuredMessage: 'Ein Auth-Realm ist im Registry-Vertrag hinterlegt.',
    missingMessage: 'Im Registry-Vertrag fehlt der Auth-Realm.',
    remediationHint: 'Instanzvertrag um einen gültigen Auth-Realm ergänzen.',
  }),
  createConfiguredValueCheck({
    checkId: CHECK_IDS.registryLoginClientPresent,
    title: 'Registry-Login-Client vorhanden',
    expected: 'Nicht-leere authClientId',
    configuredValue: input.authClientId,
    configuredMessage: 'Ein Login-Client ist im Registry-Vertrag hinterlegt.',
    missingMessage: 'Im Registry-Vertrag fehlt die Login-Client-ID.',
    remediationHint: 'Instanzvertrag um die Login-Client-ID ergänzen.',
  }),
  createConfiguredValueCheck({
    checkId: CHECK_IDS.registryTenantAdminClientPresent,
    title: 'Registry-Tenant-Admin-Client vorhanden',
    expected: 'Tenant-Admin-Client-ID konfiguriert',
    configuredValue: input.tenantAdminClientId,
    configuredMessage: 'Ein Tenant-Admin-Client ist im Registry-Vertrag hinterlegt.',
    missingMessage: 'Im Registry-Vertrag fehlt der Tenant-Admin-Client.',
    remediationHint: 'Instanzvertrag um Tenant-Admin-Client-ID und Secret ergänzen.',
  }),
  createSecretConfiguredCheck({
    checkId: CHECK_IDS.registryLoginSecretConfigured,
    title: 'Registry-Login-Secret konfiguriert',
    configured: input.authClientSecretConfigured,
    expected: 'Login-Client-Secret hinterlegt',
    configuredMessage: 'Für den Login-Client ist ein Secret in der Registry hinterlegt.',
    missingMessage: 'Für den Login-Client fehlt das Secret in der Registry.',
    remediationHint: 'Login-Client-Secret in der Root-Instanz nachpflegen.',
  }),
  createSecretConfiguredCheck({
    checkId: CHECK_IDS.registryTenantAdminSecretConfigured,
    title: 'Registry-Tenant-Admin-Secret konfiguriert',
    configured: input.tenantAdminSecretConfigured,
    expected: 'Tenant-Admin-Client-Secret hinterlegt',
    configuredMessage: 'Für den Tenant-Admin-Client ist ein Secret in der Registry hinterlegt.',
    missingMessage: 'Für den Tenant-Admin-Client fehlt das Secret in der Registry.',
    remediationHint: 'Tenant-Admin-Client-Secret in der Root-Instanz nachpflegen.',
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
