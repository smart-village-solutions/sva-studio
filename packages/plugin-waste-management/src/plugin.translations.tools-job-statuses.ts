export const wasteManagementJobStatusesDE = {
  queued: 'Vorgang wartet auf Ausführung',
  running: 'Vorgang wird ausgeführt',
  retrying: 'Vorgang wird erneut versucht',
  succeeded: 'Vorgang abgeschlossen',
  failed: 'Vorgang fehlgeschlagen',
  cancelled: 'Vorgang abgebrochen',
} as const;

export const wasteManagementJobStatusesEN = {
  queued: 'Operation is queued',
  running: 'Operation is running',
  retrying: 'Operation is being retried',
  succeeded: 'Operation completed',
  failed: 'Operation failed',
  cancelled: 'Operation cancelled',
} as const;

export const wasteManagementJobPhasesDE = {
  'waste-management': {
    'provision-database': 'Datenbank wird provisioniert',
    'tenant-readiness': 'Datenbankbereitschaft wird geprüft',
    'apply-migrations': 'Migrationen werden angewendet',
    'verify-access': 'Datenbankzugriff wird geprüft',
    initialize: 'Datenquelle wird initialisiert',
    migrations: 'Migrationen werden ausgeführt',
    'import-preparation': 'Vorbereitung läuft',
    'import-running': 'Importlauf läuft',
    'export-preparation': 'Export wird vorbereitet',
    'export-running': 'Export läuft',
    seed: 'Initialdaten werden geladen',
    reset: 'Abfalldaten werden zurückgesetzt',
    'mainserver-sync': 'Mainserver-Synchronisierung läuft',
    'sync-waste-types': 'Abfallarten werden synchronisiert',
    'enrich-postal-codes': 'Postleitzahlen werden ermittelt',
    'materialize-email-reminders': 'E-Mail-Erinnerungen werden erstellt',
    'process-email-reminder-outbox': 'E-Mail-Erinnerungen werden versendet',
    completed: 'Vorgang wird abgeschlossen',
  },
} as const;

export const wasteManagementJobTypesDE = {
  'provision-tenant-database': 'Mandantendatenbank bereitstellen',
  'tenant-readiness': 'Datenbankbereitschaft prüfen',
  'initialize-data-source': 'Datenquelle initialisieren',
  'apply-migrations': 'Datenbankmigrationen anwenden',
  'import-data': 'Fachdaten importieren',
  'export-data': 'Fachdaten exportieren',
  'seed-data': 'Initialdaten laden',
  'reset-data': 'Abfalldaten zurücksetzen',
  'sync-mainserver': 'Mit dem Mainserver abgleichen',
  'sync-waste-types': 'Abfallarten synchronisieren',
  'materialize-email-reminders': 'E-Mail-Erinnerungen erstellen',
  'process-email-reminder-outbox': 'E-Mail-Erinnerungen versenden',
  'enrich-postal-codes': 'Postleitzahlen ergänzen',
} as const;

export const wasteManagementJobPhasesEN = {
  'waste-management': {
    'provision-database': 'Database is being provisioned',
    'tenant-readiness': 'Database readiness is being checked',
    'apply-migrations': 'Migrations are being applied',
    'verify-access': 'Database access is being verified',
    initialize: 'Data source is being initialized',
    migrations: 'Migrations are running',
    'import-preparation': 'Preparation in progress',
    'import-running': 'Import run in progress',
    'export-preparation': 'Export is being prepared',
    'export-running': 'Export is running',
    seed: 'Initial data is being loaded',
    reset: 'Waste data is being reset',
    'mainserver-sync': 'Mainserver synchronization is running',
    'sync-waste-types': 'Waste types are being synchronized',
    'enrich-postal-codes': 'Postal codes are being resolved',
    'materialize-email-reminders': 'Email reminders are being created',
    'process-email-reminder-outbox': 'Email reminders are being sent',
    completed: 'Operation is being completed',
  },
} as const;

export const wasteManagementJobTypesEN = {
  'provision-tenant-database': 'Provision tenant database',
  'tenant-readiness': 'Check database readiness',
  'initialize-data-source': 'Initialize data source',
  'apply-migrations': 'Apply database migrations',
  'import-data': 'Import data',
  'export-data': 'Export data',
  'seed-data': 'Load initial data',
  'reset-data': 'Reset waste data',
  'sync-mainserver': 'Synchronize with Mainserver',
  'sync-waste-types': 'Synchronize waste types',
  'materialize-email-reminders': 'Prepare email reminders',
  'process-email-reminder-outbox': 'Send email reminders',
  'enrich-postal-codes': 'Complete postal codes',
} as const;
