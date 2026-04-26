## ADDED Requirements

### Requirement: Plugin Registration Phases
The system SHALL define explicit build-time registration phases for workspace plugins so that content, admin, routing, audit, and search contributions are collected and validated in a deterministic order.

#### Scenario: Plugin contributions follow phase order
- **GIVEN** a plugin declares contributions for multiple phases
- **WHEN** the build-time registry snapshot is created
- **THEN** the host processes the contributions in the documented phase order

#### Scenario: Plugin declares phase-incompatible contribution
- **GIVEN** a plugin declares a contribution in a phase that does not support it
- **WHEN** the registry snapshot is validated
- **THEN** validation fails with a deterministic diagnostic message

