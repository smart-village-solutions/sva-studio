export const pluginReadinessInstancesAdminDEResources = {
  title: 'Plugin-Betriebsbereitschaft',
  subtitle:
    'Zeigt den mandantenbezogenen Lifecycle- und Prüfstatus aller aktiven Plugins mit Lifecycle-Vertrag.',
  loading: 'Plugin-Status wird geladen …',
  empty: 'Für diese Instanz sind keine aktiven Plugins mit Lifecycle-Vertrag vorhanden.',
  error: 'Der Plugin-Status konnte nicht geladen oder aktualisiert werden: {{message}}',
  status: {
    pending: 'Ausstehend',
    ready: 'Betriebsbereit',
    degraded: 'Eingeschränkt',
    blocked: 'Blockiert',
  },
  aggregate: {
    ready: 'Alle Pflicht-Plugins sind betriebsbereit: {{plugins}}.',
    degraded: 'Mindestens ein Pflicht-Plugin ist nur eingeschränkt betriebsbereit: {{plugins}}.',
    blocked: 'Mindestens ein Pflicht-Plugin ist noch nicht betriebsbereit: {{plugins}}.',
  },
  policy: {
    label: 'Aktivierungsrichtlinie: {{policy}}',
    optional: 'Optional',
    automatic: 'Automatisch',
    required: 'Pflicht',
  },
  repair: 'Reparatur starten',
  repairRunning: 'Reparatur wird gestartet …',
  repairAriaLabel: 'Reparatur für Plugin {{pluginId}} starten',
  activeJob: 'Aktiven Job öffnen',
  activeJobAriaLabel: 'Aktiven Job für Plugin {{pluginId}} öffnen',
} as const;
