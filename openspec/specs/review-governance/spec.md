# review-governance Specification

## Purpose
TBD - created by archiving change add-review-agent-coverage. Update Purpose after archive.
## Requirements
### Requirement: Spezialisierte Review-Agents für zusätzliche Qualitätsdimensionen
Das Repository SHALL spezialisierte Review-Agents für Testqualität, i18n/Content, User Journey/Usability und Performance bereitstellen.

#### Scenario: Testqualität als eigener Review-Strang
- **GIVEN** ein PR oder Proposal ändert Verhalten, Tests oder Coverage-relevante Artefakte
- **WHEN** der passende Review-Workflow gestartet wird
- **THEN** kann ein dedizierter `Test Quality`-Reviewer aufgerufen werden
- **AND** das Review benennt Testlücken, Coverage-Risiken und geeignete Nx-Targets

#### Scenario: i18n und Content als eigener Review-Strang
- **GIVEN** ein PR oder Proposal ändert user-facing Texte, Labels, Übersetzungen oder Key-Strukturen
- **WHEN** der passende Review-Workflow gestartet wird
- **THEN** kann ein dedizierter `i18n & Content`-Reviewer aufgerufen werden
- **AND** das Review benennt harte Strings, Key-Probleme und fehlende de/en-Abdeckung

#### Scenario: Nutzersicht als eigener Review-Strang
- **GIVEN** ein PR oder Proposal ändert Nutzerflüsse, Navigation, Formulare oder Zustandskommunikation
- **WHEN** der passende Review-Workflow gestartet wird
- **THEN** kann ein dedizierter `User Journey & Usability`-Reviewer aufgerufen werden
- **AND** das Review betrachtet Aufgabenbewältigung, Friktion und Verständlichkeit getrennt von Accessibility-Compliance

#### Scenario: Performance als eigener Review-Strang
- **GIVEN** ein PR oder Proposal ändert Query-, Rendering-, Cache- oder Hot-Path-Verhalten
- **WHEN** der passende Review-Workflow gestartet wird
- **THEN** kann ein dedizierter `Performance`-Reviewer aufgerufen werden
- **AND** das Review argumentiert evidenzbasiert statt geschmacksbasiert

### Requirement: Separater Orchestrator für PR-Reviews
Das Repository SHALL einen separaten Orchestrator für normale PR-/Code-Reviews bereitstellen.

#### Scenario: PR-Review mit konsolidiertem Report
- **GIVEN** ein Nutzer möchte eine normale PR oder einen Code-Änderungssatz prüfen lassen
- **WHEN** der `PR Review Orchestrator` aufgerufen wird
- **THEN** analysiert er geänderte Bereiche und relevante Qualitätsaspekte
- **AND** wählt passende Fachreviewer trigger-basiert aus
- **AND** liefert einen konsolidierten Review-Report

#### Scenario: Report-only in v1
- **WHEN** der `PR Review Orchestrator` ausgeführt wird
- **THEN** verändert er keine Code- oder PR-Dateien
- **AND** beschränkt sich auf Orchestrierung, Priorisierung und Konsolidierung

### Requirement: Trigger-basierte Auswahl für Proposal- und PR-Orchestrierung
Proposal- und PR-Orchestrierung SHALL Fachreviewer trigger-basiert auswählen.

#### Scenario: UI-Flow mit Textänderungen
- **GIVEN** ein Proposal oder PR ändert Formulare, CTAs und UI-Texte
- **WHEN** die Orchestrierung den Scope analysiert
- **THEN** werden mindestens `Documentation`, `UX & Accessibility`, `i18n & Content` und `User Journey & Usability` berücksichtigt

#### Scenario: API- und Vertragsänderung
- **GIVEN** ein Proposal oder PR ändert API-Contracts, Datenformate oder Migrationsverhalten
- **WHEN** die Orchestrierung den Scope analysiert
- **THEN** werden mindestens `Documentation` und `Interoperability & Data` berücksichtigt
- **AND** bei Verhaltensänderungen zusätzlich `Test Quality`

#### Scenario: Sicherheits- und Hot-Path-Änderung
- **GIVEN** ein Proposal oder PR ändert Auth, Tokens, Sessions, Audit-Logging oder Performance-kritische Pfade
- **WHEN** die Orchestrierung den Scope analysiert
- **THEN** werden passend `Security & Privacy`, `Logging`, `Performance` und `Test Quality` berücksichtigt

### Requirement: Agent-Grundlagen müssen auf existierende Quellen zeigen
Agent-Anweisungen SHALL ausschließlich auf existierende Repo-Dateien oder ausdrücklich benannte externe Standards verweisen.

#### Scenario: Lokale Grundlagenreferenzen sind gültig
- **GIVEN** ein Agent listet lokale Grundlagen unter `### Grundlage`
- **WHEN** ein Reviewer diese Referenzen nutzt
- **THEN** zeigen alle lokalen Pfade auf im Repository vorhandene Dateien
- **AND** es gibt keine toten Referenzen auf nicht existente `specs/*.md`

### Requirement: Standardisierte Review-Templates pro Reviewer
Jeder Reviewer SHALL ein standardisiertes Output-Template unter `.github/agents/templates/` verwenden.

#### Scenario: Neuer Reviewer hat eigenes Template
- **GIVEN** ein neuer Review-Agent wird eingeführt
- **WHEN** er Findings liefert
- **THEN** nutzt er ein dediziertes Template unter `.github/agents/templates/`
- **AND** das Template definiert Entscheidung, Zusammenfassung, Findings und nächste Schritte

#### Scenario: Orchestratoren nutzen konsolidierte Templates
- **GIVEN** ein Orchestrator konsolidiert Ergebnisse mehrerer Fachreviewer
- **WHEN** er den Abschlussbericht erzeugt
- **THEN** verwendet er ein separates konsolidiertes Report-Template
- **AND** der Bericht enthält Reviewer-Auswahl, priorisierte Findings, Konflikte und offene Fragen

