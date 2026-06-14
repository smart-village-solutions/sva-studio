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
} as const;
