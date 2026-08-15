# Plan 015: Plugin-Zugriffs- und Action-Registry modularisieren

> **Executor-Anweisung:** Namespace- und Zugriffsschutz sind Sicherheitsverträge. Erst kombinatorisch charakterisieren, dann frameworkfreie Kernlogik extrahieren.

## Status

- **Priorität:** P1
- **Aufwand:** L
- **Risiko:** HOCH
- **Abhängigkeit:** keine
- **Kategorie:** Plugin-Autorisierung, Blast Radius, CRAP
- **Geplant auf:** `067e7a8e6`, 15. August 2026
- **Fallow vorher:** `hasMatchingPluginAccessRequirement` CRAP 184,5 critical; `createPluginActionRegistry` cognitive 31 high; sechs Findings in `plugins.ts`, 1.470 Zeilen, Fan-in 9/Fan-out 7, 35 Commits.

## Warum

Die Registry ist der zentrale Fail-closed-Vertrag für Plugin-Namespaces, Permissions, Admin-Ressourcen und Actions. Die heutige Datei koppelt Vergleich, Normalisierung und Registry-Wiring so stark, dass kleine Änderungen viele Sicherheitsverträge gleichzeitig gefährden. Pure Vergleichs-/Validierungslogik soll klar besessen und separat geprüft werden.

## Ist-Zustand

- `packages/plugin-sdk/src/plugins.ts:472-499` vergleicht Tenant-Anforderungen inklusive Mengen- und Resource-Capability-Feldern.
- `plugins.ts:1229` baut die Action-Registry und prüft doppelte Plugin-/Action-IDs sowie reservierte Namespaces.
- Fallow-Trace belegt neun direkte interne Konsumenten und 61 Wertreferenzen; externe Plugins konsumieren die öffentliche Package-API.
- Archiviertes OpenSpec `add-plugin-actions-namespace-isolation` dokumentiert fail-closed Owner-/Namespace-Checks; dieser Vertrag bleibt normativ.

## Scope

**In Scope:** `plugins.ts`, wenige neue interne Module unter `packages/plugin-sdk/src/plugin-platform/` oder bestehendem Registry-Muster, `plugin-registries.test.ts`/`tests/plugins.test.ts`, Exports nur falls intern nötig, neuer OpenSpec-Refactor, Doku/Changelog.

**Out of Scope:** öffentliche Plugin-Typen, Action-ID-Format, reservierte Namespaces, Legacy-Aliasverhalten, neue Plugin-Funktionen, UI.

## Schritte

1. Baseline: beide genannten Testdateien gezielt über `pnpm nx run plugin-sdk:test:unit --testFiles=...`, danach `plugin-sdk:test:types`.
2. Characterization gegen Altcode: undefined/identische/abweichende Requirements; tenant vs. andere Kinds; Action-Mengen mit Reihenfolge/Duplikaten; mode/module/resourceContext; jedes Resource-Capability-Feld einzeln; doppelte Plugins/Actions; reservierter/fremder/fehlender Namespace; leere Actions; Legacy-Mismatch; stabile Fehlerpriorität und exakte Error-Codes.
3. OpenSpec `refactor-plugin-access-registry` erstellen und strict validieren.
4. Vergleich und Registry-Validierungsphasen in pure interne Module zerlegen. `createPluginActionRegistry` bleibt öffentliche Fassade; keine Config-/Factory-Schicht.
5. Characterization nach jedem Block sowie Unit/Types/Lint, `pnpm check:server-runtime`, Complexity, OpenSpec strict, File Placement, Changelog und `git diff --check`.
6. Vor dem ersten Draft-Push und nach jeder relevanten Revision: `pnpm exec fallow audit --base origin/main --workspace @sva/plugin-sdk --explain --format json`; PASS mit allen introduced-Zählern 0; bei CRAP Coverage erzeugen und Audit mit `coverage-final.json` wiederholen.

## Fertig

- Beide Ziel-Findings sind verschwunden; öffentliche Typen/Exports und Fehlerpriorität sind unverändert.
- Kombinatorische Negativmatrix belegt Fail-closed-Verhalten für Namespace, Action und Resource Capability.
- Root-Review und unabhängiges Security-/Abstraktionsreview freigegeben.

## STOP

- STOP, wenn Characterization einen ungeklärten Unterschied zwischen Mengen- und Listen-Semantik zeigt.
- STOP bei notwendiger Änderung öffentlicher Plugin-Verträge oder archivierter Namespace-Anforderungen.
- STOP bei aktivem PR/OpenSpec mit Source-Überschneidung in `plugins.ts`.
