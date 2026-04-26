## ADDED Requirements

### Requirement: Audit Contributions Register Before Route Publication
The system SHALL validate existing plugin-provided audit event declarations in an explicit audit phase before the registry snapshot is published.

Plugins MAY declare audit event metadata. Runtime audit emission SHALL remain host-owned. This change SHALL NOT introduce a new action-to-audit-event reference field.

#### Scenario: Audit event declaration is normalized
- **GIVEN** a plugin declares a namespaced audit event
- **WHEN** the build-time registry snapshot is created
- **THEN** the audit phase normalizes and publishes the event in the plugin audit event registry

#### Scenario: Invalid audit event stops snapshot publication
- **GIVEN** a plugin declares an invalid audit event
- **WHEN** the audit phase validates plugin contributions
- **THEN** validation fails before snapshot publication

#### Scenario: Plugin attempts direct audit emission
- **GIVEN** a plugin declares executable audit emission logic instead of audit metadata
- **WHEN** the audit phase validates the contribution
- **THEN** validation fails with `plugin_guardrail_audit_bypass`
