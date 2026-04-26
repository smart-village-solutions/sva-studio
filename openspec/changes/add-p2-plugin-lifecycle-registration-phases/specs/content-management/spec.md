## ADDED Requirements

### Requirement: Content Contributions Register Before UI Materialization
The system SHALL register and validate plugin-provided content types before admin resources, routes, and UI bindings that depend on those content types are materialized.

#### Scenario: Admin resource references registered content type
- **GIVEN** a plugin declares a content type and a dependent admin resource
- **WHEN** the host creates the registry snapshot
- **THEN** content validation completes before the admin resource is accepted

#### Scenario: Admin resource references unknown content type
- **GIVEN** a plugin declares an admin resource for an unknown content type
- **WHEN** the host validates plugin phases
- **THEN** validation fails before route materialization

