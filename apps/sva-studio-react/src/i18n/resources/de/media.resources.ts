export const mediaDEResources = {
  page: {
    title: 'Medienbibliothek',
    subtitle:
      'Verwalten Sie Uploads, Metadaten, Sichtbarkeit und die aktuelle Nutzung Ihrer Medienobjekte.',
  },
  create: {
    title: 'Datei vorbereiten',
    subtitle:
      'Reservieren Sie zuerst Asset-ID und Upload-Ziel. Der eigentliche Dateitransfer und die Metadatenpflege folgen direkt danach im Workspace.',
    intakeBadge: 'Intake',
    intakeTitle: 'Kompakter Intake',
    intakeDescription:
      'Wählen Sie Dateityp, Zielgröße und Sichtbarkeit, damit die Upload-Initialisierung technisch sauber vorbereitet ist.',
    byteSizeHint:
      'Planen Sie die erwartete Dateigröße in Byte, damit Limits und Validierung früh greifen.',
    submitHint:
      'Dieser Schritt erzeugt noch keinen Datei-Upload. Er reserviert nur das Asset und gibt die signierte Ziel-URL zurück.',
    submitting: 'Wird initialisiert…',
    planningTitle: 'Was jetzt konfiguriert wird',
    planningDescription:
      'Der Guided Intake definiert die technische Hülle des Assets, bevor Metadaten und konkrete Nutzung folgen.',
    planning: {
      items: {
        mimeType: {
          title: 'Dateiformat und Verarbeitungspfad',
          body: 'Der MIME-Typ entscheidet, welche Validierung, Vorschau und Folgeprozesse für das Asset vorbereitet werden.',
        },
        byteSize: {
          title: 'Zielgröße und Grenzprüfung',
          body: 'Die erwartete Bytegröße hilft, Upload-Limits und Fehlpfade direkt beim Start sauber zu behandeln.',
        },
        visibility: {
          title: 'Sichtbarkeit und Delivery-Modell',
          body: 'Die Sichtbarkeit legt fest, ob das Asset sofort öffentlich auslieferbar oder geschützt behandelt werden soll.',
        },
      },
    },
    mimeTypeOptions: {
      'image/jpeg': 'Bild (JPEG)',
      'image/png': 'Bild (PNG)',
      'image/webp': 'Bild (WEBP)',
      'application/pdf': 'Dokument (PDF)',
      'video/mp4': 'Video (MP4)',
    },
    nextStepsTitle: 'Nächste Schritte',
    nextStepsDescription:
      'Die Initialisierung ist abgeschlossen. Nutzen Sie die technische Antwort für den eigentlichen Transfer und die anschließende Qualitätsprüfung.',
    result: {
      assetId: 'Asset-ID: {{value}}',
      uploadSessionId: 'Upload-Session: {{value}}',
      method: 'Methode: {{value}}',
      expiresAt: 'Gültig bis: {{value}}',
    },
    followUpTitle: 'Danach direkt weiter',
    followUpSteps: {
      transfer: '1. Datei mit der signierten URL in den reservierten Upload schreiben.',
      describe: '2. Danach Titel, Alternativtext und Sichtbarkeit im Detail-Workspace prüfen.',
      review: '3. Asset anschließend in der Bibliothek oder den Fachmodulen referenzieren.',
    },
    errors: {
      default: 'Die Upload-Initialisierung konnte nicht abgeschlossen werden.',
    },
  },
  detail: {
    subtitle:
      'Prüfen Sie Vorschau, Delivery, Metadaten und Nutzungsimpact in einem gemeinsamen Asset-Workspace.',
    previewEyebrow: 'Asset-Workspace',
    previewTitle: 'Arbeitsansicht',
    previewBody:
      'Die Detailseite hält Delivery, Qualitätsstatus und Referenzkontext zusammen, auch bevor eine echte Vorschau ausgeliefert wird.',
    metadataDescription: 'Fachliche Beschreibung und redaktionelle Qualitätsfelder des Assets.',
    imageControlsTitle: 'Bildsteuerung',
    imageControlsDescription:
      'Fokuspunkt und Zuschnitt für bildbasierte Ausspielungen auf einen Blick.',
    usageDescription: 'Aktive Referenzen und Rollen, die dieses Asset derzeit verwenden.',
    technicalDescription: 'Technische Identität, Statuswerte und Delivery-Daten des Assets.',
  },
  filters: {
    searchLabel: 'Suche',
    searchPlaceholder: 'Nach Titel, Alternativtext oder MIME-Typ suchen',
    visibilityLabel: 'Sichtbarkeit',
    visibilityAll: 'Alle Sichtbarkeiten',
  },
  actions: {
    create: 'Medium vorbereiten',
    register: 'Als Medium registrieren',
    open: 'Öffnen',
    save: 'Metadaten speichern',
    delete: 'Medium löschen',
    deleteConfirm: 'Soll dieses Medium wirklich gelöscht werden?',
    back: 'Zur Medienbibliothek',
    backToDetail: 'Zur Mediendetailansicht',
    initializeUpload: 'Upload initialisieren',
    resolveDelivery: 'Auslieferungslink erzeugen',
    openUsage: 'Usage-Impact öffnen',
  },
  fields: {
    title: 'Titel',
    altText: 'Alternativtext',
    description: 'Beschreibung',
    copyright: 'Copyright',
    license: 'Lizenz',
    focusPointX: 'Fokuspunkt X',
    focusPointY: 'Fokuspunkt Y',
    cropX: 'Zuschnitt X',
    cropY: 'Zuschnitt Y',
    cropWidth: 'Zuschnitt Breite',
    cropHeight: 'Zuschnitt Höhe',
    mimeType: 'MIME-Typ',
    byteSize: 'Dateigröße in Byte',
    visibility: 'Sichtbarkeit',
  },
  visibility: {
    public: 'Öffentlich',
    protected: 'Geschützt',
  },
  roles: {
    thumbnail: 'Thumbnail',
    teaser_image: 'Teaserbild',
    header_image: 'Headerbild',
    gallery_item: 'Galeriebild',
    download: 'Download',
    hero_image: 'Hero-Bild',
  },
  uploadStatus: {
    pending: 'Ausstehend',
    validated: 'Validiert',
    processed: 'Verarbeitet',
    failed: 'Fehlgeschlagen',
    blocked: 'Blockiert',
  },
  processingStatus: {
    pending: 'Ausstehend',
    ready: 'Bereit',
    failed: 'Fehlgeschlagen',
  },
  table: {
    caption: 'Tabelle der verwalteten Medienobjekte',
    ariaLabel: 'Medienbibliothek',
    headerTitle: 'Titel',
    headerMimeType: 'MIME-Typ',
    headerSize: 'Größe',
    headerVisibility: 'Sichtbarkeit',
    headerUploadStatus: 'Upload',
    headerUpdatedAt: 'Geändert',
    headerActions: 'Aktionen',
  },
  editor: {
    createTitle: 'Medienupload vorbereiten',
    createSubtitle:
      'Initialisieren Sie einen Upload und erhalten Sie die signierte Ziel-URL für das Medienobjekt.',
    detailTitle: 'Medium bearbeiten',
    detailSubtitle: 'Pflegen Sie Metadaten, Sichtbarkeit und prüfen Sie die aktuelle Verwendung.',
    uploadCardTitle: 'Upload anlegen',
    uploadCardDescription:
      'Der MVP initialisiert den Upload serverseitig und liefert die signierte Upload-URL zurück.',
    uploadReadyTitle: 'Upload bereit',
    uploadReadyDescription:
      'Diese Daten können jetzt für den eigentlichen Datei-Upload verwendet werden.',
    metadataTitle: 'Metadaten',
    metadataDescription: 'Bearbeiten Sie fachliche Metadaten und die Sichtbarkeit des Mediums.',
  },
  meta: {
    title: 'Technische Daten',
    id: 'Asset-ID',
    storageKey: 'Storage-Key',
    folder: 'Ordner',
    mimeType: 'MIME-Typ',
    byteSize: 'Größe',
    createdAt: 'Erstellt am',
    updatedAt: 'Geändert am',
    uploadStatus: 'Upload-Status',
    processingStatus: 'Verarbeitungsstatus',
    uploadSessionId: 'Upload-Session',
    expiresAt: 'Gültig bis',
    uploadUrl: 'Upload-URL',
    deliveryUrl: 'Auslieferungs-URL',
  },
  usage: {
    title: 'Nutzungstransparenz',
    subtitle: 'Aktive Referenzen dieses Mediums in Host- oder Fachmodulen.',
    pageTitle: 'Usage-Impact',
    pageSubtitle:
      'Prüfen Sie, welche Referenzen dieses Medium aktuell blockieren oder beeinflussen.',
    assetTitle: 'Aktuelles Medienobjekt',
    summary: 'Aktive Referenzen: {{count}}',
    empty: 'Dieses Medium ist aktuell nicht referenziert.',
    sortOrder: 'Sortierung: {{value}}',
  },
  delivery: {
    title: 'Kontrollierte Auslieferung',
    expiresAt: 'Gültig bis: {{value}}',
  },
  empty: {
    body: 'Noch keine Medien vorhanden. Initialisieren Sie den ersten Upload, um die Bibliothek zu füllen.',
  },
  messages: {
    loading: 'Medien werden geladen ...',
    loadError: 'Die Medienbibliothek konnte nicht geladen werden.',
  },
  library: {
    quickIntake: {
      title: 'Quick Intake',
      description:
        'Starten Sie neue Uploads schnell, erfassen Sie die Mindestmetadaten und bringen Sie Assets zielsicher in die Bibliothek.',
      steps: {
        prepare: 'Upload vorbereiten und signierte Ziel-URL erzeugen.',
        describe: 'Titel, Alternativtext und Sichtbarkeit direkt nach dem Intake ergänzen.',
        publish: 'Bereite Assets priorisieren und anschließend in Fachmodule übernehmen.',
      },
    },
    priority: {
      blocked: 'Blockiert',
      blockedHint: 'Uploads oder Verarbeitung brauchen technische Nacharbeit.',
      new: 'Neu',
      newHint: 'Metadaten sind noch nicht vollständig gepflegt.',
      unused: 'Ungenutzt',
      unusedHint: 'Assets ohne Referenzen können geprüft oder archiviert werden.',
    },
    cardStates: {
      ready: 'bereit',
      new: 'neu',
      blocked: 'blockiert',
      unused: 'ungenutzt',
    },
    usageCountOne: '1 Verwendung',
    usageCountOther: '{{count}} Verwendungen',
    usageCountLoading: 'Nutzung wird geladen',
    usageCountUnknown: 'Nutzung nicht verfügbar',
    assetCard: {
      preview: 'Bildvorschau',
      document: 'Dokument',
      fallback: 'Dokumentenansicht ohne Bildvorschau',
      unknownType: 'Unbekannt',
      unregistered: 'Nicht registriert',
      folderValue: 'Ordner: {{folder}}',
    },
    toolbar: {
      title: 'Bibliotheksfokus',
      summary: '{{count}} Assets in der aktuellen Ansicht',
      page: 'Seite {{page}} von {{total}} · {{pageSize}} pro Abschnitt',
      pageSizeLabel: 'Einträge pro Seite',
      paginationAriaLabel: 'Medienbibliothek Pagination',
      previous: 'Vorherige Seite',
      next: 'Nächste Seite',
    },
  },
  unregistered: {
    subtitle:
      'Dieses Objekt liegt bereits im Bucket, ist aber noch nicht als verwaltetes Medienobjekt im Studio registriert.',
    metadataTitle: 'Vorgeschlagene Registrierung',
    metadataDescription:
      'Diese Angaben werden beim Registrieren als Startwerte für das Medienobjekt übernommen.',
    technicalDescription: 'Technische Bucket-Informationen für dieses unregistrierte Objekt.',
    altTextHint: 'Wird bei der Registrierung später fachlich ergänzt.',
  },
  errors: {
    forbidden: 'Unzureichende Berechtigungen für diese Medienaktion.',
    databaseUnavailable:
      'Die Mediendaten konnten wegen eines Datenbankproblems nicht verarbeitet werden.',
    notFound: 'Das angeforderte Medium wurde nicht gefunden.',
    conflict: 'Die Medienaktion konnte wegen eines Konflikts nicht abgeschlossen werden.',
    invalidMediaContent: 'Das hochgeladene Medium konnte nicht validiert werden.',
    uploadSizeExceeded: 'Das hochgeladene Medium überschreitet die erlaubte Größe.',
    activeReferences:
      'Das Medium kann wegen aktiver Referenzen derzeit nicht geändert oder gelöscht werden.',
  },
  values: {
    notAvailable: 'Nicht verfügbar',
  },
} as const;
