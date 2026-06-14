export const interfacesDEResources = {
  page: {
    title: 'Schnittstellen',
    subtitle: 'SVA-Mainserver-Endpunkte verwalten und Verbindungsstatus prüfen',
  },
  status: {
    cardTitle: 'Verbindungsstatus',
    instanceLabel: 'Instanz',
    currentLabel: 'Status',
    lastCheckedLabel: 'Zuletzt geprüft',
    connected: 'Verbunden',
    error: 'Fehler',
    disabled: 'Deaktiviert',
    unknown: 'Unbekannt',
  },
  form: {
    sectionTitle: 'Mainserver-Einstellungen',
    graphqlBaseUrl: 'GraphQL Basis-URL',
    oauthTokenUrl: 'OAuth Token-URL',
    enabled: 'Integration aktiv',
  },
  actions: {
    save: 'Einstellungen speichern',
    saving: 'Speichert ...',
    reload: 'Neu laden',
  },
  messages: {
    loading: 'Schnittstellen werden geladen ...',
    loadError: 'Schnittstellen konnten nicht geladen werden.',
    saveSuccess: 'Schnittstellen-Einstellungen wurden gespeichert.',
    saveError: 'Schnittstellen-Einstellungen konnten nicht gespeichert werden.',
  },
  errors: {
    configNotFound: 'Für diese Instanz ist noch keine Mainserver-Konfiguration hinterlegt.',
    integrationDisabled: 'Die Mainserver-Integration ist derzeit deaktiviert.',
    invalidConfig: 'Die Mainserver-Konfiguration ist ungültig.',
    invalidGraphqlBaseUrl: 'Die GraphQL Basis-URL ist ungültig.',
    invalidOauthTokenUrl: 'Die OAuth Token-URL ist ungültig.',
    databaseUnavailable:
      'Die Konfiguration konnte wegen eines Datenbankproblems nicht geladen werden.',
    identityProviderUnavailable: 'Der Identity Provider ist derzeit nicht erreichbar.',
    missingCredentials: 'Für die Mainserver-Verbindung fehlen Zugangsdaten.',
    tokenRequestFailed: 'Der Zugriffstoken für den Mainserver konnte nicht abgerufen werden.',
    unauthorized: 'Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.',
    forbidden: 'Keine Berechtigung zur Schnittstellenverwaltung.',
    customInterfacesNotSupported:
      'Zusätzliche Schnittstellen werden erst unterstützt, sobald das Backend für diese Typen angebunden ist.',
    interfaceNotFound: 'Die gewählte Schnittstelle wurde nicht gefunden oder bereits entfernt.',
    interfaceInstanceMismatch:
      'Die gewählte Schnittstelle gehört nicht zur aktuellen Instanz und konnte nicht geändert werden.',
    interfaceTypeChangeNotSupported:
      'Der Typ einer vorhandenen Schnittstelle kann nicht nachträglich geändert werden.',
    supabaseRequiresWasteManagementModule:
      'Supabase kann nur für Instanzen mit zugewiesenem Waste-Management-Modul angelegt werden.',
    secretUnreadable:
      'Das gespeicherte Secret der Schnittstelle konnte serverseitig nicht mehr gelesen werden. Bitte den Secret-Wert neu eintragen und erneut speichern.',
    networkError: 'Der Verbindungsstatus konnte nicht abgerufen werden.',
    graphqlError: 'Der Mainserver hat einen GraphQL-Fehler zurückgegeben.',
    invalidResponse: 'Der Mainserver hat eine unerwartete Antwort zurückgegeben.',
  },
  table: {
    ariaLabel: 'Schnittstellen der Instanz',
    caption: 'Alle pro Instanz konfigurierten Schnittstellen mit Typ, Status und letztem Check.',
    headerName: 'Name',
    headerType: 'Typ',
    headerEndpoint: 'Endpoint',
    headerStatus: 'Status',
    headerLastChecked: 'Letzte Prüfung',
    emptyState: 'Für diese Instanz sind noch keine Schnittstellen hinterlegt.',
    countLabel: '{{count}} Schnittstelle(n)',
  },
  types: {
    mainserver: {
      label: 'SVA Mainserver',
      description: 'GraphQL-Endpoint und OAuth-Token-URL für News-, Events- und POI-Importe.',
    },
    s3: {
      label: 'S3-kompatibler Object Storage',
      description:
        'Bucket-Anbindung für die Medienverwaltung (Endpoint, Region, Bucket, Zugangsschlüssel).',
    },
    supabase: {
      label: 'Supabase',
      description:
        'Waste-Datenquelle mit Projekt-URL, Schema, Datenbankzugang und Service-Role-Key.',
    },
  },
  create: {
    action: 'Neue Schnittstelle',
    dialogTitle: 'Schnittstellentyp wählen',
    dialogDescription:
      'Wähle aus, welche Art von Schnittstelle für diese Instanz angelegt werden soll.',
    cancel: 'Abbrechen',
    continue: 'Weiter',
  },
  edit: {
    title: 'Schnittstelle bearbeiten',
    deleteAction: 'Löschen',
    deleteConfirmTitle: 'Schnittstelle löschen?',
    deleteConfirmDescription: 'Die Schnittstelle „{{name}}" wird unwiderruflich entfernt.',
    deleteConfirm: 'Endgültig löschen',
    cancel: 'Abbrechen',
    commonName: 'Anzeigename',
    commonEnabled: 'Aktiv',
  },
  forms: {
    s3: {
      endpoint: 'Endpoint-URL',
      region: 'Region',
      bucket: 'Bucket',
      accessKeyId: 'Access Key ID',
      secretAccessKey: 'Secret Access Key',
      forcePathStyle: 'Path-Style-URLs erzwingen',
      notImplemented:
        'Hinweis: Diese Schnittstelle wird bereits serverseitig gespeichert. Automatische Statusprüfungen und Verbindungschecks folgen noch.',
    },
    supabase: {
      projectUrl: 'Projekt-URL',
      schemaName: 'Schema',
      databaseUrl: 'Direkte DB-URL',
      serviceRoleKey: 'Service-Role-Key',
      notImplemented:
        'Hinweis: Diese Schnittstelle wird bereits serverseitig gespeichert. Automatische Statusprüfungen und Verbindungschecks folgen noch.',
    },
  },
} as const;
