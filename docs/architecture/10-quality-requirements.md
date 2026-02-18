# 10 Qualitaetsanforderungen

## Zweck

Dieser Abschnitt beschreibt messbare Qualitaetsziele auf aktuellem Stand.

## Mindestinhalte

- Qualitaetsziele (z. B. Sicherheit, Wartbarkeit, Verfuegbarkeit)
- Priorisierung und messbare Akzeptanzkriterien
- Bezug zu Tests, Monitoring und Quality Gates

## Aktueller Stand

### Priorisierte Qualitaetsziele

1. Sicherheit/Datenschutz
2. Wartbarkeit und Nachvollziehbarkeit
3. Beobachtbarkeit und Betrieb
4. Typsicherheit und Integrationsstabilitaet

### Messbare Kriterien (IST)

- Type Safety:
  - `pnpm test:types` muss gruen sein
- Lint/Build Qualitaet:
  - `pnpm test:eslint` muss gruen sein
- Unit-Test-Basis:
  - `pnpm test:unit` muss gruen sein
- File-Placement Governance:
  - `pnpm check:file-placement` muss gruen sein
- Coverage Governance:
  - Gate-Logik und Baselines in `scripts/ci/coverage-gate.ts` und `tooling/testing/*`

### Observability-Qualitaet

- Strukturierte Logs mit Pflichtfeldern (`component`, `environment`, `workspace_id`)
- Label-Whitelist und PII-Redaction entlang der OTEL-Pipeline
- Healthchecks fuer lokale Monitoring-Dienste in Compose

### Aktuelle Luecken

- Nicht alle Projekte haben vollwertige Unit/Coverage-Suites (teils exempt)
- App-Tests laufen derzeit mit `--passWithNoTests`, daher eingeschraenkte Aussagekraft

Referenzen:

- `../development/testing-coverage.md`
- `scripts/ci/coverage-gate.ts`
- `packages/monitoring-client/src/otel.server.ts`
