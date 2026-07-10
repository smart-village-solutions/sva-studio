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

### Requirement: Bot-Kommentare müssen vor Merge bearbeitet werden
Das Repository SHALL vor dem Merge fuer jeden relevanten PR-Kommentar von `Copilot` oder `chatgpt-codex-connector[bot]` einen nachvollziehbaren Bearbeitungsnachweis verlangen.

#### Scenario: Review-Thread wurde umgesetzt und abgeschlossen
- **GIVEN** ein Review-Thread auf einem Diff stammt von `Copilot` oder `chatgpt-codex-connector[bot]`
- **AND** ein Maintainer antwortet inhaltlich auf den Hinweis
- **AND** der Thread wird anschliessend als resolved markiert
- **WHEN** das PR-Gate den Status der Bot-Kommentare auswertet
- **THEN** gilt dieser Bot-Kommentar als bearbeitet

#### Scenario: Normaler PR-Kommentar wird bewusst nicht umgesetzt
- **GIVEN** ein normaler PR-Konversationskommentar stammt von `Copilot` oder `chatgpt-codex-connector[bot]`
- **AND** ein Maintainer antwortet mit einem standardisierten Bearbeitungsmarker
- **AND** die Antwort enthaelt eine kurze Begruendung, warum das Feedback bewusst nicht umgesetzt wird
- **WHEN** das PR-Gate den Status der Bot-Kommentare auswertet
- **THEN** gilt dieser Bot-Kommentar als bearbeitet

#### Scenario: Kommentar ohne Nachweis bleibt offen
- **GIVEN** ein relevanter Bot-Kommentar in einem Pull Request
- **AND** es gibt weder eine qualifizierte Antwort noch einen sonstigen gueltigen Bearbeitungsnachweis
- **WHEN** das PR-Gate den Status der Bot-Kommentare auswertet
- **THEN** gilt dieser Bot-Kommentar als unbearbeitet
- **AND** der Pull Request darf das Bot-Kommentar-Gate nicht bestehen

### Requirement: Bearbeitungsnachweise müssen standardisierte Abschlusszustände tragen
Das Repository SHALL fuer relevante Bot-Kommentare standardisierte Abschlusszustaende verwenden, damit akzeptierte, abgelehnte und anderweitig erledigte Entscheidungen maschinell und menschlich nachvollziehbar bleiben.

#### Scenario: Akzeptierter Kommentar ist maschinenlesbar markiert
- **GIVEN** ein relevanter Bot-Kommentar wurde umgesetzt
- **WHEN** ein Maintainer den Abschluss dokumentiert
- **THEN** verwendet die Antwort einen standardisierten Marker fuer einen akzeptierten Abschluss
- **AND** der Marker ist fuer die Gate-Auswertung maschinenlesbar

#### Scenario: Abgelehnter Kommentar ist maschinenlesbar markiert
- **GIVEN** ein relevanter Bot-Kommentar wird bewusst nicht umgesetzt
- **WHEN** ein Maintainer den Abschluss dokumentiert
- **THEN** verwendet die Antwort einen standardisierten Marker fuer einen abgelehnten Abschluss
- **AND** die Antwort enthaelt eine kurze fachliche oder technische Begruendung

### Requirement: Bot-Kommentar-Gate muss Review-Threads und normale PR-Kommentare getrennt auswerten
Das Repository SHALL relevante Bot-Review-Threads und relevante normale Bot-PR-Kommentare als getrennte Kommentararten auswerten und pro Art den passenden Abschlussnachweis verlangen.

#### Scenario: Review-Thread braucht Antwort und Resolve
- **GIVEN** ein relevanter Bot-Kommentar ist Teil eines Review-Threads auf einem Diff
- **WHEN** der Kommentar als bearbeitet gewertet werden soll
- **THEN** reicht eine blosse textuelle Antwort ohne Resolve nicht aus
- **AND** der Thread braucht zusaetzlich einen Abschluss im Thread-Zustand

#### Scenario: Normaler PR-Kommentar braucht Antwort statt Resolve
- **GIVEN** ein relevanter Bot-Kommentar ist ein normaler PR-Konversationskommentar
- **WHEN** der Kommentar als bearbeitet gewertet werden soll
- **THEN** darf das Gate keinen nativen Resolve-Zustand voraussetzen
- **AND** es verlangt stattdessen eine standardisierte menschliche Antwort als Nachweis

#### Scenario: Kommentare anderer Autoren blockieren dieses Gate nicht
- **GIVEN** ein Kommentar stammt nicht von `Copilot` und nicht von `chatgpt-codex-connector[bot]`
- **WHEN** das Bot-Kommentar-Gate den Pull Request auswertet
- **THEN** zaehlt dieser Kommentar nicht zum Pflichtumfang dieses Gates
