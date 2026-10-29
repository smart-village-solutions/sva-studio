export const interfacesDEResources = {
  deepl: {
    refreshFailed:
      'Prüfung beendet, aber der aktuelle Schnittstellenstand konnte nicht geladen werden. Bitte erneut versuchen.',
    plan: 'DeepL-API-Tarif',
    pro: 'DeepL API Pro',
    free: 'DeepL API Free',
    apiKey: 'API-Key',
    keyStored:
      'Ein API-Key ist hinterlegt. Leer lassen, um ihn beizubehalten; ein neuer Key muss erneut geprüft werden.',
    keyRequired:
      'Hinterlege den eigenen DeepL-API-Key dieser Instanz. Der Key wird verschlüsselt gespeichert.',
    check: 'Verbindung prüfen',
    checking: 'DeepL wird geprüft …',
    checkFailed: 'DeepL konnte nicht geprüft werden. Bitte erneut versuchen.',
    saveFirst:
      'Speichere die Konfiguration vor der Prüfung. Beim Öffnen oder Speichern werden keine Texte an DeepL gesendet.',
    variant: 'Variante für {{language}}',
    recheck: 'Verbindung erneut prüfen',
    verified: 'Verbindung geprüft',
    languages: 'Angebotene Sprachen dieser Instanz',
    languagesHelp:
      'Deutsch bleibt als Ausgangssprache verfügbar. Wähle nach erfolgreicher Prüfung die gewünschten Zielsprachen aus. Es entstehen hier noch keine Übersetzungsaufträge.',
    checkFirst: 'Speichere zuerst den API-Key und lade die von DeepL unterstützten Sprachen.',
    targetUnavailable: 'Noch nicht durch den aktuellen Zugang bestätigt',

    errors: {
      deepl_auth_failed: 'DeepL hat den API-Key abgelehnt. Bitte Tarif und Key prüfen.',
      deepl_rate_limited: 'DeepL begrenzt gerade die Anfragen. Bitte später erneut prüfen.',
      deepl_unavailable: 'DeepL ist gerade nicht erreichbar. Vorhandene Texte bleiben erhalten.',
      deepl_invalid_response: 'Die Sprachliste von DeepL konnte nicht sicher verarbeitet werden.',
      deepl_module_unavailable:
        'Der Zugang zum Modul Mehrsprachigkeit ist noch nicht verfügbar. Prüfe den Modulstatus und reaktiviere das Modul bei ausgesetztem Zugang.',
      deepl_requires_multilingual_module:
        'Aktiviere zuerst das Modul Mehrsprachigkeit für diese Instanz.',
      deepl_secret_missing: 'Für diesen Zugang fehlt ein lesbarer API-Key.',
      deepl_secret_unavailable: 'Der API-Key konnte nicht sicher gespeichert werden.',
      deepl_disabled: 'Aktiviere die DeepL-Schnittstelle vor der Prüfung.',
      interface_conflict:
        'Die Konfiguration wurde inzwischen geändert. Bitte neu laden und erneut prüfen.',
    },
  },
  page: {
    title: 'Schnittstellen',
    subtitle: 'Zugänge externer Dienste für diese Instanz verwalten und prüfen',
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
  mailTest: {
    messageSubject: 'Test der E-Mail-Schnittstelle',
    messageBody: 'Diese Test-E-Mail wurde über die Mail-Schnittstelle im SVA Studio versendet.',
    action: 'Test-E-Mail an mich senden',
    sending: 'Test-E-Mail wird gesendet…',
    sent: 'Der SMTP-Server hat die Test-E-Mail an {{recipient}} angenommen. Bitte den Posteingang prüfen.',
    errors: {
      connection: 'Der SMTP-Server ist nicht erreichbar oder die Verbindung wurde unterbrochen.',
      authentication: 'Der SMTP-Server hat die Anmeldung abgelehnt.',
      tls: 'Die TLS-Verbindung zum SMTP-Server ist fehlgeschlagen.',
      rejected: 'Der SMTP-Server hat die Test-E-Mail abgelehnt.',
      unknown: 'Die Test-E-Mail konnte nicht versendet werden.',
      disabled: 'Die Mail-Schnittstelle ist deaktiviert.',
      recipientMissing: 'Für das angemeldete Konto ist keine gültige E-Mail-Adresse hinterlegt.',
      invalidConfig: 'Die Mail-Schnittstelle hat keine gültigen SMTP- oder Absenderdaten.',
      secretMissing: 'Für die SMTP-Anmeldung fehlt das gespeicherte Passwort.',
    },
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
    deepl: {
      label: 'DeepL',
      description: 'Übersetzungszugang und verfügbare Sprachen dieser Instanz verwalten.',
    },
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
