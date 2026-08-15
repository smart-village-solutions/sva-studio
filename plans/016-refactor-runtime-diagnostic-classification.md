# Plan 016: IAM-Runtime-Diagnostik als Prioritätsmatrix modellieren

> **Executor-Anweisung:** Diagnoseprioritäten sind Vertrag. Neue Characterization muss vor dem Refactor jede konkurrierende Signalkombination abdecken.

## Status

- **Priorität:** P1
- **Aufwand:** M
- **Risiko:** MITTEL
- **Abhängigkeit:** keine
- **Kategorie:** IAM-Fehlerdiagnostik, Blast Radius, CRAP
- **Geplant auf:** `067e7a8e6`, 15. August 2026
- **Fallow vorher:** `classify` in `runtime-diagnostics.ts:148` — cyclomatic 24, 75 Zeilen, CRAP 148,4 critical; `resolveRecommendedAction` CRAP 63,6 high; produktive Aufrufe aus Studio und Auth-Runtime.

## Warum

Die Reihenfolge von Reason-Code, Sync-Fehler, Session-, Keycloak-, Datenbank- und Registry-Signalen bestimmt sichtbare Recovery-Hinweise. Ein scheinbar harmloser Umbau kann Prioritäten und damit operative Fehlersuche verändern. Eine explizite, testbare Regelmatrix reduziert Komplexität bei identischer Priorität.

## Ist-Zustand

`packages/core/src/iam/runtime-diagnostics.ts:148-279` enthält eine lange If-Kaskade plus Action-Switch. `deriveIamRuntimeDiagnostics` wird in `apps/sva-studio-react` und mehrfach in `@sva/auth-runtime` auf jedem relevanten API-Fehler verwendet. Bestehende Tests prüfen viele Einzelfälle, aber nicht alle konkurrierenden Signale.

## Scope

**In Scope:** Runtime-Diagnostics-Modul/Test, minimale interne Tabellen/Prädikate, OpenSpec `refactor-iam-runtime-diagnostic-classification`, Doku/Changelog.

**Out of Scope:** neue Codes/Klassifikationen/Aktionen, sichtbare Texte, HTTP-Status, Logging, Auth-Runtime-Callsites.

## Schritte

1. Baseline: `pnpm nx run core:test:unit --testFiles=src/iam/runtime-diagnostics.test.ts` und `core:test:types`.
2. Characterization gegen Altcode: jede Klassifikation und Action; unbekannt 4xx/5xx; unsafe Detailwerte; snake/camel Sync-Felder; konkurrierende Kombinationen, insbesondere Pre-Sync vor Sync, Sync vor Post-Sync, Session vor Keycloak/DB, Actor vor Keycloak/DB, DB vor Mapping und Registry-Fallback. Tabellengetrieben prüfen.
3. OpenSpec strict validieren.
4. Priorisierte Regeln als readonly Daten-/Prädikatsstruktur oder kleine pure Funktionen ausdrücken. First-match-Semantik und Status-/Action-Mapping unverändert lassen; keine generische Rule Engine.
5. Unit/Types/Lint, `pnpm check:server-runtime`, Complexity, OpenSpec strict, File Placement, Changelog, `git diff --check`.
6. `pnpm exec fallow audit --base origin/main --workspace @sva/core --explain --format json`: PASS, alle introduced-Zähler 0; bei CRAP Coverage-Audit wiederholen.

## Fertig

- Beide Findings verschwunden; Prioritätsmatrix ist durch konkurrierende Negativfälle fixiert.
- Keine Klassifikation, Action, Status oder Safe-Details-Selektion änderte sich.
- Root- und unabhängiges Semantikreview freigegeben.

## STOP

- STOP bei widersprüchlicher existierender Priorität zwischen Code und Tests/Doku.
- STOP, wenn neue öffentliche Codes oder Übersetzungen nötig wären.
- STOP, wenn die Lösung zu einer generischen Regelengine statt minimaler Kernlogik anwächst.
