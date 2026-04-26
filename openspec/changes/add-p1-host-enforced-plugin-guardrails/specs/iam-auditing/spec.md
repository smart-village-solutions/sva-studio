## ADDED Requirements

### Requirement: Host-Owned Plugin Audit Emission
The system SHALL emit audit events for plugin-provided actions through host-owned audit pipelines using validated plugin event identifiers and sanitized payloads.

#### Scenario: Plugin action is audited
- **GIVEN** a plugin action is executed through a host route
- **WHEN** the action completes or fails
- **THEN** the host emits an audit event with the validated event type, actor, scope, and sanitized metadata

#### Scenario: Plugin attempts direct audit emission
- **GIVEN** a plugin tries to bypass the host audit pipeline
- **WHEN** the contribution is validated
- **THEN** the host rejects or ignores the direct emission path

