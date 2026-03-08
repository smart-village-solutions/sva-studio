## Context

Das Repository nutzt bereits spezialisierte Agents für Architektur, Security, Dokumentation, Operations, Interoperabilität, Logging und A11y. Diese Struktur ist fachlich sinnvoll, aber aktuell unvollständig:

- Normative Accessibility ist abgedeckt, eine echte Nutzersicht fehlt.
- Testqualität ist nur indirekt im allgemeinen Code-Quality-Agenten enthalten.
- i18n/harte Strings sind projektkritisch, aber kein eigener Review-Strang.
- Performance-Risiken werden nur beiläufig betrachtet.
- Proposal-Reviews besitzen einen Orchestrator, normale PR-Reviews jedoch nicht.

Zusätzlich referenzieren mehrere Agents lokale Grundlagen, die im Repository nicht vorhanden sind. Das verringert die Verlässlichkeit der Instructions und erschwert konsistente Reviews.

## Goals / Non-Goals

### Goals

- Vollständige Review-Abdeckung für Proposal- und PR-Workflows herstellen
- neue fachliche Reviewer mit klarer Abgrenzung einführen
- einen separaten PR-Orchestrator als report-only Einstiegspunkt etablieren
- lokale Agent-Grundlagen auf reale Repo-Dateien konsolidieren
- Governance in Dokumentation und arc42 sichtbar machen

### Non-Goals

- keine Produktfeature-Implementierung
- keine Workflow-Automation außerhalb der Agent-Anweisungen
- keine neue CI-Orchestrierung
- keine Änderung historischer Review-Artefakte

## Decisions

### Decision: PR-Orchestrator als report-only in v1

Der neue `pr-review-orchestrator.agent.md` konsolidiert Reviews, verändert aber keine Code-Dateien. Dadurch bleibt der Review-Prozess nachvollziehbar und menschliche Freigabe zentral.

### Decision: Vier neue Fachreviewer plus ein neuer Orchestrator

Es werden genau diese Rollen eingeführt:

- Test Quality
- i18n & Content
- User Journey & Usability
- Performance
- PR Review Orchestrator

Diese Auswahl schließt die identifizierten Lücken, ohne das System in zu viele Mikrorollen zu zerteilen.

### Decision: Proposal-Orchestrator wird erweitert, nicht ersetzt

Der bestehende `proposal-review-orchestrator.agent.md` bleibt der Einstiegspunkt für OpenSpec-Changes. Er erhält nur zusätzliche Trigger und Reviewer.

### Decision: Bestehende Agents werden auf reale Repo-Dokumente umgestellt

Statt fehlende `specs/*.md` künstlich nachzubauen, werden die Grundlagen der betroffenen Agents auf vorhandene Architektur-, Entwicklungs- und Guide-Dokumente umgestellt. Das hält die Maintenance-Kosten niedrig und beseitigt tote Referenzen.

### Decision: Governance-Doku als zentrales Entwicklerdokument

Die operative Erklärung der Review-Matrix liegt in `docs/development/review-agent-governance.md`. arc42 bekommt nur die übergeordneten Querschnitts- und Qualitätsaspekte.

## Alternatives Considered

### Alternative 1: Nur Code-Quality-Agent erweitern

**Verworfen**, weil Testqualität, i18n/Content, Usability und Performance dann weiterhin nur implizit und schwer triggerbar wären.

### Alternative 2: UX & Accessibility um Usersicht erweitern

**Verworfen**, weil normative A11y-Compliance und heuristische Nutzersicht unterschiedliche Aufgaben mit unterschiedlichen Bewertungskriterien sind.

### Alternative 3: PR-Orchestrierung über den Main-Agent ad hoc lösen

**Verworfen**, weil das kein expliziter, wiederverwendbarer Repo-Standard wäre und die Governance unsichtbar bliebe.

## Risks / Trade-offs

- Mehr Agents erhöhen initial die Komplexität der Review-Landschaft.
- Ohne klare Trigger drohen Doppelprüfungen; deshalb wird eine zentrale Governance-Matrix eingeführt.
- Performance-Reviews ohne Messbasis können beliebig werden; deshalb ist der Agent v1 explizit evidenzbasiert und budgetfrei.

## Migration Plan

1. OpenSpec-Change und Spec-Deltas anlegen
2. neue Templates anlegen
3. neue Agents anlegen
4. Proposal-Orchestrator erweitern
5. Bestands-Agents mit ungültigen Grundlagen reparieren
6. Governance-Doku und Instruktionsdateien aktualisieren
7. arc42-Abschnitte 08 und 10 ergänzen
8. Validierung via `openspec validate ... --strict` und `pnpm check:file-placement`

## Open Questions

- Keine offenen Architekturfragen mehr für v1.
