# 10 Qualitätsanforderungen

## Zweck

Dieser Abschnitt beschreibt messbare Qualitätsziele auf aktuellem Stand.

## Mindestinhalte

- Qualitätsziele (z. B. Sicherheit, Wartbarkeit, Verfügbarkeit)
- Priorisierung und messbare Akzeptanzkriterien
- Bezug zu Tests, Monitoring und Quality Gates

## Aktueller Stand

### Priorisierte Qualitätsziele

1. Wartbarkeit und Nachvollziehbarkeit
2. Typsicherheit und Integrationsstabilität
3. Reproduzierbare CI-Qualitätsprüfungen
4. Security-/Privacy-Governance

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

### Observability-Qualität

- Architekturziele für Logging/Observability sind dokumentiert
- Eine vollständige Monitoring-Implementierung ist in diesem Branch nicht enthalten
- CI-Artefakte (`coverage-summary.json`, `lcov.info`) dienen als verifizierbare Qualitätsnachweise

### Aktuelle Lücken

- Nicht alle Projekte haben vollwertige Unit/Coverage-Suites (teils exempt)
- App-Tests laufen derzeit mit `--passWithNoTests`, daher eingeschraenkte Aussagekraft

Referenzen:

- `../development/testing-coverage.md`
- `scripts/ci/coverage-gate.ts`
- `.github/workflows/test-coverage.yml`
