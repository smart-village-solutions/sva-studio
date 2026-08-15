# Plan 011: Public-Waste-Kalender-Lader entflechten

## Status

- Status: DONE
- Priorität: P1
- Aufwand: L
- Risiko: HIGH
- Abhängigkeit: offene Waste-PRs müssen gemergt und Verträge stabil sein
- Kategorie: öffentliche Datenabfrage und Mandantentrennung

## Ziel und Ist-Zustand

`apps/public-waste-calendar-web/src/lib/public-waste-repository.server.ts`
enthält in `loadCalendarEntries` einen Fallow-Hotspot mit 45 zyklomatischer, 47
kognitiver Komplexität und 369 Zeilen. Query-Aufbau, Mandanten-/Auswahlfilter,
Normalisierung und Fallbacks liegen in einer Funktion.

## Scope und Vorgehen

- Selection-, Kalender-, Reminder-, Fehler- und Leerpfade charakterisieren,
- Query-/Parameteraufbau, Ergebnisnormalisierung und Orchestrierung trennen,
- Mandantengrenzen und Auswahlfilter fail-closed beibehalten,
- Web- und PDF-Vertrag sowie bisherige Fallbacks nicht verändern,
- gemeinsame Loader-Logik nur bei realen mehreren Konsumenten zentralisieren.

## Verifikation

- Repository- und öffentliche Kalender-Unit-Tests mit Cross-Tenant-Negativen,
- Public-Waste Types, Runtime, Complexity-Gate, Fallow und OpenSpec strict,
- relevanter Web/PDF-Integrationstest für gleiche Auswahl und Einträge.

## Fertig, wenn

- `loadCalendarEntries` nicht mehr kritisch ist,
- dieselben Einträge, Sortierung und Filter für Web/PDF belegt sind,
- keine Daten anderer Instanzen oder Auswahlen sichtbar werden können.

## STOP-Bedingungen

- offene Waste-PRs ändern Repositoryvertrag, Schema oder Auswahlmodell,
- Web und PDF besitzen aktuell widersprüchliche, ungeklärte Semantik.

## Abschluss

- PR: #994
- Merge-Commit: `a699422574a1544c3f4b89bb6a97a00b3a8c74a0`
- Ergebnis: `loadCalendarEntries` (45/47/369) durch eine 46-zeilige
  I/O-Orchestrierung (2/1) und getrennte Projektion ersetzt. Standortfilter,
  Datumsfenster, Web-/PDF-Ausgabe sowie unabhängige Datum-/Notizprioritäten
  sind explizit charakterisiert; Fallow new-only ist ohne eingeführte Befunde.
