# Change: App-Unit-Suite in stabile Nx-Slices aufteilen

## Why

`sva-studio-react:test:unit` ist als einzelner großer Target zu teuer und zu flake-anfällig geworden. Für App-only-PRs sollen nur die fachlich betroffenen Unit-Slices laufen, ohne die Semantik der Voll-Läufe auf `main` zu verändern.

## What Changes

- Einführung gemeinsamer Vitest-Basis-Konfiguration für `sva-studio-react`
- Aufteilung der App-Unit-Suite in die Slices `ui`, `routes`, `hooks` und `server`
- Beibehaltung eines aggregierten `sva-studio-react:test:unit`-Targets für Voll-Läufe
- Erweiterung des PR-Runners um app-slice-aware Unit-Ausführung und Laufzeit-Summaries

## Impact

- Affected specs:
  - `monorepo-structure`
  - `test-coverage-governance`
- Affected code:
  - `apps/sva-studio-react/`
  - `scripts/ci/`
  - `package.json`
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/10-quality-requirements.md`
