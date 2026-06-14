export const doctorInstancesAdminDEResources = {
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
