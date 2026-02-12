# Change: Standardisierte Test-Coverage Governance für Nx Monorepo

## Why

Aktuell ist Test-Coverage im Workspace nicht konsistent abbildbar:
- uneinheitliche Nx-Testtargets (`test`, `test:unit`, Platzhalter)
- fehlende standardisierte Coverage-Erzeugung/Reports
- kein verbindliches Coverage-Gating in CI
- Integrationstests (z.B. Redis) sind nicht sauber von Unit-Tests getrennt

Das erhöht das Risiko von Qualitätsregressionen und erschwert transparente PR-Reviews.

## What Changes

- Einführung einer neuen Capability `test-coverage-governance`
- Einheitliche Nx-Testtarget-Konvention:
  - `test:unit` für stabile, schnelle Unit-Tests
  - `test:coverage` für Unit-Tests mit Coverage-Report
  - `test:integration` für infra-abhängige Tests (separat)
- Coverage-Gates auf zwei Ebenen:
  - pro Paket
  - global
- Stufenweiser Rollout mit Baseline und Ratcheting
- CI-Reporting über GitHub PR Summary + Artefakte (kein externer Dienst erforderlich)
- Affected-Strategie für effiziente Coverage-Läufe

**BREAKING**: Keine API-Breaking-Changes; CI-Verhalten wird schrittweise strenger.

## Impact

- **Affected specs**:
  - `test-coverage-governance` (neu)
  - `monorepo-structure` (MODIFIED: Target-Konventionen)
- **Affected code/config**:
  - `project.json` in Apps/Packages (Test-Targets)
  - Root `package.json` Scripts für Coverage-Workflows
  - GitHub Actions Workflows für CI-Reporting/Gates
  - Vitest Coverage-Konfigurationen in relevanten Projekten
- **Developer Workflow**:
  - klare Trennung Unit vs Integration
  - transparente Coverage-Auswertung pro PR
