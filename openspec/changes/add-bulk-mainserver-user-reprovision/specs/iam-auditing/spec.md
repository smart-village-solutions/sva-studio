## MODIFIED Requirements
### Requirement: Admin Standard Interaction Auditing

The system SHALL audit host-standard admin interactions that mutate multiple records, restore revisions, or expose history-sensitive operations.

#### Scenario: Bulk action is audited
- **GIVEN** a user executes a host-standard bulk action on an admin resource
- **WHEN** the operation is accepted
- **THEN** the host emits an audit event containing the resource identifier, action, affected record count, actor, and scope

#### Scenario: Bulk mainserver reprovision is audited without cleartext PII
- **GIVEN** a user executes the bulk action `Mainserver-Daten aktualisieren` on admin users
- **WHEN** the operation completes with full or partial success
- **THEN** the host emits an audit-capable record for the bulk request containing action, actor, scope, success count, and failure count
- **AND** existing per-user success audit events remain available for successfully reprovisioned targets
- **AND** cleartext PII or secrets are not written into bulk audit payloads
