## ADDED Requirements

### Requirement: Host-Owned Plugin Audit Emission
The system SHALL emit audit events for plugin-provided actions through host-owned audit pipelines using validated plugin event identifiers and sanitized payloads.

Plugins MAY declare audit event types and metadata schemas. Plugins SHALL NOT write audit records directly or emit security-relevant audit events through plugin-owned pipelines.

#### Scenario: Plugin action is audited
- **GIVEN** a plugin action is executed through a host route
- **WHEN** the action completes or fails
- **THEN** the host emits an audit event with the validated event type, actor, scope, and sanitized metadata

#### Scenario: Plugin attempts direct audit emission
- **GIVEN** a plugin tries to bypass the host audit pipeline
- **WHEN** the contribution is validated
- **THEN** the host rejects the direct emission path before the contribution becomes available
- **AND** the diagnostics include `plugin_guardrail_audit_bypass` with plugin namespace and contribution identifier

#### Scenario: Plugin declares audit metadata only
- **GIVEN** a plugin declares a namespaced audit event type and metadata schema
- **WHEN** the host validates the registry snapshot
- **THEN** the declaration is accepted
- **AND** runtime emission remains host-owned
