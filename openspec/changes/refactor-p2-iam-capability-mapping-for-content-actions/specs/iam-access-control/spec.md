## ADDED Requirements

### Requirement: Content Capability Mapping
The system SHALL map domain-level content capabilities such as publish, archive, restore, bulk edit, and manage revisions to stable primitive Studio actions before authorization is evaluated.

#### Scenario: Domain capability maps to primitive action
- **GIVEN** a user requests a content publish operation
- **WHEN** the host evaluates authorization
- **THEN** the publish capability is resolved to the configured primitive Studio action and checked through the central permission engine

#### Scenario: Capability has no mapping
- **GIVEN** a content action has no registered capability mapping
- **WHEN** the host evaluates authorization
- **THEN** access is denied with a deterministic missing-mapping diagnostic

