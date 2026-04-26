## ADDED Requirements

### Requirement: Routing Materializes After Plugin Contribution Phases
The system SHALL materialize host routes only after existing content, admin-resource, action, and guard metadata from plugin phases have been validated and published in the registry snapshot.

#### Scenario: Route depends on admin resource metadata
- **GIVEN** a plugin declares an admin resource in the admin phase
- **WHEN** route materialization starts
- **THEN** the route builder uses the validated admin metadata, action metadata, and guard information

#### Scenario: Route references missing action metadata
- **GIVEN** a plugin route references action metadata that was not registered in an earlier phase
- **WHEN** the route registry is validated
- **THEN** the host rejects the route contribution

#### Scenario: Direct route input remains fail-fast
- **GIVEN** a caller provides plugin route metadata directly instead of through a validated snapshot
- **WHEN** the App-Host attempts to build the route tree
- **THEN** route materialization still validates route guardrails before publishing a partial route tree
- **AND** invalid input fails with the deterministic plugin guardrail diagnostics contract
