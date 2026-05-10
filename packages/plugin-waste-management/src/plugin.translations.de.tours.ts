export const wasteManagementPluginTranslationsDETours = {
  "tours": {
    "actions": {
      "openCreate": "Tour anlegen",
      "edit": "Bearbeiten",
      "cancel": "Abbrechen",
      "create": "Tour speichern",
      "save": "Änderungen speichern",
      "saving": "Speichert…"
    },
    "fields": {
      "name": "Name",
      "description": "Beschreibung",
      "recurrence": "Rhythmus",
      "recurrenceUnset": "Kein Rhythmus",
      "firstDate": "Erster Termin",
      "endDate": "Letzter Termin",
      "customDates": "Individuelle Termine",
      "customDatesPlaceholder": "2026-05-12 | Sonderabfuhr\n2026-05-26",
      "wasteFractions": "Abfallfraktionen",
      "noFractionsAvailable": "Es sind noch keine Abfallfraktionen vorhanden.",
      "active": "Status"
    },
    "dialog": {
      "createTitle": "Tour anlegen",
      "createDescription": "Erstellen Sie die erste bearbeitbare Tour inklusive Fraktionen und Terminlogik.",
      "editTitle": "Tour bearbeiten",
      "editDescription": "Passen Sie Fraktionen, Rhythmus und Datumslogik der Tour an."
    },
    "meta": {
      "count": "{{value}} Touren",
      "recurrence": "Rhythmus: {{value}}",
      "fractionCount": "Fraktionen: {{value}}",
      "locationCount": "Abholorte: {{value}}",
      "dateRange": "Zeitraum: {{value}}",
      "tourId": "Tour-ID: {{value}}"
    },
    "recurrence": {
      "weekly": "Wöchentlich",
      "biweekly": "Zweiwöchentlich",
      "fourweekly": "Vierwöchentlich",
      "yearly": "Jährlich",
      "onDemand": "Bedarfsabhängig",
      "custom": "Individuell"
    },
    "customDates": {
      "title": "Individuelle Termine"
    },
    "assignments": {
      "title": "Zuordnungen",
      "actions": {
        "openCreate": "Zuordnung anlegen",
        "edit": "Bearbeiten",
        "cancel": "Abbrechen",
        "create": "Zuordnung speichern",
        "save": "Änderungen speichern",
        "saving": "Speichert…"
      },
      "fields": {
        "tourId": "Tour",
        "tourUnset": "Tour auswählen",
        "locationId": "Abholort",
        "locationUnset": "Abholort auswählen",
        "startDate": "Startdatum",
        "endDate": "Enddatum"
      },
      "dialog": {
        "createTitle": "Tour-Zuordnung anlegen",
        "editTitle": "Tour-Zuordnung bearbeiten",
        "description": "Pflegen Sie Abholorte und optionale Gültigkeitszeiträume für {{value}}.",
        "descriptionFallback": "Pflegen Sie Abholorte und optionale Gültigkeitszeiträume."
      },
      "meta": {
        "startDate": "Start: {{value}}",
        "endDate": "Ende: {{value}}"
      },
      "messages": {
        "createSuccess": "Die Waste-Tour-Zuordnung wurde angelegt.",
        "updateSuccess": "Die Waste-Tour-Zuordnung wurde aktualisiert.",
        "saveError": "Die Waste-Tour-Zuordnung konnte nicht gespeichert werden.",
        "saveForbidden": "Für das Speichern von Waste-Tour-Zuordnungen fehlt die Berechtigung."
      }
    },
    "yearCalendar": {
      "title": "Jahreskalender",
      "description": "Zeigt die geplanten Termine für {{value}} inklusive bekannter Verschiebungen.",
      "descriptionFallback": "Zeigt die geplanten Termine inklusive bekannter Verschiebungen.",
      "actions": {
        "open": "Jahreskalender",
        "previousYear": "Vorjahr",
        "nextYear": "Folgejahr"
      },
      "meta": {
        "year": "Jahr {{value}}",
        "dateListTitle": "Geplante Termine",
        "noDates": "Für dieses Jahr konnten keine Termine berechnet werden."
      }
    },
    "messages": {
      "loading": "Touren werden geladen.",
      "loadError": "Die Waste-Touren konnten nicht geladen werden.",
      "loadForbidden": "Für die Waste-Touren fehlt die Berechtigung.",
      "emptyTitle": "Keine Touren gefunden",
      "emptyBody": "Passen Sie die Filter an oder hinterlegen Sie Touren in der Waste-Datenquelle.",
      "createSuccess": "Die Waste-Tour wurde angelegt.",
      "updateSuccess": "Die Waste-Tour wurde aktualisiert.",
      "saveError": "Die Waste-Tour konnte nicht gespeichert werden.",
      "saveForbidden": "Für das Speichern von Waste-Touren fehlt die Berechtigung."
    }
  }
} as const;
