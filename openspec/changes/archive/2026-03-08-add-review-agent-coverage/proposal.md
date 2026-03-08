# Change: Review-Agent-Abdeckung und Review-Governance erweitern

## Why

Die bestehende Agent-Landschaft deckt zentrale Qualitätsdimensionen bereits gut ab, hat aber drei strukturelle Lücken:

- Es gibt keinen dedizierten Orchestrator für normale PR-/Code-Reviews.
- Testqualität, i18n/Content, Nutzersicht/Usability und Performance werden nur implizit oder nachgelagert adressiert.
- Mehrere bestehende Agents referenzieren lokale Grundlagen unter `specs/`, die im Repository nicht existieren.

Dadurch entsteht Uneinheitlichkeit in Review-Ergebnissen, ein höheres Risiko für blinde Flecken und unnötige manuelle Koordination bei PRs und Proposal-Reviews.

## What Changes

### 1. Neue spezialisierte Review-Agents

Es werden fünf neue Agents unter `.github/agents/` eingeführt:

- `pr-review-orchestrator.agent.md`
- `test-quality.agent.md`
- `i18n-content.agent.md`
- `user-journey-usability.agent.md`
- `performance.agent.md`

### 2. Standardisierte Review-Templates

Es werden neue Templates unter `.github/agents/templates/` eingeführt:

- `pr-review-report.md`
- `test-quality-review.md`
- `i18n-content-review.md`
- `user-journey-review.md`
- `performance-review.md`

### 3. Proposal-Orchestrierung erweitern

Der bestehende `proposal-review-orchestrator.agent.md` wird erweitert, sodass er bei OpenSpec-Proposals zusätzlich die neuen Fachreviewer `Test Quality`, `i18n & Content`, `User Journey & Usability` und `Performance` trigger-basiert aufrufen kann.

### 4. Ungültige Grundlagen in bestehenden Agents reparieren

Die bestehenden Agents `security-privacy`, `architecture`, `operations-reliability`, `ux-accessibility` und `interoperability-data` werden auf existierende Repo-Dateien umgestellt. Verweise auf nicht vorhandene `specs/*.md` entfallen.

### 5. Review-Governance dokumentieren

Es wird eine zentrale Governance-Dokumentation unter `docs/development/review-agent-governance.md` ergänzt. Zusätzlich werden `AGENTS.md`, `.github/copilot-instructions.md` sowie die arc42-Abschnitte 08 und 10 aktualisiert.

## Impact

### Affected Specs

- `review-governance` (ADDED)

### Affected Files

**Neue Dateien:**

- `openspec/changes/add-review-agent-coverage/proposal.md`
- `openspec/changes/add-review-agent-coverage/tasks.md`
- `openspec/changes/add-review-agent-coverage/design.md`
- `openspec/changes/add-review-agent-coverage/specs/review-governance/spec.md`
- `.github/agents/pr-review-orchestrator.agent.md`
- `.github/agents/test-quality.agent.md`
- `.github/agents/i18n-content.agent.md`
- `.github/agents/user-journey-usability.agent.md`
- `.github/agents/performance.agent.md`
- `.github/agents/templates/pr-review-report.md`
- `.github/agents/templates/test-quality-review.md`
- `.github/agents/templates/i18n-content-review.md`
- `.github/agents/templates/user-journey-review.md`
- `.github/agents/templates/performance-review.md`
- `docs/development/review-agent-governance.md`

**Geänderte Dateien:**

- `.github/agents/proposal-review-orchestrator.agent.md`
- `.github/agents/security-privacy.agent.md`
- `.github/agents/architecture.agent.md`
- `.github/agents/operations-reliability.agent.md`
- `.github/agents/ux-accessibility.agent.md`
- `.github/agents/interoperability-data.agent.md`
- `AGENTS.md`
- `.github/copilot-instructions.md`
- `docs/architecture/08-cross-cutting-concepts.md`
- `docs/architecture/10-quality-requirements.md`

### Affected arc42 Sections

- `08-cross-cutting-concepts`
- `10-quality-requirements`

## Success Criteria

1. Alle fünf neuen Agent-Dateien und alle fünf neuen Spezial-Templates plus das neue PR-Review-Template existieren.
2. `proposal-review-orchestrator.agent.md` kennt die vier neuen Fachreviewer und deren Trigger.
3. Alle lokalen Grundlagen-Links in `.github/agents/*.agent.md` zeigen auf existierende Dateien.
4. `docs/development/review-agent-governance.md` dokumentiert Trigger-Matrix, Abgrenzungen und Standardabläufe.
5. `AGENTS.md` und `.github/copilot-instructions.md` referenzieren die erweiterte Review-Struktur.
6. `openspec validate add-review-agent-coverage --strict` und `pnpm check:file-placement` laufen erfolgreich.

## Non-Goals

- Keine Änderungen an Produktcode oder Feature-Logik
- Keine neuen CI-Workflows oder Build-Tools
- Keine rückwirkende Anpassung historischer Review-Dokumente unter `docs/pr/**` oder `openspec/changes/archive/**`
- Keine Einführung numerischer Performance-Budgets in v1
