export const contentDEResources = {
  page: {
    title: 'Inhalte',
    subtitle:
      'Verwalten Sie generische Inhalte mit Kernmetadaten, JSON-Payload und auditierbarer Historie.',
  },
  filters: {
    typeLabel: 'Typ',
    typeAll: 'Alle Typen',
    statusLabel: 'Status',
    statusAll: 'Alle Status',
  },
  pagination: {
    ariaLabel: 'Inhaltsseiten',
    previous: 'Zurück',
    next: 'Weiter',
    pageLabel: 'Seite {{page}} von {{total}}',
    resultsLabel: '{{start}}–{{end}} von {{total}} Inhalten',
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
    openReadOnly: 'Nur lesen',
    blocked: 'Gesperrt',
    save: 'Änderungen speichern',
    cancel: 'Abbrechen',
    back: 'Zur Übersicht',
    archive: 'Archivieren',
    delete: 'Löschen',
    deleteConfirm: 'Soll dieser Inhalt wirklich gelöscht werden?',
  },
  fields: {
    title: 'Titel',
    contentType: 'Typ',
    status: 'Status',
    publishedAt: 'Veröffentlichungsdatum',
    payload: 'Payload (JSON)',
  },
  status: {
    draft: 'Entwurf',
    inReview: 'In Prüfung',
    approved: 'Freigegeben',
    published: 'Veröffentlicht',
    archived: 'Archiviert',
  },
  table: {
    caption: 'Tabelle der verwalteten Inhalte',
    ariaLabel: 'Inhalte',
    headerTitle: 'Titel',
    headerType: 'Typ',
    headerPublished: 'Veröffentlichungsdatum',
    headerCreated: 'Erstellungsdatum',
    headerUpdated: 'Änderungsdatum',
    headerAuthor: 'Autor',
    headerPayload: 'Payload',
    headerStatus: 'Status',
    headerAccess: 'Bearbeitbarkeit',
    headerContext: 'Kontext',
    headerActions: 'Aktionen',
    notPublished: 'Nicht gesetzt',
  },
  editor: {
    createTitle: 'Neuen Inhalt anlegen',
    createSubtitle: 'Definieren Sie den Basiskern und hinterlegen Sie die generische JSON-Payload.',
    editTitle: 'Inhalt bearbeiten',
    editSubtitle: 'Aktualisieren Sie Metadaten, Status und Payload des ausgewählten Inhalts.',
  },
  tabs: {
    ariaLabel: 'Inhaltsbereiche',
    mobileLabel: 'Bereich auswählen',
    general: 'Allgemein',
    generalTitle: 'Allgemeine Angaben',
    generalDescription:
      'Pflegen Sie Titel, Status, Veröffentlichungsdatum und die generische Payload.',
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
    runningWithSnapshot:
      'Die Mainserver-Inhalte werden gerade im Hintergrund synchronisiert. Angezeigt wird der letzte erfolgreiche Stand von {{value}}.',
    stale:
      'Die angezeigten Mainserver-Inhalte stammen aus dem letzten erfolgreichen Abgleich von {{value}}. Ein Hintergrundabgleich wurde angestoßen.',
    staleWithError:
      'Die angezeigten Mainserver-Inhalte stammen aus dem letzten erfolgreichen Abgleich von {{value}}. Der letzte Hintergrundabgleich meldete {{errorCode}}.',
    fresh: 'Letzter erfolgreicher Mainserver-Abgleich: {{value}}.',
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
    titleRequired: 'Der Titel ist ein Pflichtfeld.',
    payloadJsonInvalid: 'Die Payload muss gültiges JSON sein.',
    publishedAtRequired: 'Für veröffentlichte Inhalte ist ein Veröffentlichungsdatum erforderlich.',
    publishedAtInvalid:
      'Bitte geben Sie ein gültiges Veröffentlichungsdatum in der Fachzeitzone Europe/Berlin ein.',
  },
} as const;
