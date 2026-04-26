## ADDED Requirements

### Requirement: Host-Enforced Plugin Authorization
The system SHALL evaluate authorization for plugin contributions through host-owned IAM checks and SHALL NOT allow plugins to provide executable authorization decisions.

#### Scenario: Host evaluates plugin action permission
- **GIVEN** a plugin declares a guarded contribution with required actions
- **WHEN** a user opens or executes that contribution
- **THEN** the host evaluates the required fully-qualified actions before access is granted

#### Scenario: Plugin provides executable authorization logic
- **GIVEN** a plugin contribution includes custom authorization code
- **WHEN** the contribution is registered
- **THEN** the host rejects the contribution as an invalid guardrail violation

