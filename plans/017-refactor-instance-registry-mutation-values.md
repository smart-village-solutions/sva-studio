# Plan 017: Instance-Registry-Mutationswerte typsicher strukturieren

> **Executor-Anweisung:** SQL-Positionsverträge, Secret-Erhalt und Mutation-Reihenfolge exakt charakterisieren, bevor produktiver Code geändert wird.

## Status

- **Priorität:** P1
- **Aufwand:** M
- **Risiko:** HOCH
- **Abhängigkeit:** keine
- **Kategorie:** Instanzdaten, Secrets, CRAP
- **Geplant auf:** `067e7a8e6`, 15. August 2026
- **Fallow vorher:** `updateInstanceValues` in `repository-mutations.ts:70` — cyclomatic 21, CRAP 116,3 critical; `createInstanceValues` CRAP 88 high; Datei 214 Zeilen, Fan-out 6, produktiv über den Instance-Registry-Repository-Index erreichbar.

## Warum

Create und Update bauen lange positionsabhängige SQL-Wertelisten. Besonders die beiden `keepExisting...Secret`-Flags müssen exakt zwischen „Wert beibehalten“, „löschen“ und „ersetzen“ unterscheiden. Benannte pure Teilmapper sollen die Positionsverträge lesbar machen, ohne SQL, Secret- oder Hostname-Verhalten zu ändern.

## Ist-Zustand

- `packages/data-repositories/src/instance-registry/repository-mutations.ts:47-93` erzeugt 20 bzw. 21 SQL-Werte per Array.
- `updateInstanceValues` koppelt `undefined`, explizites `false` und Ciphertext an CASE-Parameter `$9/$10` sowie `$12/$13`.
- `repository-provisioning.test.ts` testet Update und Hostname-Fehler teilweise; eine vollständige Wertpositionsmatrix fehlt.
- Der Scope überschneidet sich nicht mit PR #983: dort wird `apps/sva-studio-react/src/lib/instance-interfaces-server.ts` geändert, nicht dieses Repository-Modul.

## Scope

**In Scope:** Repository-Mutationsmodul, `repository-provisioning.test.ts` oder ein fokussierter Mapping-Test, minimaler interner Helper, OpenSpec `refactor-instance-registry-mutation-values`, Doku/Changelog.

**Out of Scope:** SQL-Text/Schema/Migrationen, Repository-Contract, Instanz-Interfaces aus PR #983, Hostname-Upsert-SQL, neue Secret-Defaults.

## Schritte

1. Baseline: gezielter `repository-provisioning.test.ts`-Run und `data-repositories:test:types`.
2. Characterization gegen Altcode: Create minimal/vollständig; Update für beide Secrets kombinatorisch mit keep undefined/true/false und Ciphertext undefined/null/Wert; Tenant-Admin-Objekt fehlt/partiell; FeatureFlags leer/voll; Actor fehlt; exakt 20/21 Werte, Position und Typ; kein Row-Result; Hostname-Upsert-Aufruf/Reihenfolge; Insert-/Update-/Hostname-Fehler und Fehleridentität.
3. Altcode-Characterization grün dokumentieren; OpenSpec strict validieren.
4. Fachlich benannte pure Value-Segmente einführen und final in unveränderter SQL-Reihenfolge zusammensetzen. Keine Objekt-zu-SQL-Reflection, kein `any`, kein Querybuilder.
5. Unit/Types/Lint, `pnpm check:server-runtime`, Complexity, OpenSpec strict, File Placement, Changelog und `git diff --check`.
6. Vor dem ersten Draft-Push und nach jeder relevanten Revision: `pnpm exec fallow audit --base origin/main --workspace @sva/data-repositories --explain --format json`; PASS mit `complexity_introduced=0`, `dead_code_introduced=0`, `duplication_introduced=0`.

## Fertig

- Beide Ziel-Findings verschwunden; SQL-Werteanzahl/-position und Secret-Erhalt sind vollständig charakterisiert.
- SQL, Schema, Hostname-Reihenfolge, Actor-Default und Fehleridentität bleiben unverändert.
- Root- und unabhängiges Security-/Datenintegritätsreview freigegeben.

## STOP

- STOP bei unklarer Semantik von `undefined` gegenüber `null` oder widersprüchlichen Secret-Tests.
- STOP, wenn SQL-/Schema-/Repository-Contract geändert werden müsste.
- STOP bei neuer Source-Überschneidung mit PR #983/#984 oder einem Instance-Registry-PR.
