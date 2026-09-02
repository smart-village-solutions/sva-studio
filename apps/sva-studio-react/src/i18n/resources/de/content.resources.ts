export const contentDEResources = {
  page: {
    title: 'Inhalte',
    subtitle:
      'Verwalten Sie generische Inhalte mit Kernmetadaten, JSON-Zusatzdaten und auditierbarer Historie.',
  },
  filters: {
    typeLabel: 'Typ',
    typeAll: 'Alle Typen',
    quickTypeLabel: 'Schnellfilter nach Typ',
    quickAll: 'Alle',
    otherTypeLabel: 'Weitere Typen',
    otherTypePlaceholder: 'Typ auswählen',
    languageCodeLabel: 'Sprachcode',
    statusLabel: 'Status',
    statusAll: 'Alle Status',
  },
  pagination: {
    ariaLabel: 'Inhaltsseiten',
    previous: 'Zurück',
    next: 'Weiter',
    pageLabel: 'Seite {{page}} von {{total}}',
    resultsLabel: '{{start}}–{{end}} von {{total}} Inhalten',
    partialPageLabel: 'Lokale Seite {{page}}',
    partialResultsLabel: 'Lokal verfügbare Inhalte {{start}}–{{end}} von derzeit {{total}}',
    pageSizeLabel: 'Seitengröße',
  },
  bulk: {
    scope: {
      explicitIds: 'Auswahl',
      currentPage: 'Aktuelle Seite',
      allMatchingQuery: 'Alle Treffer',
    },
  },
  actions: {
    create: 'Neuer Inhalt',
    createNow: 'Inhalt anlegen',
    edit: 'Bearbeiten',
    editTitle: '{{title}} bearbeiten',
    openReadOnly: 'Nur lesen',
    openReadOnlyTitle: '{{title}} nur lesen',
    blocked: 'Gesperrt',
    save: 'Änderungen speichern',
    cancel: 'Abbrechen',
    back: 'Zur Übersicht',
    archive: 'Archivieren',
    delete: 'Löschen',
    deleteConfirmTitle: 'Inhalt endgültig löschen?',
    deleteConfirmDescription:
      'Der Inhalt „{{title}}“ wird endgültig gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
    deleteBulkConfirmTitle: 'Ausgewählte Inhalte endgültig löschen?',
    deleteBulkConfirmDescription:
      '{{count}} ausgewählte Inhalte werden endgültig gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
    deletePending: 'Wird gelöscht ...',
    dismissFeedback: 'Schließen',
  },
  fields: {
    title: 'Überschrift',
    contentType: 'Typ',
    status: 'Status',
    publishedAt: 'Veröffentlichungsdatum',
    payload: 'Zusatzdaten (JSON)',
  },
  status: {
    draft: 'Entwurf',
    inReview: 'In Prüfung',
    approved: 'Freigegeben',
    published: 'Veröffentlicht',
    archived: 'Archiviert',
  },
  statusDialog: {
    open: 'Status von {{title}} ändern',
    title: 'Status ändern',
    description: 'Wählen Sie den neuen Status für „{{title}}“.',
    current: 'Aktuell',
    error: 'Der Status konnte nicht geändert werden. Bitte versuchen Sie es erneut.',
  },
  table: {
    caption: 'Tabelle der verwalteten Inhalte',
    ariaLabel: 'Inhalte',
    headerTitle: 'Überschrift',
    headerType: 'Typ',
    headerPublished: 'Veröffentlichungsdatum',
    headerCreated: 'Erstellungsdatum',
    headerUpdated: 'Änderungsdatum',
    headerAuthor: 'Autor',
    headerPayload: 'Zusatzdaten',
    headerStatus: 'Status',
    headerAccess: 'Bearbeitbarkeit',
    headerContext: 'Kontext',
    headerActions: 'Aktionen',
    notAvailable: 'Nicht verfügbar',
    notPublished: 'Nicht gesetzt',
  },
  editor: {
    createTitle: 'Neuen Inhalt anlegen',
    createSubtitle:
      'Definieren Sie die Basisangaben und hinterlegen Sie die generischen JSON-Zusatzdaten.',
    editTitle: 'Inhalt bearbeiten',
    editSubtitle: 'Aktualisieren Sie Metadaten, Status und Zusatzdaten des ausgewählten Inhalts.',
  },
  tabs: {
    ariaLabel: 'Inhaltsbereiche',
    mobileLabel: 'Bereich auswählen',
    general: 'Allgemein',
    generalTitle: 'Allgemeine Angaben',
    generalDescription:
      'Pflegen Sie Überschrift, Status, Veröffentlichungsdatum und die generischen Zusatzdaten.',
    historyDescription: 'Prüfen Sie die automatische Änderungshistorie dieses Inhalts.',
  },
  typePicker: {
    title: 'Inhaltstyp wählen',
    subtitle: 'Wählen Sie den Inhaltstyp aus, für den Sie einen neuen Eintrag anlegen möchten.',
    help: 'Es werden nur Inhaltstypen angezeigt, die im aktuellen Kontext tatsächlich angelegt werden dürfen.',
    openCreate: 'Erstellungsseite öffnen',
    fallbackDescription: '{{type}} im gemeinsamen Inhaltsbereich anlegen und verwalten.',
    typeDescriptions: {
      news: 'Meldungen, Artikel und redaktionelle Beiträge für die App erstellen und pflegen.',
      events: 'Veranstaltungen im gemeinsamen Inhaltsbereich anlegen und verwalten.',
      poi: 'Orte und relevante Anlaufstellen für die App anlegen und pflegen.',
      surveys:
        'Umfragen als weiteren Inhaltstyp anlegen, bearbeiten und in der internen Auswertung begleiten.',
    },
    empty: {
      title: 'Keine anlegbaren Inhaltstypen',
      body: 'Im aktuellen Kontext steht kein Inhaltstyp mit Erstellungsrecht zur Verfügung.',
    },
  },
  meta: {
    title: 'Metadaten',
    createHint: 'Metadaten wie Autor, Zeitstempel und ID werden nach dem ersten Speichern ergänzt.',
    author: 'Autor',
    authorPseudonymized: 'Pseudonymisiert',
    authorDeleted: 'Gelöscht',
    createdAt: 'Erstellt am',
    updatedAt: 'Geändert am',
    id: 'Inhalts-ID',
    access: 'Zugriffsstatus',
    accessContext: 'Organisationskontext: {{value}}',
  },
  principal: {
    user: 'Persönlich',
    organization: 'Organisation',
    contextLoading: 'Der Autorenkontext wird geladen. Schreibaktionen sind vorübergehend gesperrt.',
    contextUnavailable:
      'Der Autorenkontext konnte nicht eindeutig bestimmt werden. Schreibaktionen bleiben gesperrt.',
    resourceLoading:
      'Der Ressourcenprincipal wird geladen. Schreibaktionen sind vorübergehend gesperrt.',
    resourceUnavailable:
      'Der Ressourcenprincipal konnte nicht eindeutig bestimmt werden. Schreibaktionen bleiben gesperrt.',
  },
  ownership: {
    title: 'Inhaber',
    currentOwner: 'Aktueller Inhaber',
    noOwner: 'Kein eindeutiger Inhaber zugeordnet',
    ownerUnresolved: 'Keinem Account oder keiner Organisation eindeutig zugeordnet.',
    ownerResolutionFailed:
      'Die Account- oder Organisationszuordnung konnte nicht geprüft werden.',
    account: 'Persönlicher Account',
    organization: 'Organisation',
    verificationRequired:
      'Die DataProvider-Zuordnung wird beim bestätigten Transfer sicher geprüft.',
    saveKeepsOwner: 'Normales Speichern ändert den Inhaber nicht.',
    transferUnavailable: 'Die Übertragung ist für diesen Inhaltstyp noch nicht verfügbar.',
    transferForbidden: 'Du kannst diesen Inhalt bearbeiten, aber nicht übertragen.',
    transferAction: 'Inhalt übertragen',
    dialogTitle: 'Inhalt übertragen',
    dialogDescription:
      'Wähle einen aktiven Zielinhaber derselben Instanz und prüfe die Auswirkung vor der Bestätigung.',
    targetOwner: 'Neuer Inhaber',
    targetPlaceholder: 'Account oder Organisation auswählen …',
    search: 'Account oder Organisation suchen',
    loading: 'Zielinhaber werden geladen …',
    loadError: 'Geeignete Zielinhaber konnten nicht geladen werden.',
    noTargets: 'Keine geeigneten Zielinhaber gefunden.',
    refineSearch: 'Weitere Ergebnisse sind verfügbar. Grenze die Suche weiter ein.',
    confirmation: 'Ich bestätige die Übertragung an den ausgewählten Inhaber.',
    accessWarning: 'Nach der Übertragung kannst du den Zugriff auf diesen Inhalt verlieren.',
    localAuthorEffect: 'Die sichtbare Autorenanzeige bleibt bei diesem lokalen Inhalt unverändert.',
    mainserverAuthorEffect:
      'Die DataProvider-Zuordnung des Inhalts wird geändert; eine getrennte Autorenangabe bleibt unverändert.',
    cancel: 'Abbrechen',
    confirm: 'Jetzt übertragen',
    transferring: 'Wird übertragen …',
    success: 'Der Inhalt wurde erfolgreich übertragen.',
    error: 'Der Inhalt konnte nicht übertragen werden.',
    permissionMissing: 'Dir fehlt die Berechtigung, diesen Inhalt zu übertragen.',
    targetInvalid: 'Der ausgewählte Zielinhaber ist nicht mehr verfügbar.',
    bindingInvalid:
      'Die DataProvider-Zuordnung hat sich geändert oder ist nicht eindeutig. Bitte lade die Auswahl neu.',
    credentialsMissing:
      'Für den ausgewählten Zielinhaber sind keine verwendbaren Zugangsdaten hinterlegt.',
    targetVerificationFailed:
      'Die DataProvider-Zuordnung des Zielinhabers konnte nicht bestätigt werden.',
    unsupported: 'Dieser Inhaltstyp unterstützt die Übertragung nicht.',
    providerRejected: 'Der Mainserver hat die Übertragung abgelehnt.',
    reconciliationRequired:
      'Das Ergebnis der Übertragung ist nicht eindeutig. Bitte starte keinen weiteren Versuch und lasse den Vorgang prüfen.',
  },
  access: {
    states: {
      editable: 'Bearbeitbar',
      readOnly: 'Nur lesbar',
      blocked: 'Gesperrt',
      serverDenied: 'Serverseitig verweigert',
    },
    reasons: {
      contentReadMissing: 'Leserechte fehlen oder sind im aktuellen Kontext eingeschränkt.',
      contentUpdateMissing: 'Schreibrechte fehlen im aktuellen Kontext.',
      contextRestricted: 'Der aktuelle Kontext liefert keine auswertbare Inhaltsberechtigung.',
      serverForbidden: 'Die letzte Serverprüfung hat die Aktion verweigert.',
    },
    context: {
      organizationIds: 'Organisationen: {{value}}',
      sourceKinds: 'Herkunft: {{value}}',
      none: 'Kein zusätzlicher Kontext',
    },
  },
  history: {
    title: 'Historie',
    createHint: 'Historieneinträge werden nach dem ersten Speichern automatisch erzeugt.',
    empty: 'Für diesen Inhalt liegt noch keine Historie vor.',
    byline: 'von {{actor}}',
    changedFields: 'Geänderte Felder: {{fields}}',
    actions: {
      created: 'Inhalt erstellt',
      updated: 'Inhalt aktualisiert',
      statusChanged: 'Status geändert',
    },
  },
  revisions: {
    title: 'Revisionen',
  },
  empty: {
    title: 'Noch keine Inhalte vorhanden',
    body: 'Legen Sie den ersten Inhalt an, um Liste, Status und Historie zu nutzen.',
  },
  messages: {
    deleteSuccessTitle: 'Inhalt gelöscht',
    deleteSuccess: 'Der Inhalt mit der ID {{id}} wurde endgültig gelöscht.',
    deleteBulkSuccess: '{{count}} Inhalte wurden endgültig gelöscht.',
    deleteError: 'Der Inhalt konnte nicht gelöscht werden.',
    deleteBulkError:
      '{{failedCount}} Inhalte konnten nicht gelöscht werden. Die fehlgeschlagene Auswahl bleibt erhalten.',
    deleteRefreshError:
      'Die Löschung war erfolgreich, aber die Inhaltsliste konnte nicht aktualisiert werden.',
    loading: 'Inhalte werden geladen ...',
    loadError: 'Inhalte konnten nicht geladen werden.',
    saveError: 'Inhalt konnte nicht gespeichert werden.',
    actionsDisabled:
      'Aktionen bleiben deaktiviert, bis die erforderlichen Berechtigungen im aktuellen Kontext vorliegen.',
    readOnly:
      'Der Inhalt ist im aktuellen Kontext nur lesbar. Felder und Speichern bleiben deaktiviert.',
    accessLoadError:
      'Der globale Inhaltskontext konnte nicht vollständig geladen werden. Einzelne Statusangaben bleiben erhalten.',
  },
  sync: {
    refresh: 'Aktualisieren',
    refreshing: 'Synchronisiert ...',
    running: 'Die Mainserver-Inhalte werden gerade im Hintergrund synchronisiert.',
    partial:
      'Die Liste ist unvollständig. Sortierung, Filter und Anzahl beziehen sich nur auf die bereits lokal verfügbaren Inhalte.',
    runningWithSnapshot:
      'Die Mainserver-Inhalte werden gerade im Hintergrund synchronisiert. Angezeigt wird der letzte erfolgreiche Stand von {{value}}.',
    stale:
      'Die angezeigten Mainserver-Inhalte stammen aus dem letzten erfolgreichen Abgleich von {{value}}. Ein Hintergrundabgleich wurde angestoßen.',
    staleWithError:
      'Die angezeigten Mainserver-Inhalte stammen aus dem letzten erfolgreichen Abgleich von {{value}}. Der letzte Hintergrundabgleich meldete {{errorCode}}.',
  },
  diagnostics: {
    title: 'Mainserver-Autorendiagnose',
    description:
      'Instanzbezogene, schreibgeschützte Übersicht der automatisch ermittelten DataProvider-Bindungen und Studio-Mutationen.',
    loading: 'Autorendiagnose wird geladen ...',
    loadError: 'Die Mainserver-Autorendiagnose konnte nicht geladen werden.',
    retry: 'Erneut laden',
    readOnlyNotice:
      'Bindungen entstehen ausschließlich automatisch aus bestätigter Mainserver-Evidenz. Eine manuelle Zuordnung ist nicht verfügbar.',
    metrics: {
      verifiedBindings: 'Bestätigte Bindungen',
      conflicts: 'Bindungskonflikte',
      rotations: 'Principals mit Rotation',
      compatibility: 'Kompatibilitätsentscheidungen',
      exact: 'Exakte Entscheidungen',
      modeSwitches: 'Automatische Moduswechsel',
      shadowEvaluations: 'Shadow-Auswertungen',
      shadowDifferences: 'Shadow-Abweichungen',
      reconciliationRequired: 'Abgleich erforderlich',
      reconciliationFailed: 'Abgleich fehlgeschlagen',
    },
  },
  errors: {
    forbidden: 'Unzureichende Berechtigungen für diese Inhaltsaktion.',
    csrfValidationFailed:
      'Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden und erneut versuchen.',
    rateLimited: 'Zu viele Anfragen in kurzer Zeit. Bitte kurz warten und erneut versuchen.',
    notFound: 'Der angeforderte Inhalt wurde nicht gefunden.',
    databaseUnavailable:
      'Die Inhaltsdaten konnten wegen eines Datenbankproblems nicht verarbeitet werden.',
    invalidRequest: 'Der Inhalt enthält ungültige oder unvollständige Daten.',
  },
  validation: {
    titleRequired: 'Die Überschrift ist ein Pflichtfeld.',
    payloadJsonInvalid: 'Die Zusatzdaten müssen gültiges JSON sein.',
    publishedAtRequired: 'Für veröffentlichte Inhalte ist ein Veröffentlichungsdatum erforderlich.',
    publishedAtInvalid:
      'Bitte geben Sie ein gültiges Veröffentlichungsdatum in der Fachzeitzone Europe/Berlin ein.',
  },
} as const;
