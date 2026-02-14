# 02 Randbedingungen

## Zweck

Dieser Abschnitt dokumentiert Rahmenbedingungen, die Architekturentscheidungen
im IST-System direkt beeinflussen.

## Mindestinhalte

- Technische Constraints (Runtime, Plattformen, Infrastruktur)
- Organisatorische Constraints (Team, Betrieb, Governance)
- Regulatorische Constraints (DSGVO, BSI, BITV, FIT)

## Aktueller Stand

### Technische Randbedingungen

- Node.js `>=22.12.0`, pnpm `>=9.12.2` (`package.json`)
- Nx-Monorepo mit standardisierten Targets (`build`, `lint`, `test:unit`)
- TanStack Start/Router fuer die Web-App
- Package-Abhaengigkeiten intern ueber `workspace:*`

### Organisatorische Randbedingungen

- Architektur-/Systemdoku arc42-konform unter `docs/architecture/`
- OpenSpec-gesteuerte Aenderungen mit Pflicht zur arc42-Referenzierung
- Repo-File-Placement Regeln werden per CI-Skript erzwungen

### Regulatorische/Qualitaets-Randbedingungen

- Security- und Accessibility-Regeln aus `DEVELOPMENT_RULES.md`
- Nachweisbare Test-/Lint-/Type-Checks im Entwicklungsworkflow
- PR-Checks fuer Coverage und Integration ueber GitHub Actions

Referenzen:

- `package.json`
- `pnpm-workspace.yaml`
- `openspec/AGENTS.md`
- `scripts/ci/check-file-placement.mjs`
- `.github/workflows/test-coverage.yml`
