# Testing & Coverage Governance

## Ziel

Dieses Dokument beschreibt den standardisierten Coverage-Workflow im Nx Monorepo:

- einheitliche Testtargets (`test:unit`, `test:coverage`, `test:integration`)
- Coverage-Gates pro Paket und global
- PR-Transparenz via CI Summary + Artefakte
- stufenweiser Rollout mit Baseline und Ratcheting

## Target-Konvention

Jedes Projekt soll folgende Targets bereitstellen:

- `test:unit`: schnelle, stabile Unit-Tests
- `test:coverage`: Unit-Tests mit Coverage-Reporting
- `test:integration`: infra-abhängige Tests (z. B. Redis, echte Services)

## Lokaler Workflow

### Gesamtes Workspace

```bash
pnpm test:unit
pnpm test:coverage
pnpm test:integration
```

### Nur betroffene Projekte

```bash
pnpm test:coverage:affected
```

### Baseline aktualisieren

Nur nach bewusstem Team-Entscheid:

```bash
node scripts/ci/coverage-gate.mjs --update-baseline
```

## Coverage-Gates

Policy-Dateien:

- `tooling/testing/coverage-policy.json`
- `tooling/testing/coverage-baseline.json`

Regeln:

- Gates werden pro Projekt und global ausgewertet
- Initiale Floors sind konservativ, danach Ratcheting
- Abfälle gegen Baseline über der erlaubten Schwelle schlagen fehl
- Exempt-Projekte sind in der Policy explizit dokumentiert

## CI-Verhalten

Workflow: `.github/workflows/test-coverage.yml`

- Pull Requests:
  - `test:coverage:affected`
  - Coverage-Gate (blockierend)
  - Integrationstests separat, optional (`continue-on-error`)
- Main + Nightly:
  - `test:coverage` (voll)
  - Coverage-Gate (blockierend)
  - Integrationstests separat und verpflichtend

## Exemptions

Aktuell als coverage-exempt markiert:

- `core`
- `data`
- `plugin-example`

Diese Liste wird schrittweise reduziert, sobald echte Unit-Tests vorhanden sind.
