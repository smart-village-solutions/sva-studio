## ADDED Requirements

### Requirement: Admin Standard Interaction Auditing
The system SHALL audit host-standard admin interactions that mutate multiple records, restore revisions, or expose history-sensitive operations.

#### Scenario: Bulk action is audited
- **GIVEN** a user executes a host-standard bulk action on an admin resource
- **WHEN** the operation is accepted
- **THEN** the host emits an audit event containing the resource identifier, action, affected record count, actor, and scope

#### Scenario: Revision restore is audited
- **GIVEN** a user restores an admin resource revision
- **WHEN** the restore operation completes
- **THEN** the host emits an audit event linking the current record and restored revision

