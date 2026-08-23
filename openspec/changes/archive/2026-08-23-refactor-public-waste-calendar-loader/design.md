## Context

`loadCalendarEntries` liest wiederkehrende Touren, manuelle und globale
Verschiebungen, explizite Einsätze sowie Feiertagsregeln aus der tenantgebundenen
Waste-Datenbank. Danach normalisiert und verbindet die Funktion diese Daten für
Web-, PDF- und iCal-Konsumenten. Der öffentliche Vertrag ist produktiv und darf
durch das Refactoring weder andere Standorte noch andere Datumsgrenzen liefern.

## Goals / Non-Goals

- Goals:
  - SQL-/Parameteraufbau, Datenbank-I/O und I/O-freie Projektion klar trennen
  - bestehende Standortvererbung, Prioritäten und Sortierung unverändert sichern
  - kritische Funktions- und Dateikomplexität beseitigen
- Non-Goals:
  - keine neuen Kalender-, Export- oder Reminder-Funktionen
  - keine Schema-, Rollen- oder Datenbankmigration
  - keine gemeinsame Abstraktion mit der administrativen Public-Config-Normalisierung

## Decisions

- Die Repository-Fassade behält `loadCalendarEntries` und delegiert intern an einen
  app-lokalen Loader. Damit bleiben alle bestehenden Konsumenten unverändert.
- SQL bleibt im serverseitigen Loader und verwendet weiterhin ein einmalig geprüftes,
  gequotetes Schema sowie positionsgebundene Parameter.
- Normalisierung, Shift-Indizes und das Zusammenführen expliziter Einsätze werden als
  pure Funktionen modelliert. Die vorhandene Kalender-Occurrence-Logik bleibt die
  führende Quelle für berechnete Termine.
- Die fünf Abfragegruppen bleiben in derselben Reihenfolge: verknüpfte Touren zuerst,
  danach Tourverschiebungen, globale Verschiebungen, explizite Einsätze und – nur bei
  gültigem Datumsfenster – Feiertagsregeln parallel.

## Risks / Trade-offs

- Ein versehentlich veränderter Parameterindex könnte Standorte vermischen.
  Characterization prüft deshalb identische Parameterfolgen für Touren und Einsätze.
- Eine anders aufgebaute Map könnte Prioritäten oder Sortierung verändern.
  Tests sichern explizite Einsatz-IDs, Notizpriorität und Datum-/Fraktionssortierung.
- Mehr interne Dateien erhöhen die Navigation. Die Trennung bleibt deshalb auf den
  serverseitigen Kalender-Lader, zwei I/O-freie Projektionsbausteine, deren lokale
  Zeilentypen und den von drei Repository-Pfaden geteilten Auswahlfilter begrenzt.

## Migration Plan

Kein Daten- oder Vertragsmigration nötig. Die Repository-Fassade wird intern
umgestellt und kann als atomarer Code-Rollback zurückgenommen werden.
