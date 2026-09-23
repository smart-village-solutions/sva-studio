export const cockpitInstancesAdminDEResources = {
  eyebrow: 'Control Tower',
  title: 'Operativer Überblick',
  subtitle:
    'Aktueller Zustand, dominante Befunde und die nächste sinnvolle Operator-Aktion auf einen Blick.',
  setup: {
    phase: 'Einrichtung · Phase 2 von 2',
    title: 'Instanz fertig einrichten',
    subtitle:
      'Die Angaben sind gespeichert. Folgen Sie jetzt den technischen Schritten bis zur manuellen Aktivierung.',
    ariaLabel: 'Fortschritt der Instanzeinrichtung',
    secondaryTitle: 'Betrieb, Doctor und Einstellungen',
    secondaryDescription:
      'Diese erweiterten Bereiche bleiben verfügbar, sind während der Ersteinrichtung aber nachgeordnet.',
    technical: {
      title: 'Technische Teilschritte',
      keycloak: 'Keycloak-Konfiguration',
      tenantAdmin: 'Tenant-Administrator',
      tenantIam: 'Lokaler IAM-Abgleich',
    },
    steps: {
      prepare: {
        title: 'Bereitstellung vorbereiten',
        description: 'Vorbedingungen und den aktuellen Änderungsplan prüfen.',
      },
      confirm: {
        title: 'Änderungen bestätigen',
        description: 'Den geprüften Plan ausdrücklich zur Ausführung freigeben.',
      },
      provision: {
        title: 'Technische Bereitstellung',
        description: 'Realm, Clients, Secrets und Tenant-Administrator einrichten.',
      },
      verify: {
        title: 'Betriebsbereitschaft prüfen',
        description: 'Tenant-IAM, Module und technische Nachweise kontrollieren.',
      },
      activate: {
        title: 'Aktivieren',
        description: 'Die vollständig geprüfte Instanz manuell freigeben.',
      },
    },
  },
  identity: 'Instanz',
  currentState: 'Gesamtstatus',
  configurationSnapshot: 'Konfiguration',
  lifecycle: 'Lifecycle',
  primaryAction: 'Steuerung',
  primaryActionTitle: 'Nächste empfohlene Aktion',
  secondaryActions: 'Spezial- und Folgeaktionen',
  anomaliesTitle: 'Offene Befunde',
  anomaliesSubtitle: 'Verdichtete Anomalien, bevor Sie in Betrieb oder Historie abtauchen.',
  anomaliesEmpty:
    'Keine dominanten Abweichungen. Die Instanz zeigt aktuell keinen priorisierten Befund.',
  evidenceTitle: 'Dominante Evidenz',
  evidenceSubtitle: 'Quelle, Frische und Herkunft des führenden Zustands für den Erstblick.',
  checkedAt: 'Belastbare Evidenz: {{value}}',
  noEvidenceTimestamp: 'Keine belastbare Zeitmarke verfügbar.',
  tabsAriaLabel: 'Arbeitsbereiche der Instanz-Detailseite',
  tabs: {
    overview: 'Überblick',
    configuration: 'Konfiguration',
    modules: 'Module',
    operations: 'Betrieb',
    history: 'Historie',
  },
  overall: {
    ready: 'Betriebsbereit',
    degraded: 'Eingeschränkt',
    blocked: 'Blockiert',
    unknown: 'Status unklar',
  },
  evidence: {
    tenantIam: 'Tenant-IAM-Betrieb',
    preflight: 'Keycloak-Vorbedingungen',
    provisioning: 'Letzter Provisioning-Lauf',
    registry: 'Registry-Grundlage',
  },
  sources: {
    accessProbe: 'Quelle: Tenant-IAM-Rechteprobe',
    reconcile: 'Quelle: Rollenabgleich',
    keycloakStatus: 'Quelle: Keycloak-Strukturstatus',
    provisioningRun: 'Quelle: Keycloak-Provisioning-Lauf',
    registry: 'Quelle: Registry',
    diagnostics: 'Quelle: Laufzeitdiagnostik',
  },
  anomalies: {
    configuration: 'Tenant-IAM-Konfiguration',
    access: 'Tenant-IAM-Zugriff',
    reconcile: 'Tenant-IAM-Reconcile',
    provisioning: 'Provisioning',
    diagnostics: 'Diagnose',
  },
} as const;
