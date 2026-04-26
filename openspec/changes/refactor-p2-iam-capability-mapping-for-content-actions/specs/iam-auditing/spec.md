## ADDED Requirements

### Requirement: Capability-Mapped Audit Classification
The system SHALL include the domain capability and resolved primitive action in audit events for content and admin actions.

#### Scenario: Mapped action is audited
- **GIVEN** a user executes a mapped content action
- **WHEN** the action completes or fails
- **THEN** the audit event records both the domain capability and the resolved primitive action

#### Scenario: Authorization denies mapped action
- **GIVEN** a user lacks the primitive action required by a domain capability
- **WHEN** the host denies the operation
- **THEN** the denial can be audited with the capability, primitive action, actor, and scope

