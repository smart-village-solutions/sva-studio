## ADDED Requirements

### Requirement: Capability-Mapped Audit Classification
The system SHALL include the domain capability and resolved primitive action in audit events for mapped content actions.

#### Scenario: Mapped action is audited
- **GIVEN** a user executes a mapped content action
- **WHEN** the action completes or fails
- **THEN** the audit event records both the domain capability and the resolved primitive action
- **AND** the audit event records actor, scope, resource type, target identifier when available, result, request id, and trace id

#### Scenario: Authorization denies mapped action
- **GIVEN** a user lacks the primitive action required by a domain capability
- **WHEN** the host denies the operation
- **THEN** the denial can be audited with the capability, primitive action, actor, and scope
- **AND** the denial reason is `capability_authorization_denied`

#### Scenario: Missing mapping is audited
- **GIVEN** a mutating action references no supported capability mapping
- **WHEN** the host rejects registration or denies execution
- **THEN** the audit or diagnostic path can record `capability_mapping_missing` with action identifier, owning namespace when available, resource type, and scope
- **AND** no sensitive payload or cleartext PII is written into the audit event

#### Scenario: Audit records remain explainable
- **GIVEN** stored audit events include mapped content action events
- **WHEN** an auditor reviews a denied or successful mapped action
- **THEN** the stored audit record exposes the fachliche capability, resolved primitive action, result, reason code, actor reference, and scope consistently
