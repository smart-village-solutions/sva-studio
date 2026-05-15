## 1. Specification

- [x] 1.1 PR-Scope-Härtung für `test-coverage-governance` spezifizieren
- [x] 1.2 Ausbau von `tooling-testing` als CI- und Workflow-Absicherung in `monorepo-structure` spezifizieren
- [x] 1.3 `openspec validate refactor-pr-test-scope-hardening --strict` ausführen

## 2. Implementation

- [x] 2.1 `scripts/ci/pr-scope.ts` auf gate-spezifische Eskalationsursachen umstellen
- [x] 2.2 `tooling/testing` so erweitern, dass Workflow- und CI-Dateiänderungen affected anschlagen
- [x] 2.3 Contract-Tests für `pr-scope.ts`, `run-pr-gate.ts` und Workflow-Scope-Verhalten ergänzen
- [x] 2.4 Testing- und Governance-Dokumentation nachziehen
