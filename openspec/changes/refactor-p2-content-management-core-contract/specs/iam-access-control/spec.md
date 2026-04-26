## ADDED Requirements

### Requirement: Content Core Authorization Primitives
The system SHALL authorize content core operations through host-owned primitive actions that remain stable across plugin-specific content types.

#### Scenario: User edits content core metadata
- **GIVEN** a user requests a core content mutation
- **WHEN** the host evaluates authorization
- **THEN** the decision uses the stable primitive action for that mutation and the resolved content scope

#### Scenario: Plugin declares custom core permission
- **GIVEN** a plugin declares a permission that replaces a host-owned core content permission
- **WHEN** the contribution is validated
- **THEN** the host rejects the conflicting permission declaration

