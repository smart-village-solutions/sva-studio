## ADDED Requirements

### Requirement: Content Actions Declare Capabilities
The system SHALL require content and admin actions to declare their domain capability so that UI availability, API authorization, and audit classification use the same mapping.

#### Scenario: Content action declares capability
- **GIVEN** a content action declares a supported domain capability
- **WHEN** the action is rendered or executed
- **THEN** the host uses the mapped primitive action for availability and authorization

#### Scenario: Content action omits capability
- **GIVEN** a mutating content action has no declared capability
- **WHEN** the content type is registered
- **THEN** the host rejects the action declaration

