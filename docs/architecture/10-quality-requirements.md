# 10 Qualitaetsanforderungen

## Zweck

Dieser Abschnitt beschreibt messbare Qualitaetsziele auf aktuellem Stand.

## Mindestinhalte

- Qualitaetsziele (z. B. Sicherheit, Wartbarkeit, Verfuegbarkeit)
- Priorisierung und messbare Akzeptanzkriterien
- Bezug zu Tests, Monitoring und Quality Gates

## Aktueller Stand

### Priorisierte Qualitaetsziele

1. Wartbarkeit und Nachvollziehbarkeit
2. Typsicherheit und Integrationsstabilitaet
3. Reproduzierbare CI-Qualitaetspruefungen
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

### Observability-Qualitaet

- Architekturziele fuer Logging/Observability sind dokumentiert
- Eine vollstaendige Monitoring-Implementierung ist in diesem Branch nicht enthalten
- CI-Artefakte (`coverage-summary.json`, `lcov.info`) dienen als verifizierbare Qualitaetsnachweise

### Aktuelle Luecken

- Nicht alle Projekte haben vollwertige Unit/Coverage-Suites (teils exempt)
- App-Tests laufen derzeit mit `--passWithNoTests`, daher eingeschraenkte Aussagekraft

Referenzen:

- `../development/testing-coverage.md`
- `scripts/ci/coverage-gate.ts`
- `.github/workflows/test-coverage.yml`
