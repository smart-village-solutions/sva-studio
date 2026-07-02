export const adminBootstrapInstancesAdminDEResources = {
  title: 'Tenant-Admin-Struktur',
  subtitlePending:
    'Der Abschnitt ist Teil des Happy Path, wird aber erst nach erfolgreichem Registry-Create aktiv.',
  subtitleReady:
    'Optional Module auswählen und danach `system_admin` sowie die IAM-Basis für die zugewiesenen Module synchronisieren.',
  moduleHint: 'Enthält initial die Rechte: {{value}}',
  conflictHint:
    'Beim erneuten Bootstrap wird nur die geschützte Rolle `system_admin` auf den Sollzustand zurückgeführt. Bereits angelegte individuelle Rollen bleiben unberührt.',
  action: 'Tenant-Admin-Struktur jetzt anlegen',
  actionHintPending: 'Zuerst die Instanz anlegen, danach wird dieser Schritt aktiv.',
  actionHintReady:
    'Ohne Modulauswahl wird nur `system_admin` als tenantlokale Vollzugriffsrolle synchronisiert.',
  success:
    'Die Tenant-Admin-Struktur wurde erfolgreich synchronisiert. Der Setup-Schritt ist damit abgeschlossen.',
  modules: {
    categories: 'Kategorien',
    news: 'News',
    events: 'Events',
    poi: 'POI',
    media: 'Medien',
    surveys: 'Umfragen',
    wasteManagement: 'Abfallmanagement',
  },
} as const;
