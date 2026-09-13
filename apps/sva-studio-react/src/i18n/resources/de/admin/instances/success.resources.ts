export const successInstancesAdminDEResources = {
  title: 'Instanz gespeichert',
  summary:
    'Die Instanz {{instanceId}} wurde in der Registry angelegt. Aktueller Status: {{status}}.',
  actions: {
    openDetail: 'Detailseite öffnen',
    backToOverview: 'Zur Übersicht',
  },
  nextSteps: {
    openSetup:
      'Öffnen Sie danach den Setup-Flow, um Provisioning, Aktivierung und Tenant-Admin-Struktur abzuschließen.',
    runProvisioning: 'Führen Sie dort den Keycloak-Abgleich für Realm {{realm}} aus.',
    activate: 'Aktivieren Sie die Instanz erst nach erfolgreichem Provisioning für {{hostname}}.',
  },
  automated: {
    title: 'Mandanten-Provisionierung angenommen',
    summary:
      'Die Instanz {{instanceId}} wird serverseitig provisioniert. Lauf-ID: {{runId}}. Das Schließen dieser Seite unterbricht den Vorgang nicht.',
    nextSteps: {
      observe: 'Öffnen Sie die Detailseite, um den aktuellen Provisioning-Schritt zu beobachten.',
      waitForTerminal:
        'Die Anlage ist erst abgeschlossen, wenn Instanz und Lauf den Status „Aktiv“ erreicht haben.',
      retryOnFailure:
        'Bei einem terminalen Fehler bleiben Diagnoseartefakte erhalten; ein autorisierter Retry setzt den Lauf fort.',
    },
  },
} as const;
