## ADDED Requirements

### Requirement: Plugin Custom View Bindings Use Studio UI
The routing integration SHALL allow plugin custom view components while preserving host-owned routing, guard, shell, and state responsibilities.

#### Scenario: Route materializes plugin custom view
- **GIVEN** a plugin route or admin resource binding references a custom view component
- **WHEN** the host materializes the route
- **THEN** routing and guard evaluation remain host-owned
- **AND** the custom view is rendered inside the standard app shell
- **AND** shared page structure and state components are provided through `@sva/studio-ui-react`

#### Scenario: Custom view bypasses host route contract
- **GIVEN** a plugin custom view attempts to define its own top-level shell, guard boundary, or app route materialization
- **WHEN** the route registry is validated or reviewed
- **THEN** the integration is rejected or documented as an architecture deviation
- **AND** the plugin is directed to use the host route binding plus `@sva/studio-ui-react`

