# Plan 012: DSR-Persistenzprimitiven zentralisieren

> **Executor-Anweisung:** Arbeite ausschließlich im zugewiesenen Worktree. Führe jeden Prüfpunkt aus. Vor produktiven Änderungen müssen neue Characterization-Tests gegen den unveränderten Altcode grün laufen. Bei einer STOP-Bedingung nicht improvisieren.

## Status

- **Priorität:** P1
- **Aufwand:** M
- **Risiko:** HOCH
- **Abhängigkeit:** keine
- **Kategorie:** Datenschutz, Datenintegrität, Duplikation
- **Geplant auf:** `067e7a8e6`, 15. August 2026
- **Ausgeliefert:** DONE über PR #997, Merge-Commit `57d7bdd5e02a1de5fa8163ba87f757f0d46973fa`
- **Fallow vorher:** Duplikat `dup:54714cc9` mit 141 Tokens/100 Zeilen in zwei Instanzen sowie `dup:f9215d48` mit 86 Tokens/90 Zeilen in drei Instanzen; `core.ts` hat 1.737 Zeilen, Fan-out 22 und ist produktiv erreichbar.

## Warum

Legal-Hold-Prüfung, DSR-Audit-Event und Request-Event-Persistenz sind in Auth-Runtime und IAM-Governance mehrfach als SQL kopiert. Drift an Mandantenfilter, Request-/Trace-Kontext oder JSON-Serialisierung hätte Datenschutz- und Nachweisfolgen. Ein einziges IAM-Governance-Modul soll diese unveränderten SQL-Verträge besitzen.

## Ist-Zustand und Reichweite

- `packages/auth-runtime/src/iam-data-subject-rights/core.ts:270-359` enthält lokale Legal-Hold- und Audit-Helfer.
- `packages/iam-governance/src/dsr-maintenance.ts:21-105` enthält dieselben SQL-Verträge; `dsr-export-flows.ts` enthält eine dritte Kopie.
- Fallow-Trace: alle drei Dateien sind erreichbar; `core.ts` wird von `runtime-routes.ts`, `dsr-maintenance.ts` von Auth-Runtime und dem Governance-Index konsumiert.
- Vertrag: immer `instance_id` binden, UUID-Casts beibehalten, `requestId`/`traceId` nur aus `getWorkspaceContext()`, keine PII zusätzlich loggen.

## Scope

**In Scope:** die drei genannten DSR-Dateien, ein minimales neues Shared-Modul unter `packages/iam-governance/src/`, zugehörige Tests und Exports, eigener OpenSpec-Change und deutsche Doku/Changelog.

**Out of Scope:** SQL-Schema/Migrationen, Retention-Zeiten, DSR-Statusmodell, Endpoint-Autorisierung, Payload-Formate.

## Arbeitsschritte

1. Baseline ausführen: `pnpm nx run iam-governance:test:unit` und `pnpm nx run auth-runtime:test:unit --testFiles=src/iam-data-subject-rights/core.test.ts`; beide müssen grün sein.
2. Characterization-Tests ergänzen und gegen Altcode ausführen: Legal Hold aktiv/inaktiv/abgelaufen/fremde Instanz; Audit mit/ohne Account, Request-ID und Trace-ID; Request-Event mit/ohne Actor/Payload; Queryfehler ohne Folgequery. Querytext, Parameterreihenfolge und Aufrufreihenfolge explizit prüfen.
3. OpenSpec `refactor-dsr-persistence-primitives` erstellen und `pnpm exec openspec validate refactor-dsr-persistence-primitives --strict` grün ausführen.
4. Shared-Funktionen im fachlichen Owner `@sva/iam-governance` extrahieren. Auth-Runtime importiert sie als deklarierte Runtime-Dependency; relative Runtime-Imports tragen `.js`.
5. Kopien erst nach grünem Shared-Test entfernen. Keine neue Service-/Factory-Schicht und keine Änderung an SQL oder Fehlerpropagation.
6. Gezielt prüfen: beide Unit-Targets, beide Type-Targets, `pnpm check:server-runtime`, Lint der beiden Projekte, Complexity, OpenSpec strict, File Placement, Changelog und `git diff --check`.
7. Vor dem ersten Draft-Push und nach jeder relevanten Revision je Workspace ausführen: `pnpm exec fallow audit --base origin/main --workspace @sva/iam-governance --explain --format json` sowie für `@sva/auth-runtime`. Beide müssen PASS und jeweils `complexity_introduced=0`, `dead_code_introduced=0`, `duplication_introduced=0` liefern.

## Fertig-Kriterien

- Die drei kopierten Legal-Hold-/Audit-/Request-Event-Verträge sind durch genau einen Owner ersetzt.
- Characterization deckt Positiv-, Negativ-, Fehler-, Reihenfolge-, Instanzgrenz- und Kontextfälle ab und lief vor dem Refactor grün.
- Keine SQL-, Parameter-, Status-, Logging- oder Transaktionssemantik änderte sich.
- Alle lokalen Gates und beide New-only-Audits sind grün; unabhängiges Risiko-Review bestätigt Datenschutz- und Semantikparität.

## STOP

- STOP, wenn die Kopien semantisch unterschiedliche Transaktionsgrenzen oder Mandantenfilter besitzen.
- STOP, wenn ein Shared-Modul eine neue zyklische Package-Abhängigkeit erzeugt.
- STOP, wenn Schema-/Migrationsänderungen oder neue DSR-Zustände erforderlich erscheinen.
