# Implementation Tasks

## 1. OpenSpec und Governance

- [x] 1.1 OpenSpec-Change `add-review-agent-coverage` mit `proposal.md`, `design.md`, `tasks.md` und Spec-Delta für `review-governance` anlegen
- [x] 1.2 Zentrale Governance-Doku unter `docs/development/review-agent-governance.md` anlegen
- [x] 1.3 arc42-Abschnitte `08-cross-cutting-concepts.md` und `10-quality-requirements.md` um Review-Governance ergänzen

## 2. Neue Review-Templates

- [x] 2.1 `pr-review-report.md` anlegen
- [x] 2.2 `test-quality-review.md` anlegen
- [x] 2.3 `i18n-content-review.md` anlegen
- [x] 2.4 `user-journey-review.md` anlegen
- [x] 2.5 `performance-review.md` anlegen

## 3. Neue Agents

- [x] 3.1 `pr-review-orchestrator.agent.md` als report-only Orchestrator für PRs anlegen
- [x] 3.2 `test-quality.agent.md` anlegen
- [x] 3.3 `i18n-content.agent.md` anlegen
- [x] 3.4 `user-journey-usability.agent.md` anlegen
- [x] 3.5 `performance.agent.md` anlegen

## 4. Bestehende Agents aktualisieren

- [x] 4.1 `proposal-review-orchestrator.agent.md` um `Test Quality`, `i18n & Content`, `User Journey & Usability` und `Performance` erweitern
- [x] 4.2 `security-privacy.agent.md` auf existierende Grundlagen umstellen
- [x] 4.3 `architecture.agent.md` auf existierende Grundlagen umstellen
- [x] 4.4 `operations-reliability.agent.md` auf existierende Grundlagen umstellen
- [x] 4.5 `ux-accessibility.agent.md` auf existierende Grundlagen umstellen und klar von Usability abgrenzen
- [x] 4.6 `interoperability-data.agent.md` auf existierende Grundlagen umstellen

## 5. Repo- und Architekturdoku

- [x] 5.1 `AGENTS.md` um Review-Agent-Übersicht und neue Verweise ergänzen
- [x] 5.2 `.github/copilot-instructions.md` um Tests, i18n, Nutzersicht und Performance ergänzen

## 6. Validierung

- [x] 6.1 `openspec validate add-review-agent-coverage --strict` ausführen
- [x] 6.2 `pnpm check:file-placement` ausführen
- [x] 6.3 lokale Link-/Pfadvalidierung für `.github/agents/*.agent.md` durchführen
