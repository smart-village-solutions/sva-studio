export const doctorInstancesAdminDEResources = {
  serviceIdentity: 'Service: {{value}}',
  classification: 'Befund: {{value}}',
  classifications: {
    ready: 'betriebsbereit',
    missing: 'Objekt fehlt',
    forbidden: 'Recht fehlt',
    unknown: 'Evidenz unzureichend',
    unavailable: 'Dienst nicht erreichbar',
    misconfigured: 'Konfiguration fehlerhaft',
  },
  remediation: {
    missing: 'Der Studio Provisioner muss die fehlende Keycloak-Struktur gezielt reparieren.',
    forbidden:
      'Prüfen Sie den Rollenvertrag von sva-studio-tenant-iam; verwenden Sie keine Provisioner-Credentials als Ersatz.',
    unknown:
      'Wiederholen Sie die Rechteprobe mit sva-studio-tenant-iam oder prüfen Sie die Strukturevidenz des Provisioners.',
    unavailable: 'Stellen Sie die Keycloak-Erreichbarkeit wieder her und wiederholen Sie danach die Probe.',
    misconfiguredProvisioner:
      'Der Studio Provisioner muss die abweichende technische Konfiguration gezielt abgleichen.',
    misconfiguredTenantIam:
      'Prüfen Sie die tenantgebundene Konfiguration von sva-studio-tenant-iam und wiederholen Sie die Probe.',
  },
  warning: {
    title: 'Doctor erkennt aktuell Handlungsbedarf.',
  },
  steps: {
    overview: {
      title: 'Überblick',
      subtitle: 'Zeigt grüne und offene Prüfungen gemeinsam, bevor Sie in eine Reparatur springen.',
    },
    recommendation: {
      title: 'Empfohlene Maßnahme',
      subtitle: 'Die nächste sinnvolle Aktion auf Basis der aktuellen Evidenz.',
    },
    repair: {
      title: 'Reparatur ausführen',
      subtitle: 'Starten Sie gezielt den passenden Korrekturlauf oder Folgeeingriff.',
    },
    validation: {
      title: 'Validieren',
      subtitle: 'Prüfen Sie die grünen Vorbedingungen erneut und bestätigen Sie den neuen Zustand.',
    },
  },
  checks: {
    configuration: 'Konfiguration',
    tenantAccess: 'Tenant-Zugriff',
    tenantReconcile: 'Tenant-Reconcile',
    preflight: 'Vorbedingungen',
    latestRun: 'Letzter technischer Lauf',
  },
  validation: {
    ready:
      'Doctor erkennt aktuell keinen priorisierten Befund. Nutzen Sie die Validierung bei Bedarf erneut.',
    degraded:
      'Doctor empfiehlt nach der Korrektur eine erneute Validierung der Vorbedingungen und des Live-Status.',
    blocked:
      'Doctor hat blockierende Befunde erkannt und priorisiert die nächste Maßnahme vor dem Weiterbetrieb.',
  },
  historyTitle: 'Historie',
  historySubtitle:
    'Technische Läufe bleiben zur Diagnose sichtbar, folgen aber bewusst erst nach Überblick, Maßnahme, Reparatur und Validierung.',
} as const;
