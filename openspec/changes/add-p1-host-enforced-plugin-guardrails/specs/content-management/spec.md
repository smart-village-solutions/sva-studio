## ADDED Requirements

### Requirement: Host-Validated Plugin Content Contributions
The system SHALL accept plugin-provided content contributions only as declarative metadata and SHALL validate content type identifiers, fields, actions, and UI bindings before they become available in the Studio.

Plugin-provided content UI components MAY render host-provided data and trigger host-supported actions. Plugins SHALL NOT define direct persistence paths, server handlers, request validation bypasses, or dynamic content-type registration after the validated build-time snapshot is published.

#### Scenario: Valid content contribution is registered
- **GIVEN** a plugin declares a namespaced content type with host-supported bindings
- **WHEN** the host validates the plugin registry snapshot
- **THEN** the content contribution becomes available through host-owned content routes and actions

#### Scenario: Content contribution uses unsupported runtime behavior
- **GIVEN** a plugin declares content behavior that requires direct persistence, routing, or authorization control
- **WHEN** the host validates the contribution
- **THEN** the host rejects the contribution with a deterministic diagnostics result
- **AND** the diagnostics include one of `plugin_guardrail_persistence_bypass`, `plugin_guardrail_route_bypass`, `plugin_guardrail_authorization_bypass`, or `plugin_guardrail_unsupported_binding`

#### Scenario: Content UI triggers host-owned action
- **GIVEN** a plugin content UI renders a publish button bound to a declared host-supported action
- **WHEN** a user triggers the action
- **THEN** the host performs validation, authorization, persistence, and audit emission
- **AND** the plugin does not bypass the host content action path

#### Scenario: Plugin attempts dynamic content registration
- **GIVEN** a plugin tries to register a content type after the build-time registry snapshot was published
- **WHEN** the host receives the dynamic registration attempt
- **THEN** the host rejects the registration
- **AND** the diagnostics include `plugin_guardrail_dynamic_registration` with plugin namespace and contribution identifier
