export const wasteManagementPluginTranslationsDETools = {
  "tools": {
    "imports": {
      "title": "Importe",
      "description": "Startet fachnahe Waste-Importe als dünne Bedienhülle auf der generischen Host-Job-Fähigkeit.",
      "profileLabel": "Importprofil",
      "blobRefLabel": "Quell-Referenz (Blob-Ref)",
      "sourceFormatLabel": "Quellformat",
      "sourceFormats": {
        "csv": "CSV",
        "xlsx": "Excel (.xlsx)"
      },
      "dryRunLabel": "Nur Vorprüfung (Dry-Run)",
      "templateColumns": "Kanonische Importspalten"
    },
    "migrations": {
      "title": "Migrationen",
      "description": "Startet asynchrone Host-Migrationsjobs gegen die aktive Waste-Datenquelle.",
      "schemaLabel": "Zielschema",
      "versionLabel": "Anfordernde Version"
    },
    "seed": {
      "title": "Seed",
      "description": "Füllt die Waste-Datenquelle über die generische Job-Fähigkeit mit der Baseline."
    },
    "reset": {
      "title": "Reset",
      "description": "Reset bleibt ein hochriskanter Pfad und verlangt ein explizites Bestätigungstoken.",
      "tokenLabel": "Bestätigungstoken",
      "confirmTitle": "Reset wirklich starten?",
      "confirmDescription": "Dieser Reset ist hochriskant. Bestätigen Sie den Vorgang explizit mit dem Token.",
      "confirmCancel": "Abbrechen",
      "confirmAction": "Reset bestätigen"
    },
    "actions": {
      "startImport": "Import starten",
      "startMigrations": "Migrationen starten",
      "startSeed": "Seed starten",
      "startReset": "Reset starten",
      "starting": "Startet…",
      "downloadTemplate": "Vorlage laden",
      "openJob": "Job öffnen"
    },
    "messages": {
      "jobStarted": "Job {{jobId}} wurde gestartet.",
      "jobStartError": "Der Waste-Job konnte nicht gestartet werden.",
      "forbidden": "Für diese Waste-Operation fehlt die Berechtigung.",
      "importValidationError": "Der Import verlangt ein Importprofil und eine gültige Quell-Referenz.",
      "resetValidationError": "Der Reset verlangt ein gültiges Bestätigungstoken."
    },
    "meta": {
      "lastJobTitle": "Letzter technischer Job",
      "lastJobDescription": "Zuletzt gestarteter Waste-Host-Job mit technischem Status.",
      "noJobYet": "Noch kein technischer Waste-Job gestartet.",
      "noJobStatus": "Kein Job",
      "technicalHistoryTitle": "Technische Ereignisse",
      "technicalHistoryDescription": "Zeigt die letzten technischen Waste-Ereignisse mit unterscheidbaren Ergebnissen für Start, Erfolg und Fehler.",
      "noTechnicalHistory": "Noch keine technischen Waste-Ereignisse vorhanden.",
      "jobId": "Job: {{value}}",
      "jobType": "Typ: {{value}}",
      "jobStatus": "Status: {{value}}",
      "jobIdLabel": "Job",
      "jobTypeLabel": "Typ",
      "jobStatusLabel": "Status"
    }
  }
} as const;
