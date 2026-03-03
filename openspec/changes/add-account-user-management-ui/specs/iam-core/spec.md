# IAM Core Specification – Delta für Account UI

## MODIFIED Requirements

### Requirement: Session Management

The system SHALL manage user sessions securely, with automatic expiration and token refresh.

#### Scenario: Session expiration

- **WHEN** a user's session expires
- **THEN** the system redirects to the login page
- **AND** the expired session cookie is cleared

#### Scenario: AuthProvider integration with session

- **WHEN** the `AuthProvider` component mounts
- **THEN** it calls `/auth/me` to resolve the current session
- **AND** if the session is valid, the user data is provided via `useAuth()` context
- **AND** if the session is invalid or expired, `useAuth()` returns `{ user: null, isAuthenticated: false }`

#### Scenario: Logout via AuthProvider

- **WHEN** a user calls `logout()` from the `useAuth()` hook
- **THEN** the system calls `POST /auth/logout`
- **AND** the AuthProvider state is cleared to `{ user: null, isAuthenticated: false }`
- **AND** the user is redirected to the post-logout page

## ADDED Requirements

### Requirement: IAM Database Schema

The system SHALL maintain a dedicated IAM database schema (`iam.*`) in Postgres for user accounts, roles, permissions, and activity logs, separate from Keycloak's internal storage.

#### Scenario: Account table with Keycloak mapping

- **WHEN** the IAM schema is initialized
- **THEN** an `iam.accounts` table exists with a unique `keycloak_id` column
- **AND** extended profile fields (phone, position, department, avatar, language, timezone) are stored
- **AND** a `status` field constrains values to `active`, `inactive`, `pending`

#### Scenario: Roles and permissions tables

- **WHEN** the IAM schema is initialized
- **THEN** `iam.roles`, `iam.permissions`, `iam.role_permissions` and `iam.account_roles` tables exist
- **AND** 7 system personas are seeded as non-deletable system roles
- **AND** custom roles can be created and deleted

#### Scenario: Activity log table

- **WHEN** any IAM-relevant event occurs (user created, role assigned, profile updated, login)
- **THEN** an immutable entry is written to `iam.activity_logs`
- **AND** the entry includes `event_type`, `actor_id`, `subject_id`, `details` (JSONB), and `created_at`

### Requirement: Keycloak Admin API Integration

The system SHALL integrate with the Keycloak Admin REST API via a dedicated service account to manage user accounts and role assignments bidirectionally.

#### Scenario: Service account authentication

- **WHEN** the IAM service starts
- **THEN** it authenticates with Keycloak using a service account with `realm-management` client role
- **AND** uses the obtained token for subsequent Admin API calls

#### Scenario: User creation sync

- **WHEN** an administrator creates a user via the IAM service
- **THEN** the user is first created in Keycloak via `POST /admin/realms/{realm}/users`
- **AND** then stored in `iam.accounts` with the Keycloak-issued user ID
- **AND** if the Keycloak call fails, no entry is created in `iam.accounts`

#### Scenario: Profile update sync

- **WHEN** a user's profile is updated in the IAM service
- **THEN** the changed fields are written to `iam.accounts`
- **AND** relevant fields (firstName, lastName, email, attributes) are synced to Keycloak via `PUT /admin/realms/{realm}/users/{id}`
