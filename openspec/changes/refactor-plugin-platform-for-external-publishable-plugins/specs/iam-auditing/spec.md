## MODIFIED Requirements

### Requirement: Host-Owned Plugin Audit Emission

The system SHALL emit audit events for plugin-provided actions through host-owned audit pipelines using validated plugin event identifiers and sanitized payloads.

Plugins MAY declare audit event types and metadata schemas. Plugins SHALL NOT write audit records directly or emit security-relevant audit events through plugin-owned pipelines.

This requirement applies to plugin UI actions, host-materialized routes, plugin-backed server handlers, job executions, imports, migrations, and integration operations.

#### Scenario: Plugin job execution is audited by host
- **GIVEN** a plugin job handler is started through a host-managed operation
- **WHEN** the job starts, succeeds, fails, or is denied
- **THEN** the host emits the corresponding audit event with validated event identifiers, actor, scope, and sanitized metadata
- **AND** the plugin handler does not write the audit record directly

#### Scenario: Plugin request handler is audited by host
- **GIVEN** a plugin server-side request handler is executed through a host entry-point
- **WHEN** the request completes or fails
- **THEN** the host-owned audit pipeline emits the audit event
- **AND** the plugin contributes only validated metadata or event identifiers defined in the plugin contract

#### Scenario: Plugin attempts direct audit emission
- **GIVEN** a plugin tries to bypass the host audit pipeline
- **WHEN** the contribution is validated
- **THEN** the host rejects the direct emission path before the contribution becomes available
- **AND** the diagnostics include `plugin_guardrail_audit_bypass` with plugin namespace and contribution identifier
