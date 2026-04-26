## ADDED Requirements

### Requirement: Content Contributions Register Before UI Materialization
The system SHALL register and validate existing plugin-provided content type contributions in the content phase before later admin and routing phases publish host UI materialization outputs.

This change SHALL NOT introduce a new content admin extension contract. Generic admin resources remain validated by the existing admin resource contract.

#### Scenario: Content type validates before admin phase
- **GIVEN** a plugin declares a content type and an admin resource
- **WHEN** the host creates the registry snapshot
- **THEN** content type validation completes before the admin phase runs

#### Scenario: Invalid content contribution stops later phases
- **GIVEN** a plugin declares an invalid content type contribution
- **WHEN** the content phase validates plugin contributions
- **THEN** validation fails before admin or route materialization

#### Scenario: Generic admin resource remains content-independent
- **GIVEN** a plugin declares a generic admin resource without a content-type dependency
- **WHEN** the admin phase validates the contribution
- **THEN** the host validates the admin resource contract without requiring a content type
