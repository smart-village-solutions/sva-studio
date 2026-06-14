export const setupInstancesAdminDEResources = {
  title: 'Setup abschließen',
  subtitle:
    'Die Instanz {{instanceId}} ist angelegt. Schließen Sie jetzt Aktivierung und Tenant-Admin-Struktur ab, bevor Sie in den normalen Betrieb wechseln.',
  temporaryPasswordTitle: 'Temporäres Tenant-Admin-Passwort',
  temporaryPasswordHint:
    'Nur erforderlich, wenn der Workflow beim Zurücksetzen des Tenant-Admins ein Passwort setzen soll.',
  status: {
    title: 'Setup-Status',
    subtitle:
      'Der Setup-Flow ist abgeschlossen, sobald die Instanz aktiv ist und die Tenant-Admin-Struktur initialisiert wurde.',
    activationTitle: 'Instanz aktiviert',
    activationPending: 'Aktivieren Sie die Instanz nach erfolgreichem Provisioning.',
    activationDone: 'Die Instanz ist aktiv geschaltet.',
    adminStructureTitle: 'Tenant-Admin-Struktur initialisiert',
    adminStructurePending:
      'Synchronisieren Sie `system_admin` und die benötigten Module für den Start.',
    adminStructureDone: 'Die geschützte Tenant-Admin-Struktur wurde initialisiert.',
  },
  completion: {
    ready: 'Setup abgeschlossen. Sie können jetzt in den normalen Betrieb wechseln.',
    pending: 'Setup noch nicht abgeschlossen. Prüfen Sie zuerst die beiden Pflichtschritte.',
  },
  actions: {
    completeSetup: 'Setup abschließen',
    openOperations: 'Zur Betriebsansicht wechseln',
    backToOverview: 'Zur Übersicht',
  },
} as const;
