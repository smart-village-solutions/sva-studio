## ADDED Requirements

### Requirement: Host-Validated Plugin Content Contributions
The system SHALL accept plugin-provided content contributions only as declarative metadata and SHALL validate content type identifiers, fields, actions, and UI bindings before they become available in the Studio.

#### Scenario: Valid content contribution is registered
- **GIVEN** a plugin declares a namespaced content type with host-supported bindings
- **WHEN** the host validates the plugin registry snapshot
- **THEN** the content contribution becomes available through host-owned content routes and actions

#### Scenario: Content contribution uses unsupported runtime behavior
- **GIVEN** a plugin declares content behavior that requires direct persistence, routing, or authorization control
- **WHEN** the host validates the contribution
- **THEN** the host rejects the contribution with a deterministic diagnostics result

