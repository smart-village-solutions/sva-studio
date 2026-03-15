# Review-Agent-Governance

## Ziel

Dieses Dokument beschreibt die Review-Governance für Proposal- und PR-Reviews mit spezialisierten Agents.

## Agenten-Inventar

| Agent | Zweck | Primärer Einsatz |
|------|-------|------------------|
| `proposal-review-orchestrator.agent.md` | konsolidiert Proposal-Reviews | OpenSpec-Changes |
| `pr-review-orchestrator.agent.md` | konsolidiert PR-/Code-Reviews | normale PRs und Diffs |
| `architecture.agent.md` | Zielarchitektur, ADR-Bedarf, arc42-Fit | Architektur- und Systemänderungen |
| `code-quality-guardian.agent.md` | Korrektheit, Typen, Architekturgrenzen | Codeänderungen |
| `documentation.agent.md` | Doku-Abdeckung, Konsistenz, arc42 | jede PR / jedes Proposal |
| `test-quality.agent.md` | Tests, Coverage, Verifikationsstrategie | Verhaltensänderungen, Test-/Coverage-Themen |
| `security-privacy.agent.md` | Security, Privacy, Secrets, PII | Auth, Rollen, Tokens, Daten |
| `ux-accessibility.agent.md` | WCAG/BITV, Tastatur, Screenreader | UI und Navigation |
| `i18n-content.agent.md` | harte Strings, Key-Konventionen, Textklarheit | user-facing Texte |
| `user-journey-usability.agent.md` | Nutzersicht, Friktion, Flow-Verständlichkeit | UI-Flows, Formschritte |
| `operations-reliability.agent.md` | Betrieb, Runbooks, Monitoring | Infra, Deployments, Workflows |
| `interoperability-data.agent.md` | APIs, Standards, Datenmigration | Contracts, Exporte, Versionierung |
| `logging.agent.md` | strukturierte Logs, Audit, Korrelationsfelder | Server-Code, Fehlerpfade |
| `performance.agent.md` | Rendering, Caching, Hot Paths | Performance-sensitive Änderungen |

## Trigger-Matrix

### Proposal-Reviews

- Immer: `Documentation`
- Neue Architektur / Packages / strukturelle Entscheidungen: `Architecture`
- IAM, Rollen-Sync, ABAC/RBAC, Data-Subject-Rights oder andere sicherheitskritische Domänenlogik: `Architecture` + `Documentation` + `Security & Privacy`
- Auth, Sessions, Tokens, PII: `Security & Privacy`
- UI, Formulare, Navigation: `UX & Accessibility`
- Texte, Übersetzungen, Labels: `i18n & Content`
- UI-Flows, Erstnutzung, Fehlerzustände: `User Journey & Usability`
- neue Logik, Verhalten, Tests, Coverage-Auswirkungen: `Test Quality`
- Infra, Migrationen, Runbooks, Monitoring: `Operations`
- APIs, Datenformate, Standards: `Interoperability`
- Server-Code, Audit, Fehlerbehandlung: `Logging`
- Caching, Rendering, große Listen, Benchmarks, Hot Paths: `Performance`

### PR-Reviews

- Immer: `Documentation`
- Jede Codeänderung: `Code Quality`
- Verhaltensänderungen oder Coverage-/Test-Themen: `Test Quality`
- Wiederholte rote Test-/Coverage-Checks im PR-Verlauf: `Test Quality` mit expliziter Shift-left-Prozessbewertung
- IAM, Rollen-Sync, ABAC/RBAC, Data-Subject-Rights oder andere architekturrelevante Security-/Domain-Änderungen: zusätzlich `Architecture` und `Security & Privacy`
- weitere Fachreviewer trigger-basiert analog zu Proposal-Reviews

## Abgrenzungen

### UX & Accessibility vs User Journey & Usability

- `UX & Accessibility` bewertet normative Bedienbarkeit, Fokus, Tastatur, Semantik und WCAG/BITV.
- `User Journey & Usability` bewertet Aufgabenbewältigung, mentale Modelle, Reibung und Verständlichkeit.

### i18n & Content vs UX & Accessibility

- `i18n & Content` bewertet harte Strings, Key-Struktur, de/en-Abdeckung und Textklarheit.
- `UX & Accessibility` bewertet keine Übersetzungsvollständigkeit, sondern Bedienbarkeit und Normkonformität.

### Test Quality vs Code Quality

- `Code Quality` bewertet Korrektheit, Typen und Architektur.
- `Test Quality` bewertet ausschließlich die Verifikationsstrategie und die Aussagekraft der Tests.

### Performance vs Code Quality

- `Performance` bewertet messbare oder technisch klar herleitbare Laufzeit-/Render-/Cache-Risiken.
- `Code Quality` bleibt für allgemeine Robustheit und Architektur zuständig.

## Standard-Reihenfolge

1. Scope erfassen
2. Orchestrator auswählen
3. Pflichtreviewer aufrufen
4. zusätzliche Fachreviewer trigger-basiert ergänzen
5. Ergebnisse konsolidieren
6. Konflikte und offene Fragen explizit benennen

## Konfliktauflösung

- Fachreviewer liefern ihre Perspektive getrennt.
- Orchestratoren dürfen Konflikte zusammenführen und Entscheidungsoptionen formulieren.
- Die finale Entscheidung bleibt beim Menschen.

## Templates

- Fachreviewer nutzen dedizierte Templates unter `.github/agents/templates/`.
- Orchestratoren nutzen konsolidierte Report-Templates.

## Referenzen

- `AGENTS.md`
- `.github/agents/`
- `docs/architecture/README.md`
