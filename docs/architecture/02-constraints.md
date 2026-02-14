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
- TanStack Start/Router fuer App und Server-Routen
- Redis als Session-Store, lokal via Docker Compose
- OTEL-basierte Logging-/Metrikpipeline ueber Collector

### Organisatorische Randbedingungen

- Architektur-/Systemdoku arc42-konform unter `docs/architecture/`
- OpenSpec-gesteuerte Aenderungen mit Pflicht zur arc42-Referenzierung
- Repo-File-Placement Regeln werden per CI-Skript erzwungen

### Regulatorische/Qualitaets-Randbedingungen

- PII-Schutz im Logging (Redaction + Label-Whitelist)
- Security- und Accessibility-Regeln aus `DEVELOPMENT_RULES.md`
- Nachweisbare Test-/Lint-/Type-Checks im Entwicklungsworkflow

Referenzen:

- `package.json`
- `openspec/AGENTS.md`
- `scripts/ci/check-file-placement.mjs`
- `packages/monitoring-client/src/otel.server.ts`
