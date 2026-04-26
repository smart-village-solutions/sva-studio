## ADDED Requirements

### Requirement: Content Core Audit Metadata
The system SHALL emit audit events for host-owned content core state changes using stable metadata independent of plugin-specific payload shape.

Content core audit events SHALL include at least `event_id`, `timestamp`, `instance_id`, optional `organization_id`, `content_id`, `content_type`, `action`, `actor_subject_id`, `result`, `request_id`, `trace_id`, previous and next host-owned lifecycle values where applicable, and a payload-change classification that does not store plugin payload contents in the audit record.

#### Scenario: Content status changes
- **GIVEN** a content item status changes
- **WHEN** the mutation is committed
- **THEN** the audit event records the content identifier, content type, previous status, next status, actor, result, request identifier, trace identifier, and scope

#### Scenario: Plugin payload changes only
- **GIVEN** a mutation changes only plugin-specific payload fields
- **WHEN** the mutation is committed
- **THEN** the audit event still references the stable host content core identity and scope
- **AND** the audit event records a payload-change classification without storing plugin payload contents

#### Scenario: Content mutation is denied
- **GIVEN** a content core mutation is denied by validation or authorization
- **WHEN** the denial is returned
- **THEN** the audit path can record the attempted primitive action, result, actor, content scope if known, and deterministic reason code
- **AND** missing or invalid plugin payload data is not copied into the audit record

#### Scenario: Revision restore is committed
- **GIVEN** a user restores a content item from a previous revision
- **WHEN** the restore operation commits
- **THEN** the audit event links the content identifier, restored revision reference, previous revision reference, actor, primitive action, result, and scope
