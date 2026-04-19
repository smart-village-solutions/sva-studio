## ADDED Requirements

### Requirement: Runtime-IAM und Provisioning verwenden kompatible Driftklassifikation

Das System SHALL Runtime-IAM-Fehler und Instanz-/Keycloak-Provisioning-Drift auf denselben kompatiblen Driftklassifikationen aufbauen, damit UI und Betrieb dieselbe Ursache entlang von Runtime, Preflight, Plan und Run nachvollziehen können.

#### Scenario: Runtime-Fehler und Instanzpanel sprechen dieselbe Drift-Sprache

- **WHEN** ein Tenant sowohl im Runtime-IAM-Fehlerfall als auch im Instanzpanel betrachtet wird
- **THEN** verwenden beide Pfade kompatible Klassifikationen für Realm-, Client-, Secret-, Mapper- und Tenant-Admin-Drift
- **AND** kann das Instanzpanel aus einem Runtime-Fehler heraus mit konsistentem Diagnosewortschatz fortgesetzt werden
