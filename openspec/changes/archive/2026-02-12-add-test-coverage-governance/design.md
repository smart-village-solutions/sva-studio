## Context

Das Monorepo nutzt Nx + pnpm, jedoch ohne konsistente Coverage-Governance. Ziel ist ein belastbares Qualitätsmodell mit geringer Friktion für PR-Flow.

## Goals / Non-Goals

- Goals:
  - Einheitliche Testtarget-Semantik in allen relevanten Projekten
  - Reproduzierbare Coverage-Messung und PR-Transparenz
  - Stufenweise Einführung verbindlicher Gates
  - Trennung Unit vs Integration für stabile CI
- Non-Goals:
  - Sofortige 100%-Coverage
  - Einführung externer Coverage-SaaS-Lösungen in Phase 1

## Decisions

- Decision: Coverage-Gates pro Paket + global
  - Rationale: verhindert, dass schwache Pakete durch globale Durchschnittswerte kaschiert werden.
- Decision: stufenweiser Rollout mit Baseline + Ratchet
  - Rationale: minimiert PR-Blockaden bei historisch niedriger Testabdeckung.
- Decision: Integrations-Tests getrennt von Unit-Gates
  - Rationale: reduziert Flakiness in PR-Pipelines.
- Decision: Reporting via PR Summary + Artefakte
  - Rationale: hohe Sichtbarkeit ohne zusätzliche externe Plattform.

## Interfaces / Artifacts

- Nx Targets:
  - `test:unit`
  - `test:coverage`
  - `test:integration`
- CI Outputs:
  - PR Summary mit Coverage-Tabelle
  - Artefakte: `coverage-summary.json`, `lcov.info`

## Risks / Trade-offs

- Risiko: Uneinheitliche Projektstände (Platzhalter-Targets)
  - Mitigation: priorisierte Migration + klar dokumentierte Ausnahmen.
- Risiko: Flaky Integrationstests
  - Mitigation: separater Lauf, nicht PR-blockierend.
- Risiko: Anfangs niedrige Baseline
  - Mitigation: konservative Floors + Ratcheting.

## Rollout

1. Baseline erfassen und Policy initialisieren.
2. Reporting ohne harte Gates aktivieren.
3. Harte Gates zunächst konservativ aktivieren.
4. Floors sprintweise erhöhen.
