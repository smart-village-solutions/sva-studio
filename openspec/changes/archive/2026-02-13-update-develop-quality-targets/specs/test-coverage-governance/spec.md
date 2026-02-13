## MODIFIED Requirements

### Requirement: Einheitliche Coverage-Messung
Das System SHALL für alle coverage-relevanten Projekte ausführbare Unit-Test-Targets bereitstellen, sodass Coverage-Messung auf realen Testläufen basiert.

#### Scenario: Coverage-relevantes Projekt ist testbar
- **WHEN** ein Projekt als coverage-relevant geführt wird
- **THEN** führt `test:unit` einen echten Test-Runner aus
- **AND** das Projekt verwendet kein No-Op-/Platzhalter-Kommando

#### Scenario: Monitoring-Komponente im Qualitätspfad
- **WHEN** `@sva/monitoring-client` im Workspace validiert wird
- **THEN** kann `test:unit` reale Unit-Tests ausführen
- **AND** Testfehler blockieren den Qualitätslauf

## ADDED Requirements

### Requirement: Transparente Exemption-Dokumentation
Das System SHALL Coverage-Exemptions zentral dokumentieren, inklusive Begründung und Review-Bezug, damit Reviewer die Ausnahme nachvollziehen können.

#### Scenario: Reviewer prüft Exemption
- **WHEN** ein Projekt von Coverage-Gates ausgenommen ist
- **THEN** ist die Ausnahme in der Testing-Dokumentation mit Begründung aufgeführt
- **AND** die Doku benennt mindestens betroffene Projekte und Geltungsrahmen

#### Scenario: PR-Vorbereitung mit Exemptions
- **WHEN** ein Beitrag ein exemptes Projekt verändert
- **THEN** kann der Autor im PR-Check nachvollziehen, welche alternativen Nachweise erwartet sind
- **AND** Reviewer finden diese Hinweise ohne branchspezifisches Vorwissen
