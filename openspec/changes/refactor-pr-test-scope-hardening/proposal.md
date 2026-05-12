# Change: PR-Test-Scope gegen unnötige Voll-Läufe härten

## Why

Das aktuelle `affected-first`-Modell eskaliert PR-Gates bei Änderungen an Workflow- und CI-Dateien noch zu breit. Dadurch laufen `Lint`, `Unit`, `Types` und `Coverage` in Fällen voll, in denen gezielte Tooling-Checks ausreichen würden.

## What Changes

- Verfeinerung der PR-Scope-Klassifikation für Quality- und Coverage-Gates
- Entfernung pauschaler `full`-Eskalation für Root-`package.json`, `.github/workflows/**` und `scripts/ci/**`
- Ausbau von `tooling-testing` als gezieltes Absicherungsprojekt für CI-, Workflow- und PR-Gate-Logik
- Fortschreibung der Test- und Governance-Dokumentation für die präzisere Eskalationspolitik

## Impact

- Affected specs:
  - `test-coverage-governance`
  - `monorepo-structure`
- Affected code:
  - `scripts/ci/`
  - `tooling/testing/`
  - `.github/workflows/`
- Affected arc42 sections:
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
