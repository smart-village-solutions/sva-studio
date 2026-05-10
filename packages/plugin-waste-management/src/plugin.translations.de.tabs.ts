export const wasteManagementPluginTranslationsDETabs = {
  "tabs": {
    "ariaLabel": "Abfallkalender-Bereiche",
    "overview": {
      "title": "Überblick",
      "body": "Die zentrale Waste-Historie basiert auf der Studio-Auditspur und macht technische sowie fachliche Mutationen der Instanz sichtbar.",
      "emptyTitle": "Noch keine Waste-Aktivität erfasst",
      "emptyBody": "Sobald Einstellungen, Stammdaten, Touren oder Ausweichtermine geändert werden, erscheint die Historie hier."
    },
    "masterData": {
      "title": "Stammdaten",
      "body": "Hier werden Regionen, Orte, Straßen, Hausnummern, Fraktionen und Abholorte schrittweise angebunden.",
      "emptyTitle": "Stammdaten folgen",
      "emptyBody": "Die Tabellen- und Dialogoberflächen werden in den nächsten Schritten gegen die Host-Fassade angebunden."
    },
    "tours": {
      "title": "Touren",
      "body": "Touren, Zuordnungen und Tour-spezifische Pflege erhalten einen eigenen fachlichen Arbeitsbereich.",
      "emptyTitle": "Touren folgen",
      "emptyBody": "Die erste Route hält bereits den teilbaren Tab- und Filterzustand für diesen Bereich bereit."
    },
    "scheduling": {
      "title": "Ausweichtermine",
      "body": "Globale und tourbezogene Verschiebungen bleiben als eigener Scheduling-Kontext explizit sichtbar.",
      "emptyTitle": "Ausweichtermine folgen",
      "emptyBody": "Hier werden später Kalender-, Bulk- und Konfliktansichten angeschlossen."
    },
    "tools": {
      "title": "Werkzeuge",
      "body": "Import, Migration, Seed und Reset werden über die generische Job-Fähigkeit des Hosts gestartet.",
      "emptyTitle": "Werkzeuge folgen",
      "emptyBody": "Die Job-Starter und Verlaufsanzeigen hängen im nächsten Slice an die Host-Endpunkte."
    },
    "settings": {
      "title": "Einstellungen",
      "body": "Die instanzbezogene Waste-Datenquelle bleibt auch bei Fehlerstatus gezielt erreichbar und rekonfigurierbar.",
      "emptyTitle": "Einstellungen folgen",
      "emptyBody": "Die bestehende Settings-Fassade wird anschließend direkt in diesen Tab integriert."
    }
  }
} as const;
