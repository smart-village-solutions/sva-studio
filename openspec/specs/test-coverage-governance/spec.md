# test-coverage-governance Specification

## Purpose
TBD - created by archiving change add-test-coverage-governance. Update Purpose after archive.
## Requirements
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

### Requirement: Coverage-Gates pro Paket und Global
Das System SHALL Coverage-Gates sowohl auf Paketebene als auch auf globaler Ebene erzwingen.

#### Scenario: Paket-Gate verletzt
- **WHEN** ein betroffenes Paket unter den definierten Floor fällt
- **THEN** schlägt der CI-Check fehl
- **AND** der Fehler benennt Paket, Metrik und Ist/Soll-Wert

#### Scenario: Globales Gate verletzt
- **WHEN** die globale Coverage unter den definierten Floor fällt
- **THEN** schlägt der CI-Check fehl
- **AND** die globale Abweichung wird im Report ausgewiesen

### Requirement: Stufenweiser Rollout mit Baseline
Das System SHALL Coverage-Floors stufenweise einführen und an einer dokumentierten Baseline ausrichten.

#### Scenario: Baseline als Ausgangspunkt
- **WHEN** Coverage-Governance initial aktiviert wird
- **THEN** existiert eine Baseline pro Paket und Metrik
- **AND** Gate-Entscheidungen beziehen sich auf Baseline und aktuelle Floors

#### Scenario: Ratcheting
- **WHEN** ein Paket stabil über dem aktuellen Floor liegt
- **THEN** dürfen Floors für dieses Paket schrittweise angehoben werden
- **AND** Floors werden niemals automatisch abgesenkt

### Requirement: Trennung von Unit- und Integrationstests
Das System SHALL infra-abhängige Integrationstests getrennt von Unit-Coverage-Gates ausführen.

#### Scenario: PR-Workflow
- **WHEN** ein Pull Request validiert wird
- **THEN** blockieren Unit-Coverage-Gates den PR
- **AND** Integrationstests können in PR optional separat laufen

#### Scenario: Nightly/Main Workflow
- **WHEN** Nightly oder Main-Pipeline ausgeführt wird
- **THEN** werden Integrationstests verpflichtend ausgeführt
- **AND** deren Ergebnis wird separat ausgewiesen

### Requirement: PR-Transparenz
Das System SHALL Coverage-Ergebnisse in Pull Requests als strukturierte Summary und Artefakte bereitstellen.

#### Scenario: PR Summary
- **WHEN** ein Coverage-Check in CI durchläuft
- **THEN** enthält die PR Summary Coverage pro betroffenem Paket und global
- **AND** enthält Delta zur Baseline

#### Scenario: Artefakt-Verfügbarkeit
- **WHEN** ein Coverage-Check abgeschlossen ist
- **THEN** sind Coverage-Artefakte für Reviewer downloadbar

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

