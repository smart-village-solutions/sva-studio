# Access Control Specification

## ADDED Requirements

### Requirement: Role-Based Access Control (RBAC)

The system SHALL implement a role-based access control model with predefined system roles (7 Personas) and custom organization-specific roles.

#### Scenario: System role assignment

- **WHEN** an administrator assigns the "Redakteur" system role to a user
- **THEN** the user inherits all permissions defined for the "Redakteur" role
- **AND** these permissions are: create content, edit own content, submit for review
- **AND** the permissions do NOT include: publish, delete, manage users

#### Scenario: Custom role creation

- **WHEN** an organization administrator creates a custom role (e.g., "Vereinsredakteur")
- **THEN** they select permissions to grant (e.g., "create_events", "edit_events")
- **AND** they can assign this role to users within their organization
- **AND** the custom role only applies within that organization (no cross-org spillover)

### Requirement: 7-Personas System

The system SHALL define and enforce 7 predefined personas with distinct permission sets.

#### Scenario: System-Administrator permissions

- **WHEN** a user holds the "System-Administrator" persona
- **THEN** they can:
  - Create/update/delete any organization
  - Manage any user account
  - View audit logs
  - Configure system settings
- **AND** no content-level restrictions apply

#### Scenario: Redakteur permissions

- **WHEN** a user holds the "Redakteur" persona in Organization X
- **THEN** they can:
  - Create news/events in Organization X
  - Edit their own content
  - Submit content for review
- **AND** they CANNOT:
  - Publish content (requires Prüfer or higher)
  - Delete content
  - Access other organizations' content

#### Scenario: App-Manager permissions

- **WHEN** a user holds the "App-Manager" persona in Organization X
- **THEN** they can:
  - Manage modules and features for Organization X
  - Assign users to roles within Organization X
  - View usage statistics
- **AND** they inherit Redakteur permissions (for content tasks)

#### Scenario: Designer permissions

- **WHEN** a user holds the "Designer" persona
- **THEN** they can:
  - Edit branding (logo, colors, fonts)
  - Modify layouts and templates
  - Configure module appearances
- **AND** they do NOT have content creation/deletion permissions

#### Scenario: Interface-Manager permissions

- **WHEN** a user holds the "Interface-Manager" persona
- **THEN** they can:
  - Manage API clients and integrations
  - View integration logs
  - Configure webhooks
- **AND** no content permissions apply

#### Scenario: Moderator permissions

- **WHEN** a user holds the "Moderator" persona
- **THEN** they can:
  - Manage user support tickets
  - Reset user passwords
  - View user activity
- **AND** limited content viewing (no editing)

#### Scenario: Strategischer Entscheider permissions

- **WHEN** a user holds the "Strategischer Entscheider" persona
- **THEN** they can:
  - View read-only dashboards and reports
  - Export analytics
- **AND** no data modification permissions apply

### Requirement: Permission Aggregation

The system SHALL aggregate permissions from multiple roles and calculate the effective permission set for a user.

#### Scenario: User with multiple roles

- **WHEN** a user holds both "Redakteur" and "Prüfer" roles in Organization X
- **THEN** the system aggregates permissions: {create_content, edit_content, review_content, publish_content}
- **AND** the user can perform any action in this aggregated set
- **AND** when checking `canUserPerformAction('publish_content')`, the result is TRUE

### Requirement: Attribute-Based Access Control (ABAC)

The system SHALL support attribute-based policies that restrict permissions based on context attributes (organization, time, resource type, etc.).

#### Scenario: Geography-based restriction

- **WHEN** a redacteur is assigned the permission "edit_news" with scope `{region: "Bayern", municipality: "München"}`
- **THEN** the user can only edit news in München, Bayern
- **AND** if the user attempts to edit news in "Berlin", the system denies access

#### Scenario: Time-based restriction

- **WHEN** a permission includes a time constraint `{validFrom: "2026-01-01", validTo: "2026-12-31"}`
- **THEN** the permission is only active during this period
- **AND** outside this window, the permission is not granted

#### Scenario: Resource-type restriction

- **WHEN** a permission specifies `{action: "publish", resourceType: "news", categories: ["sports", "events"]}`
- **THEN** the user can publish content only if it's a news article in sports or events category
- **AND** publishing other content types is denied

### Requirement: Hierarchical Permission Inheritance

The system SHALL support permission inheritance along the organizational hierarchy, allowing parent-level decisions to propagate to children.

#### Scenario: County-level permission

- **WHEN** a County Administrator is granted "manage_all_municipalities" permission at the county level
- **THEN** this permission is automatically active for all subordinate municipalities
- **AND** the administrator can manage content, users, and settings in any municipality within the county

#### Scenario: Override at lower level

- **WHEN** a Municipality Administrator restricts permissions (e.g., "redacteurs can only edit events, not news")
- **THEN** this restriction overrides the parent county policy for that municipality
- **AND** the system enforces the more restrictive policy (principle of least privilege)

### Requirement: Permission Caching

The system SHALL cache computed permission sets in Redis to ensure permission checks complete in < 50ms.

#### Scenario: Permission cache hit

- **WHEN** `canUserPerformAction(userId, action)` is called
- **THEN** the system checks Redis for cached permissions
- **AND** if found and valid, returns the cached result (< 5ms)

#### Scenario: Cache invalidation

- **WHEN** a user's role is changed (e.g., from "Redakteur" to "Prüfer")
- **THEN** the backend publishes a cache-invalidation event via Redis Pub/Sub
- **AND** the permission cache entry for that user is deleted
- **AND** the next `canUserPerformAction` call recomputes and recaches

#### Scenario: Cache miss and fallback

- **WHEN** a permission cache entry is not found in Redis
- **THEN** the system queries the database for current roles and permissions
- **AND** computes the permission set
- **AND** stores the result in Redis (TTL: 1 hour)
- **AND** returns the result to the caller

---

## MODIFIED Requirements

(None for Phase 3.)

---

## REMOVED Requirements

(None for Phase 3.)
