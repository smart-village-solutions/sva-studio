## 1. Spezifikation und Architekturvertrag

- [x] 1.1 OpenSpec-Deltas fuer `monorepo-structure` und `architecture-documentation` finalisieren
- [x] 1.2 die widerspruechlichen Normquellen konkret inventarisieren, mindestens `docs/monorepo.md`, `docs/adr/ADR-034-plugin-sdk-vertrag-v1.md`, relevante `docs/architecture/*.md` und `docs/development/*.md`
- [x] 1.3 betroffene arc42-Abschnitte auf den kanonischen Boundary-Vertrag `plugin-sdk` plus `server-runtime` ausrichten
- [x] 1.4 ADR-034 sichtbar fortschreiben; keine neue ADR mit Supersession-Notiz anlegen

## 2. Deprecation- und Boundary-Enforcement

- [x] 2.1 `packages/sdk` und zugehoerige Entwicklerdokumentation explizit als deprecated Compatibility-Layer markieren
- [x] 2.2 die verbleibenden `@sva/sdk`-Exports und Subpaths inventarisieren und einem Zielpackage zuordnen
- [x] 2.3 Mapping fuer erlaubte Zielimporte dokumentieren, insbesondere `@sva/sdk` -> `@sva/plugin-sdk` oder `@sva/server-runtime`
- [x] 2.4 bestehende Lint- und Review-Regeln gegen den Ist-Zustand pruefen und nur bei nachgewiesener Luecke anpassen

## 3. Migrationsvorbereitung

- [x] 3.1 bestaetigen, ob ausserhalb von `packages/sdk` ueberhaupt noch aktive produktive `@sva/sdk`-Consumer existieren
- [x] 3.2 zuerst migrierbare Altpfade nur dann als Folgearbeiten oder Teilwellen dokumentieren, wenn Schritt 3.1 reale Consumer ergibt
- [x] 3.3 verbleibende Restabweichungen als technische Schuld mit Abbaukriterium dokumentieren, inklusive des Falls "nur Compat-Exports plus Doku-Restlast"

## 4. Validierung

- [x] 4.1 `openspec validate refactor-sdk-boundary-finalization --strict` ausfuehren
