## MODIFIED Requirements

### Requirement: Platform and Tenant Admin Permissions

The system SHALL authorize Studio-based Keycloak administration separately for platform and tenant scopes and SHALL never use broader credentials as an implicit fallback for a narrower tenant operation.

#### Scenario: Platform admin edits platform identities
- **WHEN** ein Platform-Admin einen Platform-User oder eine Platform-Rolle im Root-Host bearbeitet
- **THEN** prüft das System Platform-Admin-Rechte
- **AND** verwendet ausschließlich den Platform-Admin-Keycloak-Client
- **AND** schreibt ein Audit-Event mit Actor, Scope, Zielobjekt und Ergebnis

#### Scenario: Tenant admin edits tenant identities
- **WHEN** ein Tenant-Admin User, Rollen oder Rollenzuordnungen auf einem Tenant-Host bearbeitet
- **THEN** prüft das System Tenant-Admin-Rechte für die aktive `instanceId`
- **AND** verwendet ausschließlich den Tenant-Admin-Keycloak-Client
- **AND** blockiert Cross-Tenant-Zugriffe

#### Scenario: Tenant Keycloak rights are insufficient
- **WHEN** Keycloak eine Tenant-Operation mit `IDP_FORBIDDEN` verweigert
- **THEN** gibt das System einen stabilen Diagnosecode zurück
- **AND** erklärt, welche Keycloak-Rechte oder Realm-/Client-Konfiguration fehlen
- **AND** wiederholt die Operation nicht mit Platform- oder globalen Admin-Rechten

## ADDED Requirements

### Requirement: Bearbeitbarkeitsmatrix für Keycloak-Objekte

Das System SHALL für Keycloak-User, Rollen und Rollenzuordnungen vor jeder Mutation eine Bearbeitbarkeitsentscheidung berechnen.

#### Scenario: Read-only object is visible but protected
- **WHEN** ein Keycloak-Objekt sichtbar, aber nicht Studio-bearbeitbar ist
- **THEN** zeigt die UI das Objekt mit `read_only`-Status
- **AND** Server-Mutationen werden mit einem stabilen Diagnosecode blockiert

#### Scenario: Federated user field is protected
- **WHEN** ein User-Feld durch Föderation oder Keycloak-Policy nicht bearbeitbar ist
- **THEN** deaktiviert die UI das Feld
- **AND** der Server validiert denselben Zustand vor der Mutation
