# Plan 013: Governance-Delegation entflechten

> **Executor-Anweisung:** Characterization zuerst, danach verhaltensgleich refaktorieren. Nur der eigene Worktree/Branch darf verändert werden; bei STOP nicht ausweiten.

## Status

- **Priorität:** P1
- **Aufwand:** M
- **Risiko:** HOCH
- **Abhängigkeit:** keine
- **Kategorie:** Autorisierung, Datenintegrität, CRAP
- **Geplant auf:** `067e7a8e6`, 15. August 2026
- **Fallow vorher:** `createDelegation` in `governance-workflow-executor.ts:457` — cyclomatic 21, cognitive 13, 115 Zeilen, CRAP 116,3, critical; Datei 1.115 Zeilen, vier produktive Importpfade.

## Warum

Die Funktion entscheidet Ticketzustand, Rollen-ID, Zeitfenster, Self-Approval, drei Account-Auflösungen, Status und Audit in einem Block. Versehentliche Prioritäts- oder Fehlercodeänderungen wären unmittelbar autorisierungsrelevant. Reine Kernentscheidungen sollen charakterisiert und vom SQL-/Audit-Wiring getrennt werden.

## Ist-Zustand

`packages/iam-governance/src/governance-workflow-executor.ts:457-571` liest Payload-Felder, validiert UUID/Ticket/Zeitfenster, löst Delegator/Delegatee/Approver innerhalb der Actor-Instanz auf, verbietet Selbstfreigabe und schreibt Delegation plus Audit. Konsumenten sind `@sva/auth-runtime` Governance-Core und Impersonation; vorhandener Test bündelt Create und Revoke in einem Fall.

## Scope

**In Scope:** `governance-workflow-executor.ts`, kleine frameworkfreie Helper im selben Package, `governance-workflow-executor.test.ts`, eigener OpenSpec-Change und Changelog/Doku.

**Out of Scope:** DB-Schema, Ticketprovider, maximale Delegationsdauer, Reason Codes, Impersonation, Rollenmodell, neue Abstraktionsinterfaces.

## Schritte

1. Baseline: `pnpm nx run iam-governance:test:unit --testFiles=src/governance-workflow-executor.test.ts` und `pnpm nx run iam-governance:test:types` müssen grün sein.
2. Altcode charakterisieren: vollständige gültige Delegation; jedes Pflichtfeld einzeln fehlend; ungültige UUID; Ticketzustände; ungültige/gleiche/überlange/Boundary-Zeiträume; delegator actor fallback; jeder der drei Accounts fehlend; Self-Approval; zukünftiger vs. aktiver Start; SQL-/Audit-Reihenfolge und Queryfehler. Zeiten injizierbar/fixiert testen, keine Real-Time-Abhängigkeit.
3. Characterization nachweislich gegen Altcode grün ausführen.
4. OpenSpec `refactor-governance-delegation` anlegen und strict validieren.
5. Payload-Normalisierung und pure Delegationsentscheidung extrahieren; Account-Auflösung und Persistenz bleiben explizites Wiring. Bestehende Reason Codes, SQL-Parameter und Auditfelder unverändert lassen.
6. Relevante Unit/Types/Lint, `pnpm check:server-runtime`, Complexity, OpenSpec strict, File Placement, Changelog und `git diff --check` ausführen.
7. Vor dem ersten Draft-Push und nach jeder relevanten Revision: `pnpm exec fallow audit --base origin/main --workspace @sva/iam-governance --explain --format json`; PASS mit allen introduced-Zählern 0.

## Fertig

- `createDelegation` erscheint nicht mehr als Fallow-Finding; Characterization-Matrix ist vollständig und semantikgleich.
- Kein Fallback, Reason Code, Zeitvergleich, Instanzfilter, SQL- oder Auditvertrag wurde verändert.
- Root-Review und unabhängiges Security-/Datenintegritätsreview sind freigegeben.

## STOP

- STOP bei unklarer Zeitzonen-/Inclusive-Boundary-Semantik oder widersprüchlichen bestehenden Tests.
- STOP, wenn eine Transaktion neu eingeführt/entfernt werden müsste.
- STOP bei Überschneidung mit einem zwischenzeitlich aktiven Governance-OpenSpec/PR an denselben Symbolen.
