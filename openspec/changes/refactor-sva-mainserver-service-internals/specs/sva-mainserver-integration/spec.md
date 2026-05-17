## ADDED Requirements
### Requirement: SVA-Mainserver-Service-Interna sind modular getrennt bei stabiler Fassade

The system SHALL keep the public server-side Mainserver service facade stable while separating infrastructure and resource-specific implementation concerns into internal modules.

The public facade includes `createSvaMainserverService`, the returned service methods, and the existing top-level helper exports from `@sva/sva-mainserver/server`.

#### Scenario: Internal modules are refactored
- **GIVEN** the Mainserver server runtime is maintained internally
- **WHEN** cache, credential loading, token loading, GraphQL transport, telemetry, or resource mappings are changed
- **THEN** those responsibilities live in dedicated internal modules instead of one monolithic service file
- **AND** callers still use the unchanged public facade

#### Scenario: Existing callers keep their contract
- **GIVEN** a server-side caller imports `createSvaMainserverService` or a top-level helper from `@sva/sva-mainserver/server`
- **WHEN** the refactored package is built and executed
- **THEN** no caller-facing method name, parameter contract, or deterministic error code changes
- **AND** the caller does not need to adopt new imports or a generic transport API

#### Scenario: Internal behavior stays testable in focused units
- **GIVEN** credential caching, token renewal, retry semantics, or nested Mainserver mapping behavior must be changed
- **WHEN** tests are updated for that behavior
- **THEN** focused unit tests exist for the relevant internal module
- **AND** a smaller service-level test layer still verifies facade wiring and default-service behavior
