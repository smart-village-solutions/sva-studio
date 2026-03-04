# IAM Access Control Specification Delta (Core Data Layer)

## ADDED Requirements

### Requirement: Persistente RBAC-Basisdaten

Das System SHALL die für Autorisierung erforderlichen RBAC-Basisdaten (`roles`, `permissions`, Zuordnungen) konsistent und instanzgebunden persistieren.

#### Scenario: Rollenauflösung im Instanzkontext

- **WHEN** Rollen- und Permission-Zuordnungen für einen Benutzer abgefragt werden
- **THEN** werden ausschließlich Zuordnungen der aktiven `instanceId` berücksichtigt
- **AND** organisationsfremde Zuordnungen bleiben wirkungslos

### Requirement: Idempotente Initialisierung von Basisrollen

Das System SHALL Basisrollen und Permission-Zuordnungen idempotent initialisieren, damit wiederholte Deployments keine Dubletten erzeugen.

#### Scenario: Wiederholte Seed-Ausführung für Rollen

- **WHEN** Seed-Skripte mehrfach ausgeführt werden
- **THEN** existiert jede Basisrolle nur einmal
- **AND** Rollen-Permission-Beziehungen bleiben konsistent

## MODIFIED Requirements

(None)

## REMOVED Requirements

(None)
