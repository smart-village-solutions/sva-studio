## ADDED Requirements

### Requirement: Content Capability Mapping
The system SHALL map domain-level content capabilities such as publish, archive, restore, bulk edit, and manage revisions to stable primitive Studio actions before authorization is evaluated.

The mapping SHALL be host-owned, declarative, and framework-agnostic. Plugins, content types, and UI bindings MAY reference supported capabilities, but SHALL NOT provide executable authorization logic, permission resolvers, or fallback allow/deny decisions.

#### Scenario: Domain capability maps to primitive action
- **GIVEN** a user requests a content publish operation
- **WHEN** the host evaluates authorization
- **THEN** the publish capability is resolved to the configured primitive Studio action and checked through the central permission engine
- **AND** the authorization request uses the resolved primitive action, resource type, actor, and active scope

#### Scenario: Capability has no mapping
- **GIVEN** a content action has no registered capability mapping
- **WHEN** the host evaluates authorization
- **THEN** access is denied with the deterministic diagnostic `capability_mapping_missing`
- **AND** no persistence, status transition, or side effect is executed

#### Scenario: Capability maps to invalid primitive action
- **GIVEN** a capability mapping references an unknown or non-fully-qualified primitive action
- **WHEN** the host validates the mapping or evaluates an action using it
- **THEN** access is denied with the deterministic diagnostic `capability_mapping_invalid`
- **AND** the host does not infer a namespace or substitute another primitive action

#### Scenario: Server remains authoritative
- **GIVEN** the UI rendered a content action as available from the mapping read model
- **WHEN** the user executes the action
- **THEN** the server resolves the capability again and evaluates the primitive action through the central permission engine
- **AND** a stale or manipulated UI state cannot bypass authorization

#### Scenario: Admin action remains out of scope
- **GIVEN** an admin action uses an existing direct primitive Studio action
- **WHEN** the host evaluates authorization for this P2 change
- **THEN** the admin action continues to use the existing authorization contract
- **AND** no admin-specific capability mapping is required by this change

## MODIFIED Requirements

### Requirement: Rollenbasierte Autorisierung für Inhaltsverwaltung

Das System SHALL die Inhaltsverwaltung über die zentrale IAM-Autorisierung absichern.

#### Scenario: Zugriff auf Inhaltsliste ohne Leserecht

- **WHEN** ein Benutzer die Seite `Inhalte` oder eine Inhaltsdetailseite aufruft
- **AND** ihm im aktiven Kontext die Berechtigung `content.read` fehlt
- **THEN** verweigert das System den Zugriff
- **AND** es werden keine Inhaltsdaten offengelegt

#### Scenario: Read-only-Zugriff auf Inhalte

- **WHEN** ein Benutzer `content.read`, aber keine schreibenden Inhaltsrechte besitzt
- **THEN** kann er Liste, Detailansicht und freigegebene Historie lesen
- **AND** Erstellungs-, Bearbeitungs- und Statuswechselaktionen bleiben gesperrt

#### Scenario: Statuswechsel erfordert gemappte Fachberechtigung

- **WHEN** ein Benutzer den Status eines Inhalts ändern will
- **THEN** löst das System die fachliche Statuswechsel-Capability auf eine primitive Studio-Action wie `content.submit_review`, `content.approve`, `content.publish` oder `content.archive` auf
- **AND** die zentrale Permission Engine prüft ausschließlich die aufgelöste primitive Action im aktiven Scope
- **AND** ein unzulässiger oder nicht gemappter Statuswechsel wird serverseitig abgewiesen

#### Scenario: Inhaltsrechte werden im aktiven Scope ausgewertet

- **WHEN** eine Berechtigungsprüfung für Inhaltsverwaltung erfolgt
- **THEN** wertet das System die Rechte im aktiven `instanceId`- und Organisationskontext aus
