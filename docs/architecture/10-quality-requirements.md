# 10 Qualitätsanforderungen

## Zweck

Dieser Abschnitt beschreibt messbare Qualitätsziele auf aktuellem Stand.

## Mindestinhalte

- Qualitätsziele (z. B. Sicherheit, Wartbarkeit, Verfügbarkeit)
- Priorisierung und messbare Akzeptanzkriterien
- Bezug zu Tests, Monitoring und Quality Gates

## Aktueller Stand

### Priorisierte Qualitätsziele

1. Sicherheit/Datenschutz
2. Wartbarkeit und Nachvollziehbarkeit
3. Beobachtbarkeit und Betrieb
4. Typsicherheit und Integrationsstabilität

### Messbare Kriterien (IST)

- Type Safety:
  - `pnpm test:types` muss gruen sein
- Lint/Build Qualitaet:
  - `pnpm test:eslint` muss gruen sein
- Unit-Test-Basis:
  - `pnpm test:unit` muss gruen sein
- UI-Shell-Qualität:
  - Landmarks (`header`, `aside`, `main`) und Skip-Link vorhanden
  - Skeleton-Zustand für Sidebar, Kopfzeile und Contentbereich vorhanden
  - Responsives Verhalten für mobile und desktop geprüft
- File-Placement Governance:
  - `pnpm check:file-placement` muss gruen sein
- Coverage Governance:
  - Gate-Logik und Baselines in `scripts/ci/coverage-gate.ts` und `tooling/testing/*`

### Observability-Qualität

- Strukturierte Logs mit Pflichtfeldern (`component`, `environment`, `workspace_id`)
- Label-Whitelist und PII-Redaction entlang der OTEL-Pipeline
- Healthchecks fuer lokale Monitoring-Dienste in Compose

### Aktuelle Lücken

- Nicht alle Projekte haben vollwertige Unit/Coverage-Suites (teils exempt)
- App-Tests laufen derzeit mit `--passWithNoTests`, daher eingeschraenkte Aussagekraft

Referenzen:

- `../development/testing-coverage.md`
- `scripts/ci/coverage-gate.ts`
- `packages/monitoring-client/src/otel.server.ts`
