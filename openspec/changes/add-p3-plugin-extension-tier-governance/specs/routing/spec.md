## ADDED Requirements

### Requirement: Extension Tier Routing Limits
The system SHALL allow plugin route contributions only when the package extension tier permits the route scope and host surface being targeted.

#### Scenario: Fachpackage contributes content admin route
- **GIVEN** a Fachpackage tier permits content admin routes
- **WHEN** the plugin declares a content admin resource route
- **THEN** the host accepts and materializes the route through the standard admin route registry

#### Scenario: Fachpackage targets platform settings route
- **GIVEN** a Fachpackage tier does not permit platform settings routes
- **WHEN** the plugin declares a platform settings contribution
- **THEN** the host rejects the route contribution

