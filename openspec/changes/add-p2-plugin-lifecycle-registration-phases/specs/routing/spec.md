## ADDED Requirements

### Requirement: Routing Materializes After Plugin Contribution Phases
The system SHALL materialize host routes only after content, admin-resource, and guard metadata from plugin phases have been validated.

#### Scenario: Route depends on admin resource metadata
- **GIVEN** a plugin declares an admin resource in the admin phase
- **WHEN** route materialization starts
- **THEN** the route builder uses the validated admin metadata and guard information

#### Scenario: Route references missing phased metadata
- **GIVEN** a plugin route references admin metadata that was not registered in an earlier phase
- **WHEN** the route registry is validated
- **THEN** the host rejects the route contribution

