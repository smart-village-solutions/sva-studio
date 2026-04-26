## ADDED Requirements

### Requirement: Host-Enforced Plugin Route Materialization
The system SHALL materialize plugin-provided routes only through the host routing registry and SHALL reject package-provided runtime route handlers that bypass host-owned guards, path conventions, or search-parameter validation.

Plugin-provided UI components SHALL remain allowed when they are bound to a host-materialized route and do not define independent route handlers, guard functions, or search-parameter parsing outside the registry contract.

#### Scenario: Plugin route is materialized by host
- **GIVEN** a plugin declares an admin route contribution
- **WHEN** the host builds the route tree
- **THEN** the route is created with the host-owned guard, canonical path, and search-parameter schema
- **AND** the plugin UI is rendered only inside the host-materialized route boundary

#### Scenario: Plugin attempts to bypass host routing
- **GIVEN** a plugin exposes a runtime route outside the registry contract
- **WHEN** the host validates plugin contributions
- **THEN** the contribution is rejected before the route tree is built
- **AND** the diagnostics include `plugin_guardrail_route_bypass` with plugin namespace and contribution identifier

#### Scenario: Plugin declares UI without owning routing decisions
- **GIVEN** a plugin declares a route-bound UI component and declarative search-parameter schema
- **WHEN** the host validates and materializes the route
- **THEN** the contribution is accepted
- **AND** search-parameter parsing and route guards remain host-owned
