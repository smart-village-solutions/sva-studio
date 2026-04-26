## ADDED Requirements

### Requirement: Content Core Audit Metadata
The system SHALL emit audit events for host-owned content core state changes using stable metadata independent of plugin-specific payload shape.

#### Scenario: Content status changes
- **GIVEN** a content item status changes
- **WHEN** the mutation is committed
- **THEN** the audit event records the content identifier, content type, previous status, next status, actor, and scope

#### Scenario: Plugin payload changes only
- **GIVEN** a mutation changes only plugin-specific payload fields
- **WHEN** the mutation is committed
- **THEN** the audit event still references the stable host content core identity and scope

