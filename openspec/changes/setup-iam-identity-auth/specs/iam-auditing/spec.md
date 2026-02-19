# Auditing Specification

## ADDED Requirements

### Requirement: Immutable Activity Logging

The system SHALL maintain an immutable audit log of all security-relevant IAM events for compliance, forensics, and troubleshooting.

#### Scenario: Login event logged

- **WHEN** a user successfully logs in via Keycloak
- **THEN** an event is recorded in `iam.activity_logs` with:
  - Event type: "login"
  - Actor ID (the user logging in)
  - Timestamp (UTC)
  - IP address
  - User agent
- **AND** this log entry CANNOT be modified, updated, or deleted

#### Scenario: Role assignment logged

- **WHEN** an administrator assigns a role to a user
- **THEN** an event is recorded with:
  - Event type: "role_assigned"
  - Actor ID (the administrator performing the assignment)
  - Subject ID (the user receiving the role)
  - Role name and scope
  - Timestamp and IP
- **AND** the log entry is immutable

#### Scenario: Permission change logged

- **WHEN** a role's permissions are modified
- **THEN** an event is recorded with:
  - Event type: "permission_changed"
  - Old permission set (JSON)
  - New permission set (JSON)
  - Reason/comment (optional)
  - Timestamp

#### Scenario: Organization hierarchy change logged

- **WHEN** the parent organization of a municipality is changed
- **THEN** an event is recorded with the old and new parent IDs
- **AND** all users accessing that organization are notified (optional)

### Requirement: Audit Log Query & Export

The system SHALL provide administrators with tools to query, filter, and export audit logs.

#### Scenario: Query recent login attempts

- **WHEN** a security officer queries audit logs with filters: `{eventType: "login", dateRange: "last_24h"}`
- **THEN** the system returns all login events from the past 24 hours
- **AND** results are paginated (100 results per page)

#### Scenario: Export audit logs as CSV

- **WHEN** an administrator clicks "Export Audit Log"
- **AND** selects a date range
- **THEN** the system generates a CSV file with columns:
  - timestamp, event_type, actor_id, actor_email, subject_id, subject_email, details, ip_address
- **AND** the file is downloadable

#### Scenario: Anomaly detection query

- **WHEN** a security administrator queries: `{actor: "user123", eventType: "permission_changed", dateRange: "last_7d"}`
- **THEN** the system returns all permission changes initiated by that user
- **AND** highlights any unusual patterns (e.g., 10+ changes in 1 minute)

### Requirement: Data Retention Policy

The system SHALL enforce configurable retention policies for audit log data.

#### Scenario: 2-year retention

- **WHEN** an audit log entry reaches 2 years old
- **AND** no legal hold is in place
- **THEN** the entry is eligible for deletion
- **AND** a background job purges eligible entries (hardDelete)

#### Scenario: Legal hold

- **WHEN** a legal hold is placed on a user's data
- **THEN** all related audit log entries are marked "held"
- **AND** they are NOT deleted even if retention period expires
- **AND** they remain queryable and exportable

### Requirement: Event Types and Schema

The system SHALL define and consistently implement a set of standard IAM event types.

#### Scenario: Standard event types

The system tracks these event types (non-exhaustive):

- `login` – Successful login
- `login_failed` – Failed login attempt (reason: invalid_password, user_not_found, account_locked)
- `logout` – User logout
- `account_created` – New account created (manual or JIT provisioning)
- `account_disabled` – Account disabled
- `password_changed` – User changed password
- `password_reset` – Admin reset user password
- `2fa_enabled` – 2FA activated for user
- `2fa_disabled` – 2FA deactivated
- `role_assigned` – Role granted to user
- `role_revoked` – Role removed from user
- `permission_changed` – Permission added/removed from role
- `organization_assigned` – User assigned to organization
- `organization_removed` – User removed from organization
- `org_created` – Organization created
- `org_deleted` – Organization deleted
- `delegation_created` – Temporary delegation/substitution granted
- `delegation_expired` – Temporary delegation ended

#### Scenario: Event schema validation

- **WHEN** an event is logged
- **THEN** the system validates that the event matches a predefined schema
- **AND** required fields (timestamp, actor, event_type) are present
- **AND** event-specific fields (e.g., role_name for role_assigned) are correctly typed

### Requirement: Audit Log Dashboard

The system SHALL provide an administrator dashboard for monitoring and querying audit logs.

#### Scenario: Security dashboard

- **WHEN** a system administrator accesses the audit dashboard
- **THEN** they see:
  - Recent login attempts (last 24h)
  - Failed login attempts (last 24h) with count per user
  - Recent role/permission changes
  - User account lifecycle events (created, disabled, deleted)
- **AND** each event is clickable to view full details

#### Scenario: User activity timeline

- **WHEN** an administrator searches for a specific user (by email or ID)
- **THEN** the system displays a timeline of all events involving that user
- **AND** events are sorted by timestamp (newest first)
- **AND** an admin can drill-down into any event for details

---

## MODIFIED Requirements

(None for Phase 3 – auditing is new capability.)

---

## REMOVED Requirements

(None for Phase 3.)
