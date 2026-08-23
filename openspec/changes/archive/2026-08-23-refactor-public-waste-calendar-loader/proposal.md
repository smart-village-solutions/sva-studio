# Change: Öffentlichen Kalender-Lader entflechten

## Why

Der produktive öffentliche Kalender-Lader bündelt SQL-Aufbau, Datenbankzugriffe,
Normalisierung und Ergebniszusammenführung in einem kritischen Komplexitäts-Hotspot.
Die fachlich etablierte Standort-, Datums- und Exportsemantik soll erhalten bleiben,
während die Verantwortlichkeiten prüfbar getrennt werden.

## What Changes

- Der Kalender-Lader trennt parametrisierte SQL-Abfragen von I/O-freier
  Normalisierung und Zusammenführung.
- Characterization-Tests sichern Standortgrenzen, inklusive Datumsfenster,
  Sortierung, Empty- und Fehlerpfade sowie die gemeinsame Web-/PDF-Datenbasis.
- Die bestehende öffentliche Repository-Fassade und alle Response-Verträge bleiben
  unverändert.

## Impact

- Affected specs: `public-waste-calendar`, `complexity-quality-governance`
- Affected code: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.ts`
  und neue app-lokale Kalender-Lader-Bausteine
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`,
  `10-quality-requirements`, `11-risks-and-technical-debt`
