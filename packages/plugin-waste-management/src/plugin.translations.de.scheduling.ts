export const wasteManagementPluginTranslationsDEScheduling = {
  "scheduling": {
    "global": {
      "title": "Globale Ausweichtermine",
      "description": "Verschiebungen mit globaler Wirkung über mehrere Touren hinweg.",
      "cardTitle": "Globaler Termin {{value}}",
      "table": {
        "ariaLabel": "Tabelle globaler Waste-Ausweichtermine",
        "caption": "Tabelle globaler Waste-Ausweichtermine mit Kontext und Aktionen.",
        "originalDate": "Ursprünglicher Termin",
        "actualDate": "Verschobener Termin",
        "reason": "Grund",
        "description": "Beschreibung",
        "affectedTours": "Betroffene Touren",
        "hasYear": "Jahresbezug",
        "reasonKey": "Grundschlüssel",
        "actions": "Aktionen"
      },
      "actions": {
        "openCreate": "Globalen Termin anlegen",
        "edit": "Bearbeiten",
        "cancel": "Abbrechen",
        "create": "Ausweichtermin speichern",
        "save": "Änderungen speichern",
        "saving": "Speichert…"
      },
      "fields": {
        "originalDate": "Ursprünglicher Termin",
        "actualDate": "Verschobener Termin",
        "reasonType": "Abweichungsgrund",
        "reasonTypeUnset": "Grund auswählen",
        "reasonKey": "Grundschlüssel",
        "description": "Beschreibung",
        "hasYear": "Jahresbezug",
        "tourIds": "Betroffene Touren",
        "noToursAvailable": "Es sind noch keine Touren vorhanden."
      },
      "dialog": {
        "createTitle": "Globalen Ausweichtermin anlegen",
        "createDescription": "Erstellen Sie eine globale Verschiebung mit optional betroffenen Touren.",
        "editTitle": "Globalen Ausweichtermin bearbeiten",
        "editDescription": "Passen Sie Termin, Beschreibung oder betroffene Touren an."
      },
      "messages": {
        "createSuccess": "Der globale Waste-Ausweichtermin wurde angelegt.",
        "updateSuccess": "Der globale Waste-Ausweichtermin wurde aktualisiert.",
        "saveError": "Der globale Waste-Ausweichtermin konnte nicht gespeichert werden.",
        "saveForbidden": "Für das Speichern globaler Waste-Ausweichtermine fehlt die Berechtigung."
      }
    },
    "tour": {
      "title": "Tourbezogene Ausweichtermine",
      "description": "Gezielte Einzelverschiebungen für konkrete Touren.",
      "cardTitle": "Tour {{value}}",
      "table": {
        "ariaLabel": "Tabelle tourbezogener Waste-Ausweichtermine",
        "caption": "Tabelle tourbezogener Waste-Ausweichtermine mit Kontext und Aktionen.",
        "tourId": "Tour",
        "originalDate": "Ursprünglicher Termin",
        "actualDate": "Verschobener Termin",
        "reason": "Grund",
        "description": "Beschreibung",
        "followUpMode": "Folgeeffekt",
        "hasYear": "Jahresbezug",
        "reasonKey": "Grundschlüssel",
        "actions": "Aktionen"
      },
      "actions": {
        "openCreate": "Tourtermin anlegen",
        "edit": "Bearbeiten",
        "cancel": "Abbrechen",
        "create": "Ausweichtermin speichern",
        "save": "Änderungen speichern",
        "saving": "Speichert…"
      },
      "fields": {
        "tourId": "Tour",
        "tourUnset": "Tour auswählen",
        "originalDate": "Ursprünglicher Termin",
        "actualDate": "Verschobener Termin",
        "reasonType": "Abweichungsgrund",
        "reasonTypeUnset": "Grund auswählen",
        "reasonKey": "Grundschlüssel",
        "followUpMode": "Folgeeffekt",
        "followUpModeUnset": "Kein Folgeeffekt",
        "description": "Beschreibung",
        "hasYear": "Jahresbezug"
      },
      "dialog": {
        "createTitle": "Tourbezogenen Ausweichtermin anlegen",
        "createDescription": "Erstellen Sie eine gezielte Einzelverschiebung für eine konkrete Tour.",
        "editTitle": "Tourbezogenen Ausweichtermin bearbeiten",
        "editDescription": "Passen Sie Tour, Termin oder Beschreibung der Einzelverschiebung an."
      },
      "messages": {
        "createSuccess": "Der tourbezogene Waste-Ausweichtermin wurde angelegt.",
        "updateSuccess": "Der tourbezogene Waste-Ausweichtermin wurde aktualisiert.",
        "saveError": "Der tourbezogene Waste-Ausweichtermin konnte nicht gespeichert werden.",
        "saveForbidden": "Für das Speichern tourbezogener Waste-Ausweichtermine fehlt die Berechtigung."
      }
    },
    "meta": {
      "globalCount": "{{value}} globale Termine",
      "tourCount": "{{value}} tourbezogene Termine",
      "hasYear": "Jahresbezug: {{value}}",
      "affectedTours": "Betroffene Touren: {{value}}",
      "reasonType": "Grund: {{value}}",
      "reasonKey": "Schlüssel: {{value}}",
      "followUpMode": "Folgeeffekt: {{value}}"
    },
    "reasonTypes": {
      "holiday": "Feiertag",
      "global-deviation": "Globale Abweichung",
      "manual-adjustment": "Manuelle Anpassung",
      "operational-disruption": "Betriebsstörung",
      "weather": "Wetter",
      "other": "Sonstiges"
    },
    "followUpModes": {
      "none": "Keiner",
      "propagate-series": "Serie fortschreiben",
      "mark-follow-up-dates": "Folgetermine markieren"
    },
    "messages": {
      "loading": "Ausweichtermine werden geladen.",
      "loadError": "Die Waste-Ausweichtermine konnten nicht geladen werden.",
      "loadForbidden": "Für die Waste-Ausweichtermine fehlt die Berechtigung.",
      "emptyTitle": "Keine Ausweichtermine gefunden",
      "emptyBody": "Passen Sie die Filter an oder hinterlegen Sie Ausweichtermine in der Waste-Datenquelle."
    },
    "table": {
      "notAvailable": "Nicht vorhanden"
    }
  }
} as const;
