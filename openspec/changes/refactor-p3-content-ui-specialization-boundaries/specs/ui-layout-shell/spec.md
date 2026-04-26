## ADDED Requirements

### Requirement: Host Shell Owns Specialized View Placement
The system SHALL keep page chrome, navigation placement, responsive layout regions, and global actions under host shell control when rendering specialized content views.

#### Scenario: Specialized view is placed in host region
- **GIVEN** a package registers a specialized content view
- **WHEN** the route is rendered
- **THEN** the host places the view in the standard content region without allowing the package to replace global shell controls

#### Scenario: Specialized view requests shell replacement
- **GIVEN** a package contribution attempts to replace global navigation or shell chrome
- **WHEN** the host validates the contribution
- **THEN** the host rejects the shell replacement request

