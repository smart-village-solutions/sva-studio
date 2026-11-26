export const wasteManagementTourMergeTranslationsDE = {
  merge: {
    open: 'Ausgewählte Touren zusammenführen',
    tooMany: 'Wählen Sie höchstens {{count}} Touren für die Zusammenführung aus.',
    intro:
      'Wählen Sie die Tour, die veröffentlicht bleibt. Sie übernimmt die Abholpunkte der anderen Touren. Die anderen Touren werden archiviert.',
    close: 'Dialog schließen',
    choose: 'Zieltour wählen',
    chooseHelp: 'Bei gleichen Namen helfen Abholpunktzahl, Turnus und Tour-ID bei der Auswahl.',
    pointCountOne: '{{count}} Abholpunkt',
    pointCount: '{{count}} Abholpunkte',
    pointCountUnknown: 'Abholpunktzahl noch nicht verfügbar',
    optionDetails: '{{points}} · {{recurrence}} · {{validity}} · ID {{id}}',
    tourLabel: '{{name}} · {{points}} · ID {{id}}',
    validityRange: '{{start}}–{{end}}',
    validityFrom: 'ab {{start}}',
    validityUntil: 'bis {{end}}',
    validityUnknown: 'Gültigkeit offen',
    hiddenOne: 'Eine ausgewählte Tour liegt außerhalb des Filters',
    hidden: 'Ausgewählte Touren liegen außerhalb des Filters',
    hiddenSelected: '{{tour}} bleibt ausgewählt.',
    hiddenTarget:
      '{{tour}} bleibt ausgewählt. In dieser Vorschau bleibt sie als Zieltour veröffentlicht.',
    hiddenSource:
      '{{tour}} bleibt ausgewählt. In dieser Vorschau wird sie als Quelltour archiviert.',
    hiddenSuffix: ' · außerhalb des Filters',
    previewLoading: 'Vorschau wird geladen …',
    impact: 'Nach der Zusammenführung',
    keepsPublishing: 'Bleibt veröffentlicht',
    total: '{{existing}} bisherige + {{added}} neue = {{total}} Abholpunkte.',
    sharedNamed: '{{location}} zählt einmal.',
    sharedOne: 'Der gemeinsame Abholpunkt zählt einmal.',
    shared: '{{count}} gemeinsame Abholpunkte zählen jeweils einmal.',
    archives: 'Werden archiviert',
    archiveEffectOne:
      'Die Quelltour bleibt mit ihrer Planung und ihren Zuordnungen im Archiv einsehbar. Sie liefert danach keine eigenen Kalendertermine.',
    archiveEffect:
      'Die Quelltouren bleiben mit ihrer Planung und ihren Zuordnungen im Archiv einsehbar. Sie liefern danach keine eigenen Kalendertermine.',
    planningEffect: 'Abholtage, Abfallarten und Hinweise bleiben erhalten.',
    cancel: 'Abbrechen',
    confirm: 'Touren zusammenführen',
    saving: 'Touren werden zusammengeführt …',
    rejected: 'Zusammenführung abgelehnt',
    reviewSelection: 'Auswahl ändern',
    refresh: 'Vorschau aktualisieren',
    conflicts: {
      status: '{{tour}} ist nicht veröffentlicht. Wählen Sie veröffentlichte Touren.',
      recurrence:
        '{{tour}} hat den Turnus „{{turnus}}“. Turnus der Zieltour: „{{targetTurnus}}“. Wählen Sie Touren mit identischer wiederkehrender Terminplanung.',
      fractions: '{{tour}} hat andere Abfallarten. Wählen Sie Touren mit identischen Abfallarten.',
      validity:
        '{{tour}} hat eine andere Gültigkeit. Wählen Sie Touren mit identischer Gültigkeit.',
      notes: '{{tour}} hat andere Hinweise. Wählen Sie Touren mit identischen Hinweisen.',
      shifts:
        '{{tour}} hat abweichende Einzel- oder Ausweichtermine. Wählen Sie Touren mit identischer Terminplanung.',
      assignments:
        '{{tour}} hat Tour-Einsätze oder abholpunktspezifische Einzeltermine, die eine Zusammenführung verhindern.',
      duplicateLinks:
        '{{tour}} enthält doppelte Abholpunktzuordnungen. Wählen Sie eine andere Zieltour oder bereinigen Sie die Zuordnungen.',
    },
    issues: {
      stale: {
        title: 'Vorschau ist veraltet',
        detail:
          'Der geprüfte Datenstand ist nicht mehr verfügbar. Laden Sie eine neue Vorschau und prüfen Sie die Auswirkungen erneut. In diesem Vorgang wurde noch nichts zusammengeführt.',
      },
      'rolled-back': {
        title: 'Zusammenführen fehlgeschlagen',
        detail:
          'Studio hat den Vorgang abgebrochen. Es wurden keine Abholpunkte neu zugeordnet und keine Touren archiviert. Laden Sie die Vorschau für einen neuen Versuch.',
      },
      unknown: {
        title: 'Ergebnis konnte nicht bestätigt werden',
        detail:
          'Aktualisieren Sie die Vorschau und prüfen Sie den Datenstand vor einem neuen Versuch.',
      },
      load: {
        title: 'Vorschau konnte nicht geladen werden',
        detail: 'Laden Sie die Vorschau erneut, um die Auswirkungen zu prüfen.',
      },
      missing: {
        title: 'Ausgewählte Tour fehlt',
        detail:
          'Mindestens eine ausgewählte Tour ist nicht mehr verfügbar. Prüfen Sie die Tourenliste und ändern Sie Ihre Auswahl.',
      },
      forbidden: {
        title: 'Berechtigung fehlt',
        detail: 'Sie benötigen das Recht zum Bearbeiten von Touren, um sie zusammenzuführen.',
      },
    },
    success: '„{{target}}“ hat jetzt {{locations}} Abholpunkte. Archivierte Touren: {{archived}}.',
    refreshListError:
      'Die Tourenliste konnte nicht aktualisiert werden. Laden Sie die Seite neu, um den aktuellen Stand zu sehen.',
  },
};
