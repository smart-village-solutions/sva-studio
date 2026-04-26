## ADDED Requirements

### Requirement: Host-Enforced Plugin Route Materialization
The system SHALL materialize plugin-provided routes only through the host routing registry and SHALL reject package-provided runtime route handlers that bypass host-owned guards, path conventions, or search-parameter validation.

#### Scenario: Plugin route is materialized by host
- **GIVEN** a plugin declares an admin route contribution
- **WHEN** the host builds the route tree
- **THEN** the route is created with the host-owned guard, canonical path, and search-parameter schema

#### Scenario: Plugin attempts to bypass host routing
- **GIVEN** a plugin exposes a runtime route outside the registry contract
- **WHEN** the host validates plugin contributions
- **THEN** the contribution is rejected before the route tree is built

