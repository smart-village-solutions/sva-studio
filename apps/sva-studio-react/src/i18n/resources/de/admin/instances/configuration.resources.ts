export const configurationInstancesAdminDEResources = {
  title: 'Konfigurationsstatus',
  labels: {
    lifecycle: 'Lifecycle',
    requirements: 'Erfüllte Anforderungen',
    requirementsValue: '{{satisfied}} / {{total}} Anforderungen erfüllt',
    blockingIssues: 'Konkrete Blocker',
    warnings: 'Hinweise',
  },
  overall: {
    complete: 'Vollständig',
    degraded: 'Mit Hinweisen',
    incomplete: 'Unvollständig',
    unknown: 'Ungeprüft',
  },
  summary: {
    complete: {
      title: 'Konfiguration vollständig',
      body: 'Alle kanonischen Keycloak-Anforderungen für diese Instanz sind aktuell erfüllt.',
    },
    degraded: {
      title: 'Konfiguration betriebsfähig mit Hinweisen',
      body: 'Die Pflichtanforderungen sind erfüllt, aber es bestehen noch betriebliche Hinweise oder Abweichungen.',
    },
    incomplete: {
      title: 'Konfiguration unvollständig',
      body: 'Es sind noch {{count}} kanonische Anforderungen offen oder fehlerhaft.',
    },
    unknown: {
      title: 'Konfigurationsstatus nicht verifiziert',
      body: 'Die kanonischen Anforderungen wurden noch nicht vollständig gegen Keycloak geprüft.',
      keycloakUnavailable:
        'Die kanonischen Anforderungen konnten aktuell nicht zuverlässig gegen Keycloak geprüft werden.',
    },
    expectedArtifacts: {
      title: 'Konfiguration vorbereitet',
      pending:
        'Für einen neuen Realm sind fehlende Keycloak-Artefakte vor dem ersten technischen Lauf erwartbar. Prüfen Sie den Vertrag und starten Sie anschließend den nächsten Schritt.',
      running:
        'Der neue Realm befindet sich im technischen Aufbau. Fehlende Keycloak-Artefakte werden bis zum Abschluss des Realm-Grundaufbaus nicht als aktuelle Blocker gewertet.',
    },
  },
} as const;
