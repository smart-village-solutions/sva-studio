export const eventsDEEditor = {
  messages: {
    mediaReferencePartialFailure:
      'Der Inhalt wurde gespeichert, die Medienreferenzen jedoch nicht. Sie können die Referenzen erneut speichern.',
    mediaReferenceRetrySuccess: 'Die Medienreferenzen wurden gespeichert.',
    loading: 'Veranstaltungen werden geladen.',
    loadError: 'Veranstaltungen konnten nicht geladen werden.',
    missingContent: 'Die Veranstaltung konnte nicht geladen werden.',
    mediaReferenceLoadError:
      'Die Medienreferenzen konnten nicht geladen werden. Die Veranstaltung bleibt bearbeitbar.',
    degradedDataWarning:
      'Einige Mainserver-Felder konnten nicht sicher gelesen werden. Unveränderte Werte werden nicht überschrieben; Korrekturen müssen bestätigt werden.',
    degradedField: 'Betroffener Bereich: {{field}}',
    degradedCorrectionConfirm:
      'Die folgenden zuvor nicht sicher lesbaren Bereiche wurden geändert: {{fields}}. Sollen diese Werte bewusst überschrieben werden?',
    saveError: 'Die Veranstaltung konnte nicht gespeichert werden.',
    deleteError: 'Die Veranstaltung konnte nicht gelöscht werden.',
    createSuccess: 'Die Veranstaltung wurde erstellt.',
    updateSuccess: 'Die Veranstaltung wurde aktualisiert.',
    deleteSuccess: 'Die Veranstaltung wurde gelöscht.',
    deleteNavigationError:
      'Die Veranstaltung wurde gelöscht, aber die Inhaltsliste konnte nicht geöffnet werden.',
    validationError: 'Bitte korrigieren Sie die markierten Felder.',
    categoryOptionsLoading: 'Kategorien werden geladen.',
    categoryOptionsLoadError: 'Kategorien konnten nicht geladen werden.',
    poiOptionsLoading: 'POI werden geladen.',
    poiOptionsLoadError: 'Die POI konnten nicht geladen werden.',
    poiOptionsEmpty: 'Keine passenden POI gefunden.',
    locationGeocodeError: 'Die Ermittlung von Geo-Koordinaten ist derzeit nicht verfügbar.',
    locationGeocodeDisabled:
      'Die Ermittlung von Geo-Koordinaten ist für diese Instanz derzeit nicht verfügbar.',
    locationGeocodeEmpty: 'Zu diesen Adressdaten wurden keine Geo-Koordinaten gefunden.',
    locationGeocodeRateLimited:
      'Das Geocoding-Limit wurde erreicht. Bitte versuchen Sie es später erneut.',
    locationGeocodeTimeout:
      'Die Ermittlung von Geo-Koordinaten hat zu lange gedauert. Bitte versuchen Sie es erneut.',
    locationGeocodeForbidden:
      'Für die Ermittlung von Geo-Koordinaten fehlen die erforderlichen Berechtigungen.',
    locationGeocodeUnauthorized:
      'Die Sitzung für die Ermittlung von Geo-Koordinaten ist abgelaufen. Bitte laden Sie die Seite neu.',
    locationMapUnavailable: 'Die Kartenansicht ist für diese Instanz derzeit deaktiviert.',
    locationMapError:
      'Die Kartenansicht konnte nicht geladen werden. Die Felder bleiben manuell bearbeitbar.',
    imagePickerEmpty: 'Keine passenden Medien gefunden.',
    mediaUploadInitializing: 'Upload wird vorbereitet.',
    mediaUploadUploading: 'Medium wird hochgeladen.',
    mediaUploadFinalizing: 'Medium wird eingepflegt.',
    mediaUploadSuccess: 'Medium wurde hinzugefügt.',
    mediaUploadError: 'Medium konnte nicht hochgeladen werden.',
    mediaSaveUploading: 'Bilder werden hochgeladen.',
    mediaSaveContent: 'Inhalt wird gespeichert.',
    mediaSaveLinking: 'Medien werden verknüpft.',
    mediaSaveCleanup: 'Nicht gespeicherte Bilder werden bereinigt.',
    mediaSaveOutcomeUnknown: 'Das Speicherergebnis wird geprüft.',
    mediaUploadUnsupportedType: 'Nur JPG-, PNG- und WebP-Bilder werden unterstützt.',
    mediaUploadUnavailableUrl:
      'Das gewählte Medium hat keine öffentliche URL und kann nicht verwendet werden.',
    mediaPickerTitle: 'Medium hinzufügen',
    mediaPickerLibraryAction: 'Medium aus der Bibliothek hinzufügen',
    mediaPickerLinkAction: 'Medium per Link hinzufügen',
    mediaPickerDescription:
      'Wählen Sie ein vorhandenes Medium aus oder laden Sie ein neues Bild hoch.',
    mediaPickerReviewMode: 'Prüfen',
    mediaPickerUploadRegionLabel: 'Bilddatei hochladen',
    mediaPickerUploadTitle: 'Neues Medium hochladen',
    mediaPickerUploadDescription:
      'Laden Sie ein Bild hoch und prüfen Sie danach die Metadaten vor der Übernahme.',
    mediaPickerSelectFile: 'Datei auswählen',
    mediaPickerUploadSupportLabel: 'Unterstützt werden JPG, PNG und WebP.',
    mediaPickerReviewTitle: 'Metadaten prüfen',
    mediaPickerReviewDescription:
      'Ergänzen Sie Titel, Alternativtext und weitere Metadaten, bevor das Medium übernommen wird.',
    mediaPickerAltText: 'Alternativtext',
    mediaPickerLicense: 'Lizenz',
    mediaPickerBackToLibrary: 'Zurück zur Mediathek',
    mediaPickerBackToUpload: 'Zurück zum Upload',
    mediaPickerOpenMediaManagement: 'In Medienverwaltung öffnen',
    mediaPickerUseMedia: 'Medium übernehmen',
    mediaPickerAssetLoadError: 'Das Medium konnte nicht geladen werden.',
    mediaPickerMetadataSaveError: 'Die Metadaten konnten nicht gespeichert werden.',
  },
  richText: {
    mode: 'Editoransicht',
    visualMode: 'WYSIWYG',
    htmlMode: 'HTML',
    heading2: 'Überschrift 2',
    heading3: 'Überschrift 3',
    heading4: 'Überschrift 4',
    blockType: 'Textformat',
    paragraph: 'Absatz',
    blockquote: 'Zitat',
    bulletList: 'Aufzählung',
    orderedList: 'Nummerierung',
    bold: 'Fett',
    italic: 'Kursiv',
    underline: 'Unterstrichen',
    clearFormatting: 'Formatierung entfernen',
    undo: 'Zurück',
    redo: 'Vorwärts',
    linkInput: 'Link-URL',
    applyLink: 'Link setzen',
  },
  tabs: {
    ariaLabel: 'Detailbereiche',
    mobileLabel: 'Bereich auswählen',
  },
  detailTabs: {
    basis: { title: 'Basis', description: 'Stammdaten und redaktionelle Kerndaten.' },
    content: { title: 'Inhalt', description: 'Termine, Orte, Veranstalter und weitere Fachdaten.' },
    settings: {
      title: 'Einstellungen',
      description: 'Medien, Sichtbarkeit und technische Zusatzdaten.',
    },
    history: { title: 'Historie', description: 'Änderungs- und Aktivitätsverlauf.' },
  },
  cards: {
    basis: {
      identity: {
        title: 'Überschrift & Kategorie',
        description: 'Überschrift und redaktionelle Grundkategorie der Veranstaltung.',
      },
      recurrence: {
        title: 'Serien-Logik',
        description: 'Wiederholung und Ausspielungsrhythmus der Veranstaltung.',
      },
      relations: { title: 'Verknüpfungen', description: 'Verknüpfung zu anderen Studio-Inhalten.' },
      meta: { title: 'Metadaten', description: 'Zeitliche Einordnung des Eintrags.' },
    },
    content: {
      descriptions: {
        title: 'Beschreibung',
        description: 'Redaktioneller Kerntext der Veranstaltung.',
      },
      media: {
        title: 'Medien',
        description: 'Galerie, Upload oder manuelle Medienangaben für die Veranstaltung.',
        empty: 'Noch keine Medien zugeordnet.',
      },
      dates: {
        title: 'Termine',
        description: 'Termine, Zeiten und optionale Zeit-Hinweise.',
        itemTitle: 'Termin',
      },
      addresses: {
        title: 'Veranstaltungsort',
        description: 'Adressen und Ortsbezeichnungen der Veranstaltung.',
        itemTitle: 'Ort',
      },
      organizer: {
        title: 'Veranstalter',
        description: 'Institution, Firma oder verantwortliche Stelle.',
      },
      contacts: {
        title: 'Ansprechpartner',
        description: 'Konkrete Kontaktpersonen für Rückfragen.',
        itemTitle: 'Kontakt',
      },
      links: {
        title: 'Links',
        description: 'Externe Verweise zur Veranstaltung.',
        itemTitle: 'Link',
      },
      prices: { title: 'Preise', description: 'Preisangaben und Kategorien.', itemTitle: 'Preis' },
      accessibility: {
        title: 'Barrierefreiheit',
        description: 'Hinweise zur Zugänglichkeit der Veranstaltung.',
      },
    },
    settings: {
      publication: { title: 'Sichtbarkeit', description: 'Ausspielung der Veranstaltung.' },
      technical: {
        title: 'Technische Zusatzdaten',
        description: 'Technische Kennung der Veranstaltung.',
      },
    },
  },
  history: {
    loading: 'Historie wird geladen.',
    error: 'Historie konnte nicht geladen werden.',
    createHint: 'Speichern Sie die Veranstaltung, bevor die Historie verfügbar ist.',
    tableLabel: 'Historie der Veranstaltung',
    sourceNotice:
      'Diese Historie enthält ausschließlich Änderungen, die über das Studio ausgeführt wurden.',
    emptySummary: 'Keine weiteren Änderungsdetails.',
    columns: {
      time: 'Zeitpunkt',
      action: 'Aktion',
      actor: 'Bearbeitet von',
      summary: 'Zusammenfassung',
    },
    actions: { created: 'Erstellt', updated: 'Aktualisiert', statusChanged: 'Status geändert' },
    empty: {
      title: 'Noch keine Historie verfügbar.',
      description: 'Für diese Veranstaltung wurden noch keine Studio-Änderungen erfasst.',
    },
  },
  empty: {
    title: 'Noch keine Veranstaltungen vorhanden',
    description: 'Legen Sie die erste Veranstaltung an.',
  },
  pagination: {
    ariaLabel: 'Seitennavigation der Veranstaltungen',
    previous: 'Zurück',
    next: 'Weiter',
    pageLabel: 'Seite {{page}}',
  },
  media: {
    moveUp: 'Nach oben',
    moveDown: 'Nach unten',
    refresh: 'Metadaten aus Mediathek aktualisieren',
    apply: 'Auswahl übernehmen',
    linked: 'Mit Mediathek verknüpft',
    manual: 'Manuelle URL',
    synced: 'Referenz synchron',
    pending: 'Referenz ausstehend',
    missing: 'Referenz fehlt',
    additional: 'Zusätzliche Referenz',
    unresolved: 'Referenz nicht auflösbar',
    failed: 'Referenzfehler',
    previewUnavailable: 'Keine Vorschau verfügbar',
    moved: 'Bild an Position {{position}} von {{total}} verschoben.',
    removed: 'Bild wurde entfernt.',
    urlUpgradedToHttps: 'Die Bild-URL wurde auf HTTPS aktualisiert.',
    urlInsecureHttp:
      'Diese HTTP-Bild-URL wird unsicher übertragen und kann in HTTPS-Anwendungen blockiert werden.',
    urlHttpsUnavailable:
      'Für diese Bildadresse wurde keine funktionierende HTTPS-Version gefunden.',
    urlInvalid: 'Die Bild-URL ist ungültig oder nicht dauerhaft speicherbar.',
    refreshTitle: 'Metadaten aktualisieren',
    refreshDescription: 'Wählen Sie die zu übernehmenden Felder.',
    assetValue: 'Mediathek',
    contentValue: 'Inhalt',
  },
  validation: {
    title: 'Die Überschrift ist erforderlich.',
    dates: 'Datumswerte müssen gültig sein.',
    urls: 'URLs müssen mit https:// beginnen.',
    categories: 'Kategorien benötigen einen Namen mit maximal 128 Zeichen.',
    priceInformations: 'Preisangaben müssen valide Zahlen enthalten.',
    geoLocation: 'Koordinaten müssen gültige Breiten- und Längengrade sein.',
    organizerName:
      'Geben Sie einen Namen für den Veranstalter ein oder entfernen Sie die übrigen Veranstalterangaben.',
  },
  values: {
    mediaContentTypes: {
      unspecified: 'Nicht gesetzt',
      image: 'Bild',
      audio: 'Audio',
      video: 'Video',
      logo: 'Logo',
      attachment: 'Anhang',
    },
  },
} as const;
