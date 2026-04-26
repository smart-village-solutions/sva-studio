## ADDED Requirements

### Requirement: Plugin Extension Tiers
The system SHALL classify workspace extension packages into documented extension tiers that define which SDK surfaces, host capabilities, and contribution types are allowed.

#### Scenario: Package declares extension tier
- **GIVEN** a workspace plugin package declares an extension tier
- **WHEN** the host validates the build-time registry snapshot
- **THEN** allowed contribution types are evaluated against that tier

#### Scenario: Package omits required tier metadata
- **GIVEN** a workspace plugin package contributes to host extension points without tier metadata
- **WHEN** the registry snapshot is validated
- **THEN** validation fails with a deterministic missing-tier diagnostic

