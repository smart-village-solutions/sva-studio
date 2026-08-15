# Plan 017: Mainserver-Event-Mutationsmapping entflechten

> **Executor-Anweisung:** Mutation-Shape, Null-/Omit-Semantik und Reihenfolge exakt erhalten. Characterization zuerst.

## Status

- **Priorität:** P1
- **Aufwand:** M
- **Risiko:** HOCH
- **Abhängigkeit:** keine
- **Kategorie:** Datenintegrität, Mainserver, CRAP
- **Geplant auf:** `067e7a8e6`, 15. August 2026
- **Fallow vorher:** `buildEventMutationVariables` in `service-internals/event-operations.ts:28` — cyclomatic 26, cognitive 25, 34 Zeilen, CRAP 172 critical; Datei ist produktiv über `service.ts` erreichbar.

## Warum

Die Funktion übersetzt Event-Domänendaten in GraphQL-Mutationsvariablen. Optionale Felder, leere Arrays, Sichtbarkeit, Datum/Zeit und Geo-/Kategoriebezüge dürfen nicht unbemerkt anders serialisiert werden. Kleine pure Feldmapper sollen die Verzweigungen isolieren, während das Output-Objekt byte-/deep-equal bleibt.

## Ist-Zustand

- `packages/sva-mainserver/src/server/service-internals/event-operations.ts:28-61` baut Variablen mit vielen bedingten Spreads.
- Der Service konsumiert die Funktion im produktiven Create/Update-Pfad; vorhandene Service-Tests sind breiter und charakterisieren nicht jede Feldkombination direkt.
- Server-Package: `.js`-Runtime-Importregeln und `check:server-runtime` sind zwingend.

## Scope

**In Scope:** Event-Operations-Modul, minimaler interner Helper, gezielte Service-/neue Unit-Tests, OpenSpec `refactor-mainserver-event-mutation-mapping`, Doku/Changelog.

**Out of Scope:** GraphQL-Schema, API-Inputtypen, Events-Route, Plugin-Events-Form, neue Validierung oder Defaultwerte.

## Schritte

1. Baseline: relevante Event-Service-Tests via `pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service.test.ts`; Types ebenfalls grün.
2. Characterization gegen Altcode: vollständiger Input; jedes optionale Feld fehlt/einzel vorhanden; leer vs. undefined; false/0/empty string; Kategorien/Adressen/Medien; Datums- und Zeitzonengrenzen; Create/Update; Fehler/Call-Reihenfolge. Resultat deep-equal und GraphQL-Callargumente prüfen.
3. OpenSpec strict validieren.
4. Fachlich benannte pure Teilmapper extrahieren und Variables-Assembler flach halten. Keine Änderung an Property-Namen, Omit-/Null-Semantik oder Reihenfolge der Seiteneffekte.
5. Unit/Types/Lint, `pnpm check:server-runtime`, Complexity, OpenSpec strict, File Placement, Changelog und `git diff --check`.
6. `pnpm exec fallow audit --base origin/main --workspace @sva/sva-mainserver --explain --format json`: PASS und alle introduced-Zähler 0.

## Fertig

- Ziel-Finding ist weg; Characterization deckt kombinatorische optionale Felder und Datumsgrenzen ab.
- GraphQL-Variablen und Aufrufreihenfolge sind unverändert.
- Root- und unabhängiges Datenintegritätsreview freigegeben.

## STOP

- STOP bei unklarer Unterscheidung zwischen omitted, null und leer.
- STOP, wenn GraphQL-/Plugin-Verträge geändert werden müssten.
- STOP bei Source-Überschneidung mit neuem Mainserver-PR/OpenSpec.
