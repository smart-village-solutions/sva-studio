## ADDED Requirements

### Requirement: Specialized Content Bindings Are Materialized By The Host
The routing integration SHALL materialize registered specialized content bindings through host-owned routes and SHALL NOT allow packages to replace route ownership, shell ownership, or guard ownership.

#### Scenario: Host materializes specialized content binding
- **GIVEN** a registered content type declares a specialized list, detail, or editor binding
- **WHEN** the host materializes the corresponding route
- **THEN** the route, params, guards, shell, and fallback states remain host-owned
- **AND** the specialized binding is rendered only inside the designated host region

#### Scenario: Binding registration references invalid route ownership
- **GIVEN** a package attempts to bind a specialized content view by introducing its own top-level shell, route ownership, or guard boundary
- **WHEN** the host validates or materializes the registration
- **THEN** the integration is rejected with deterministic diagnostics
- **AND** the package is directed to the host-owned content binding contract instead

### Requirement: Standard Content Plugins Use Canonical Admin Routes
The routing integration SHALL place standard CRUD-style content plugins under canonical host-owned admin routes instead of plugin-local top-level CRUD routes.

#### Scenario: News, Events, and POI use canonical admin routes
- **GIVEN** the existing standard content plugins `news`, `events`, and `poi`
- **WHEN** the migration is completed
- **THEN** their productive list, create, and detail routes are materialized under canonical host-owned admin paths
- **AND** the host no longer treats `/plugins/news`, `/plugins/events`, or `/plugins/poi` as the primary productive CRUD path

#### Scenario: Exception route stays outside canonical admin CRUD path
- **GIVEN** a plugin declares a documented non-CRUD exception route
- **WHEN** the host materializes the route tree
- **THEN** the exception route may remain under the plugin route namespace
- **AND** it does not replace the canonical admin CRUD routes for that plugin

### Requirement: Missing Specialized Bindings Do Not Break Route Availability
The routing integration SHALL keep content routes available even when no specialized binding is registered for a content type.

#### Scenario: Host falls back on standard detail route
- **GIVEN** a content detail route exists for a registered content type
- **AND** no specialized detail binding is registered
- **WHEN** the route is rendered
- **THEN** the host falls back to the standard detail implementation
- **AND** no duplicate or parallel route tree is introduced for the same content resource
