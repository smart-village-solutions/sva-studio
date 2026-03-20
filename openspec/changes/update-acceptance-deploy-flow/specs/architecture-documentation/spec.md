## MODIFIED Requirements

### Requirement: Verbindliche Pflege im Entwicklungsworkflow

Das System SHALL die Pflege der Architektur-Dokumentation als Teil des Delivery-Workflows verankern.

#### Scenario: PR mit Architekturänderung

- **WHEN** ein PR Architektur oder Systemgrenzen verändert
- **THEN** enthält der PR eine Aktualisierung der relevanten arc42-Abschnitte
- **AND** die Review-Checkliste prüft diese Aktualisierung

#### Scenario: Acceptance-Deployvertrag wird geändert

- **WHEN** sich der verbindliche Serverdeploypfad für `acceptance-hb` ändert
- **THEN** aktualisieren die arc42-Abschnitte `07-deployment-view` und `08-cross-cutting-concepts` den Releaseablauf, die Migrationsregeln und die Deploy-Evidenz
- **AND** das zugehörige Runbook beschreibt dieselbe Reihenfolge wie die implementierten Ops-Kommandos
