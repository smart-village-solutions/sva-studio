# Change: Plugin-Architecture-Boundary-Governance schaerfen

## Why

Die bestehende Plugin-Plattform trennt deklarative Plugin-Vertraege bereits von Host-Ownership, laesst aber in der Praxis noch implizite Core- und Host-Kopplungen zu. Dadurch konnten interne Plugins Architekturdrift aufbauen, ohne von den bisherigen Quality Gates frueh blockiert zu werden.

## What Changes

- Standard Path und Advanced Path fuer Studio-Plugins normativ festziehen
- einen blockierenden Plugin-Architecture-Boundary-Check mit Brownfield-Baseline einfuehren
- interne Plugins denselben Boundary-Regeln wie externe Plugins unterwerfen
- Dateistruktur- und Host-Package-Signale explizit als Governance-Signal etablieren
- Review- und PR-Governance fuer neue Ausnahmen, neue Advanced-Path-Faehigkeiten und Baseline-Aenderungen verschaerfen

## Impact

- Affected specs:
  - `monorepo-structure`
  - `plugin-platform`
- Affected code:
  - `scripts/ci/check-plugin-architecture-boundary.ts`
  - `scripts/ci/run-pr-gate.ts`
  - `package.json`
  - `docs/guides/plugin-development.md`
  - `docs/architecture/package-zielarchitektur.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
  - `docs/development/review-agent-governance.md`
  - `docs/reports/plugin-architecture-boundary-baseline.md`
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`

## Relationship to Existing Changes

Dieser Change ergaenzt `add-p3-plugin-extension-tier-governance`. Erweiterungstiefen und Boundary-Governance sind verwandt, aber nicht austauschbar:

- Tiers klassifizieren erlaubte Erweiterungstiefen
- dieser Change erzwingt die minimale Plugin-Grenze gegen implizite Core- und Host-Kopplung
