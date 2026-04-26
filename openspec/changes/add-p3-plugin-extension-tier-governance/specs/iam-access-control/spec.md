## ADDED Requirements

### Requirement: Extension Tier Authorization Limits
The system SHALL prevent plugin packages from declaring authorization requirements, actions, or admin capabilities that exceed their configured extension tier.

#### Scenario: Tier permits declared action
- **GIVEN** a plugin package declares an action allowed by its extension tier
- **WHEN** the host validates the plugin contribution
- **THEN** the action is accepted for host-owned authorization checks

#### Scenario: Tier exceeds authorization boundary
- **GIVEN** a plugin package declares a platform-level action outside its extension tier
- **WHEN** the host validates the plugin contribution
- **THEN** validation fails before the action can be used

