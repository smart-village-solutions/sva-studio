# iam-access-control Specification

## Purpose
Diese Spezifikation beschreibt die technischen und fachlichen Anforderungen an das IAM-Access-Control-Modul. Sie legt fest, wie nach erfolgreicher OIDC-Authentifizierung ein verlässlicher Identity-Kontext bereitgestellt wird, wie RBAC-Basisdaten instanzgebunden persistiert werden und wie die Abgrenzung zu nachgelagerten Autorisierungsentscheidungen in Child C/D erfolgt.
## Requirements
### Requirement: Authentifizierter Identity-Kontext als Vorbedingung

Das System MUST nach erfolgreicher OIDC-Authentifizierung einen verlässlichen Identity-Kontext bereitstellen, der in nachgelagerten Child-Changes für RBAC/ABAC verwendet werden kann.

#### Scenario: Identity-Kontext nach Login verfügbar

- **WHEN** ein Benutzer sich erfolgreich über Keycloak anmeldet
- **THEN** stehen mindestens `sub` (Identity-ID) und `instanceId` im Server-Kontext bereit
- **AND** dieser Kontext kann von nachgelagerten Autorisierungspfaden konsumiert werden

### Requirement: Keine fachliche Autorisierungsentscheidung in Child A

Das System MUST in Child A keine fachlichen RBAC-/ABAC-Entscheidungen implementieren; diese werden in Child C/D spezifiziert.

#### Scenario: Autorisierung außerhalb Child-A-Scope

- **WHEN** ein Fachmodul eine fachliche Berechtigungsentscheidung benötigt
- **THEN** ist Child A nicht die entscheidende Instanz
- **AND** die verbindliche Entscheidung erfolgt erst über die in Child C/D definierten Authorize-Pfade

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
