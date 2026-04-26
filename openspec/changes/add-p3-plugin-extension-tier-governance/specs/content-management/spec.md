## ADDED Requirements

### Requirement: Extension Tier Content Contribution Limits
The system SHALL restrict content-management contributions according to the package extension tier and SHALL document which tiers may define content types, field extensions, workflows, and admin views.

#### Scenario: Tier permits content type contribution
- **GIVEN** a plugin tier permits content type contributions
- **WHEN** the plugin declares a namespaced content type
- **THEN** the host accepts the contribution after normal content validation

#### Scenario: Tier disallows workflow contribution
- **GIVEN** a plugin tier does not permit workflow extensions
- **WHEN** the plugin declares a workflow change
- **THEN** the host rejects the contribution with a tier violation diagnostic

