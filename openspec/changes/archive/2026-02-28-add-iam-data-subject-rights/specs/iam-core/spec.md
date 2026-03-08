# IAM Core Specification Delta (Data Subject Rights)

## ADDED Requirements

### Requirement: Self-Service für Betroffenenanfragen

Das System SHALL authentifizierten Benutzern einen Self-Service-Zugang für Betroffenenanfragen im eigenen Identitätskontext bereitstellen.

#### Scenario: Benutzer stellt eigene DSGVO-Anfrage

- **WHEN** ein authentifizierter Benutzer eine Anfrage zu Auskunft, Berichtigung oder Löschung erstellt
- **THEN** wird die Anfrage eindeutig seiner Identität zugeordnet
- **AND** der Status ist für den Benutzer nachvollziehbar einsehbar

### Requirement: Instanzgebundene Verarbeitung von Betroffenenrechten

Das System SHALL Betroffenenanfragen strikt im aktiven `instanceId`-Kontext verarbeiten.

#### Scenario: Anfrage über Instanzgrenze

- **WHEN** eine Anfrage auf Daten außerhalb der aktiven Instanz zielt
- **THEN** wird die Verarbeitung abgelehnt
- **AND** ein entsprechender Denial-Eintrag wird erzeugt

## MODIFIED Requirements

(None)

## REMOVED Requirements

(None)
