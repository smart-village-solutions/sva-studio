# architecture-documentation Specification

## Purpose
TBD - created by archiving change add-arc42-architecture-documentation. Update Purpose after archive.
## Requirements
### Requirement: Einheitliche Architekturstruktur nach arc42

Das System SHALL Architekturdokumentation in einer konsistenten, arc42-konformen Struktur führen.

#### Scenario: Architektur-Einstiegspunkt vorhanden

- **WHEN** ein Teammitglied die Architektur dokumentieren oder lesen möchte
- **THEN** existiert ein klarer Einstiegspunkt unter `docs/architecture/`
- **AND** die Inhalte sind nach arc42-Abschnitten gegliedert

### Requirement: Nachvollziehbare Architekturentscheidungen

Das System SHALL Architekturentscheidungen mit Kontext, Begründung und Auswirkungen dokumentieren.

#### Scenario: Änderung mit Architekturbezug

- **WHEN** ein OpenSpec-Change mit Architekturwirkung erstellt wird
- **THEN** referenziert der Change die betroffenen arc42-Abschnitte
- **AND** die Entscheidung ist für Reviewer nachvollziehbar dokumentiert

#### Scenario: Instanz-Scope-Dokumentation aktualisiert

- **WHEN** sich das kanonische Format von `instanceId` ändert
- **THEN** beschreiben die relevanten arc42-Abschnitte `instanceId` als fachlichen String-Schlüssel
- **AND** veraltete UUID-spezifische Aussagen zum Instanzformat werden entfernt oder korrigiert

### Requirement: Verbindliche Pflege im Entwicklungsworkflow

Das System SHALL die Pflege der Architektur-Dokumentation als Teil des Delivery-Workflows verankern.

#### Scenario: PR mit Architekturänderung

- **WHEN** ein PR Architektur oder Systemgrenzen verändert
- **THEN** enthält der PR eine Aktualisierung der relevanten arc42-Abschnitte
- **AND** die Review-Checkliste prüft diese Aktualisierung

### Requirement: Verankerung der arc42-Struktur in Agent- und Skill-Anweisungen

Das System SHALL die Vorgabe „Architektur-/Systemdoku erfolgt arc42-konform“ in den relevanten Agent- und Skill-Anweisungen verankern, sodass die Doku laufend konsistent und gut strukturiert erweitert wird.

#### Scenario: Agent schlägt Doku-Änderung vor

- **WHEN** ein Agent (oder Skill) eine Änderung mit Architektur-/Systembezug bewertet oder vorschlägt
- **THEN** referenziert er die betroffenen arc42-Abschnitte unter `docs/architecture/`
- **AND** fordert er die Aktualisierung dieser Abschnitte ein (oder dokumentiert bewusst begründete Abweichungen)
