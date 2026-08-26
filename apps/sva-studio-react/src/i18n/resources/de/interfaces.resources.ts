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
    configured: 'Eingerichtet',
    error: 'Fehler',
    disabled: 'Deaktiviert',
    unknown: 'Unbekannt',
    healthcheck: {
      disabled: 'Die Karten-/Geocoding-Schnittstelle ist per Kill-Switch deaktiviert.',
      secretMissing: 'Für diese Karten-/Geocoding-Schnittstelle fehlt der API-Key.',
      mapGeocodingProviderUnsupported:
        'Automatische Verbindungsprüfungen werden derzeit nur für Geoapify unterstützt.',
      mapGeocodingAuthFailed: 'Der Geoapify-API-Key ist ungültig oder nicht berechtigt.',
      mapGeocodingRateLimited:
        'Geoapify hat die Verbindungsprüfung wegen zu vieler Anfragen begrenzt.',
      mapGeocodingUnreachable: 'Geoapify ist für die Verbindungsprüfung nicht erreichbar.',
      mapGeocodingProviderError: 'Geoapify konnte die Verbindungsprüfung nicht abschließen.',
    },
  },
  form: {
    sectionTitle: 'Mainserver-Einstellungen',
    graphqlBaseUrl: 'GraphQL Basis-URL',
    oauthTokenUrl: 'OAuth Token-URL',
    enabled: 'Integration aktiv',
  },
  actions: {
    save: 'Einstellungen speichern',
    saving: 'Wird gespeichert…',
    saved: 'Gespeichert',
    retry: 'Erneut versuchen',
    reload: 'Neu laden',
    dismiss: 'Schließen',
  },
  messages: {
    loading: 'Schnittstellen werden geladen ...',
    loadError: 'Schnittstellen konnten nicht geladen werden.',
    saveSuccess: 'Schnittstellen-Einstellungen wurden gespeichert.',
    saveError: 'Schnittstellen-Einstellungen konnten nicht gespeichert werden.',
    refreshAfterSaveError:
      'Die Einstellungen wurden übertragen, konnten aber nicht neu geladen werden. Bitte erneut versuchen.',
    deleteSuccessTitle: 'Schnittstelle gelöscht',
    deleteSuccess: 'Die Schnittstelle „{{name}}“ wurde endgültig gelöscht.',
    deleteError: 'Die Schnittstelle konnte nicht gelöscht werden.',
    refreshAfterDeleteError:
      'Die Schnittstelle wurde gelöscht, die Liste konnte aber nicht aktualisiert werden. Bitte neu laden.',
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
    interfaceTypeNotRegistered:
      'Der Schnittstellentyp ist in dieser Installation noch nicht registriert. Bitte die Studio-Datenbankmigrationen ausführen und erneut versuchen.',
    supabaseRequiresWasteManagementModule:
      'Supabase kann nur für Instanzen mit zugewiesenem Abfall-Management-Modul angelegt werden.',
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
      description:
        'GraphQL-Endpoint und OAuth-Token-URL für Nachrichten-, Veranstaltungs- und POI-Importe.',
    },
    s3: {
      label: 'S3-kompatibler Object Storage',
      description:
        'Bucket-Anbindung für die Medienverwaltung (Endpoint, Region, Bucket, Zugangsschlüssel).',
    },
    supabase: {
      label: 'Supabase',
      description:
        'Abfall-Datenquelle mit Projekt-URL, Schema, Datenbankzugang und Service-Role-Key.',
    },
    postgresql: {
      label: 'PostgreSQL',
      description: 'Direkte PostgreSQL-Datenquelle mit Schema und verschlüsseltem Datenbankzugang.',
    },
    mailTransport: {
      label: 'Mail-Transport',
      description: 'Zentrale technische SMTP-Anbindung für transaktionale Zustellung.',
    },
    mapGeocoding: {
      label: 'Karte & Geocoding',
      description:
        'Tenant-eigene Karten- und Geocoding-Konfiguration für Adresseingabe, Koordinaten und Kartenstil.',
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
    deletePending: 'Wird gelöscht…',
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
    postgresql: {
      schemaName: 'Schema',
      databaseUrl: 'Datenbank-URL',
    },
    mailTransport: {
      transportId: 'Transport-ID',
      host: 'SMTP-Host',
      port: 'Port',
      securityMode: 'Sicherheitsmodus',
      securityModeOptions: {
        none: 'Keine',
        starttls: 'STARTTLS',
        tls: 'TLS',
      },
      authMode: 'Authentifizierungsmodus',
      authModeOptions: {
        none: 'Keine',
        basic: 'Basic Auth',
      },
      username: 'Benutzername',
      password: 'Passwort',
      defaultFromEmail: 'Standard-Absenderadresse',
      defaultFromName: 'Standard-Absendername',
      defaultReplyToEmail: 'Standard-Reply-To',
      maxBatchSize: 'Maximale Batch-Größe',
      rateLimitPerMinute: 'Rate-Limit pro Minute',
    },
    mapGeocoding: {
      setup: {
        title: 'Empfohlene Einrichtung mit Geoapify',
        description:
          'Für die automatische Postleitzahl-Ergänzung wird ein Geoapify-API-Key benötigt.',
        createProject: 'Bei Geoapify anmelden und ein Projekt erstellen',
        copyApiKey: 'Den erzeugten API-Key kopieren und unten in „API-Key“ eintragen',
        keepDefaults:
          'Die Endpoint-Felder leer lassen, Geocoding aktivieren und den Kill-Switch deaktiviert lassen',
        openGeoapify: 'Geoapify-Projekt und API-Key anlegen',
      },
      provider: 'Provider',
      providerOptions: {
        custom: 'Benutzerdefiniert',
      },
      styleUrl: 'Style-URL',
      suggestEndpoint: 'Suggest-Endpoint',
      geocodeEndpoint: 'Geocode-Endpoint',
      reverseGeocodeEndpoint: 'Reverse-Geocode-Endpoint',
      apiKey: 'API-Key',
      apiKeyReplacementPlaceholder: 'Neuen API-Key eingeben',
      apiKeyConfiguredStatus: 'Ein API-Key ist bereits hinterlegt',
      apiKeyConfiguredHint: 'Leer lassen, um den vorhandenen API-Key beizubehalten',
      requestTimeoutMs: 'Timeout in ms',
      rateLimitPerMinute: 'Rate-Limit pro Minute',
      autocompleteEnabled: 'Autocomplete aktivieren',
      geocodeEnabled: 'Geocoding aktivieren',
      reverseGeocodeEnabled: 'Reverse-Geocoding aktivieren',
      killSwitchEnabled: 'Kill-Switch aktivieren',
    },
  },
} as const;
