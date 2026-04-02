# Change: `goose` als OSS-Standard für SQL-Migrationen einführen

## Why

Der bisherige dateibasierte SQL-Runner liefert keinen belastbaren Migrationsstatus, erschwert Drift-Erkennung und verlangt zu viel implizites Betriebswissen für lokale, Docker- und Acceptance-Pfade. Das Projekt benötigt ein OSS-konformes, standardisiertes SQL-Migrationswerkzeug, ohne den SQL-first-Ansatz für Postgres-, IAM- und RLS-nahe Artefakte aufzugeben.

## What Changes

- `goose` wird als führendes OSS-Migrationstool eingeführt.
- Der historische SQL-Bestand wird in einen kanonischen `goose`-Pfad mit eindeutiger Versionsfolge überführt.
- Nx-, Runtime-, Docker- und Acceptance-Migrationspfade werden auf einen gepinnten Repo-Wrapper umgestellt.
- Diagnose- und Deploy-Pfade melden zusätzlich echten Migrationsstatus und `goose`-Version.
- Die relevanten Runbooks und Architekturreferenzen werden auf das neue Betriebsmodell aktualisiert.

## Impact

- Affected specs:
  - `monorepo-structure`
  - `deployment-topology`
- Affected code:
  - `packages/data/scripts/`
  - `packages/data/migrations/`
  - `packages/data/project.json`
  - `scripts/ops/runtime-env.ts`
  - `scripts/ops/runtime-env.shared.ts`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/07-deployment-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
