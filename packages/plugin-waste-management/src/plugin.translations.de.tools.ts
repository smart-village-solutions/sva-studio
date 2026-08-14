import { createWasteManagementToolsTranslations } from './plugin.translations.shared.sections.js';

export const wasteManagementPluginTranslationsDETools = createWasteManagementToolsTranslations({
  imports: {
    title: 'Importe',
    description:
      'Importieren Sie Abfalldaten Schritt für Schritt und prüfen Sie das Ergebnis vor dem Start.',
    profileLabel: 'Importprofil',
    blobRefLabel: 'Quell-Referenz (Blob-Ref)',
    sourceFormatLabel: 'Quellformat',
    delimiterLabel: 'Trennzeichen',
    delimiterAuto: 'Automatisch erkennen',
    sourceFormats: {
      csv: 'CSV',
      xlsx: 'Excel (.xlsx)',
    },
    dryRunLabel: 'Nur Vorprüfung (Dry-Run)',
    templateColumns: 'Kanonische Importspalten',
    previewTitle: 'Importvorschau',
    previewSummary:
      '{{validRows}} gültige Zeilen, {{invalidRows}} fehlerhafte Zeilen, {{createdTours}} neue Touren, {{createdLocations}} neue Abholorte, {{createdAssignments}} neue Zuordnungen.',
    previewDelimiter: 'Erkanntes Trennzeichen: {{detected}}. Verwendetes Trennzeichen: {{active}}.',
    previewHintStreet: 'Leere Straße wird als "Alle Straßen" verarbeitet.',
    previewHintHouseNumbers: 'Leere Hausnummern werden als "Alle Hausnummern" verarbeitet.',
    previewHintDates: 'Jede Fraktionsspalte enthält die Bezeichnung der zugeordneten Tour.',
    wizard: {
      navigationLabel: 'Importschritte',
      preferredBadge: 'Empfohlen',
      fileReady: 'Datei ausgewählt und für den Import bereit.',
      rulesTitle: 'Wichtige Regeln',
      confirmTitle: 'Import jetzt bestätigen',
      resultTitle: 'Import gestartet',
      resultDescription:
        'Der Import wurde als technischer Prozess gestartet. Details finden Sie weiter unten im Verlauf.',
      newFractionsTitle: 'Neue Abfallarten',
      newToursTitle: 'Neue Touren',
      newLocationsTitle: 'Neue Abholorte',
      newLocationsSummary:
        '{{created}} neue Abholorte werden angelegt, {{reused}} bestehende wiederverwendet.',
      errorTitle: 'Fehler',
      errorLine: 'Zeile {{rowNumber}}, Spalte {{column}}',
      noErrors: 'Keine Fehler erkannt.',
      steps: {
        profile: {
          title: 'Importart wählen',
          description: 'Wählen Sie den passenden Importtyp für Ihren Datenbestand.',
        },
        upload: {
          title: 'Datei hochladen',
          description: 'Laden Sie die Quelldatei hoch und prüfen Sie bei Bedarf das Format.',
        },
        validation: {
          title: 'Datei prüfen',
          description: 'Prüfen Sie die Regeln und erstellen Sie bei Bedarf eine Vorschau.',
        },
        preview: {
          title: 'Vorschau bestätigen',
          description: 'Kontrollieren Sie die Zusammenfassung und starten Sie danach den Import.',
        },
        result: {
          title: 'Ergebnis',
          description: 'Behalten Sie den gestarteten Import und seinen Status im Blick.',
        },
      },
      actions: {
        continue: 'Weiter',
        back: 'Zurück',
        continueToConfirmation: 'Zur Bestätigung weiter',
        startNew: 'Neuen Import starten',
      },
      metrics: {
        validRows: 'Gültige Zeilen',
        invalidRows: 'Fehlerhafte Zeilen',
        createdFractions: 'Neue Abfallarten',
        createdTours: 'Neue Touren',
        createdAssignments: 'Neue Zuordnungen',
      },
    },
  },
  migrations: {
    title: 'Migrationen',
    description: 'Startet asynchrone Host-Migrationsprozesse für die aktive Abfalldatenquelle.',
    schemaLabel: 'Zielschema',
    versionLabel: 'Anfordernde Version',
  },
  seed: {
    title: 'Initialdaten',
    description:
      'Füllt die Abfalldatenquelle über die generische Prozessfunktion mit den Ausgangsdaten.',
  },
  postalCodes: {
    title: 'Fehlende Postleitzahlen ergänzen',
    description:
      'Ermittelt fehlende Postleitzahlen für Orte anhand der konfigurierten Geocodierung. Bestehende Werte und mehrdeutige Treffer bleiben unverändert.',
    progressTitle: 'Postleitzahlen werden ergänzt',
    progressSummary: '{{processed}} von {{total}} Orten wurden geprüft.',
    resultTitle: 'Ergebnis der Postleitzahl-Ergänzung',
    resultSummary:
      '{{updated}} ergänzt, {{ambiguous}} mehrdeutig, {{notFound}} nicht gefunden, {{failed}} fehlgeschlagen und {{skipped}} zwischenzeitlich gepflegt.',
    budgetSummary:
      'Das Anfragebudget wurde nach {{requests}} von {{budget}} Provideranfragen erreicht. {{unprocessed}} Orte bleiben für einen späteren Lauf offen.',
    errorTitle: 'Postleitzahlen konnten nicht ergänzt werden',
    errors: {
      geocodingDisabled:
        'Für diese Instanz ist keine aktive Karten-Geocodierung eingerichtet.',
      openInterfaces: 'Karten-Geocodierung unter Schnittstellen einrichten',
      timeout:
        'Der Geocoding-Dienst hat nicht rechtzeitig geantwortet. Bis zum Abbruch wurden {{processed}} von {{total}} Orten geprüft und bereits bestätigte Postleitzahlen gespeichert. Ein neuer Lauf setzt bei den verbleibenden Orten fort.',
      generic:
        'Der Prozess ist fehlgeschlagen. Prüfen Sie die technische Historie oder die konfigurierte Karten-Geocodierung und starten Sie ihn anschließend erneut.',
    },
  },
  sync: {
    actionLabel: 'Synchronisieren',
    startSuccess: 'Mainserver-Synchronisierung wurde gestartet.',
    startError: 'Mainserver-Synchronisierung konnte nicht gestartet werden.',
  },
  reset: {
    title: 'Zurücksetzen',
    description:
      'Das Zurücksetzen bleibt ein hochriskanter Vorgang und verlangt ein explizites Bestätigungstoken.',
    tokenLabel: 'Bestätigungstoken',
    confirmTitle: 'Daten wirklich zurücksetzen?',
    confirmDescription:
      'Das Zurücksetzen ist hochriskant. Bestätigen Sie den Vorgang explizit mit dem Token.',
    confirmCancel: 'Abbrechen',
    confirmAction: 'Zurücksetzen bestätigen',
  },
  actions: {
    startImport: 'Import starten',
    startMigrations: 'Migrationen starten',
    startSeed: 'Initialdaten laden',
    startPostalCodeEnrichment: 'Postleitzahlen ergänzen',
    startReset: 'Daten zurücksetzen',
    starting: 'Startet…',
    downloadTemplate: 'Vorlage laden',
    openJob: 'Prozess öffnen',
    previewImport: 'Vorschau prüfen',
    downloadErrorFile: 'Fehlerdatei laden',
  },
  messages: {
    jobStarted: 'Prozess {{jobId}} wurde gestartet.',
    previewReady: 'Die Importvorschau ist bereit.',
    historyDeleteSuccess: 'Der Historieneintrag wurde gelöscht.',
    jobStartError: 'Der Abfallprozess konnte nicht gestartet werden.',
    jobStartErrorWithReason: 'Der Abfallprozess konnte nicht gestartet werden: {{reason}}',
    forbidden: 'Für diesen Abfallvorgang fehlt die Berechtigung.',
    importValidationError: 'Der Import verlangt ein Importprofil und eine gültige Quell-Referenz.',
    resetValidationError: 'Das Zurücksetzen verlangt ein gültiges Bestätigungstoken.',
  },
  meta: {
    lastJobTitle: 'Letzter Prozess',
    lastJobDescription: 'Zuletzt gestarteter technischer Prozess mit aktuellem Status.',
    noJobYet: 'Noch kein technischer Abfallprozess gestartet.',
    noJobStatus: 'Kein Prozess',
    historyTitle: 'Vergangene Prozesse',
    historyDescription: 'Die letzten technischen Prozesse mit kompakten Details.',
    historyDetailsAction: 'Details anzeigen',
    historyCloseDetailsAction: 'Details schließen',
    historyDeleteAction: 'Eintrag löschen',
    advancedTitle: 'Erweiterte Systemfunktionen',
    advancedDescription:
      'Technische Wartungsfunktionen und tiefergehende Details für Administratoren.',
    technicalDetailsToggle: 'Technische Details',
    technicalHistoryTitle: 'Technische Ereignisse',
    technicalHistoryDescription:
      'Zeigt die letzten technischen Abfallereignisse mit unterscheidbaren Ergebnissen für Start, Erfolg und Fehler.',
    noTechnicalHistory: 'Noch keine technischen Abfallereignisse vorhanden.',
    jobId: 'Prozess: {{value}}',
    jobType: 'Typ: {{value}}',
    jobStatus: 'Status: {{value}}',
    jobIdLabel: 'Prozess',
    jobTypeLabel: 'Typ',
    jobStatusLabel: 'Status',
  },
  progress: {
    title: 'Laufender Import',
    percentage: '{{value}} %',
    rows: '{{processed}} / {{total}} Zeilen',
    updatedAt: 'Zuletzt aktualisiert: {{value}}',
    phases: {
      'waste-management.import-preparation': 'Vorbereitung läuft',
      'waste-management.import-running': 'Importlauf läuft',
      'waste-management.enrich-postal-codes': 'Postleitzahlen werden ermittelt',
      'waste-management.completed': 'Import wird abgeschlossen',
    },
    statuses: {
      queued: 'Import wird vorbereitet',
      running: 'Import wird verarbeitet',
      retrying: 'Import wird erneut versucht',
    },
    steps: {
      'prepare-import': 'Import wird vorbereitet',
      'process-rows': 'Gültige Zeilen werden importiert',
      'load-cities': 'Orte ohne Postleitzahl werden geladen',
      'resolve-postal-codes': 'Postleitzahlen werden geprüft und ergänzt',
      'complete-operation': 'Import wird abgeschlossen',
    },
  },
});
