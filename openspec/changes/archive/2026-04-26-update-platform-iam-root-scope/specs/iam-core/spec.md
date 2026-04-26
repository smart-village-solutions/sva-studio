## ADDED Requirements

### Requirement: IAM Account Management Scope Resolution

IAM Account Management SHALL resolve each authenticated IAM-v1 request as either `platform` or `instance` scope before reading or mutating users, roles, permissions, or sync state.

#### Scenario: Root-host user list uses platform scope
- **WHEN** an authenticated platform admin without `instanceId` calls `GET /api/v1/iam/users`
- **THEN** the system returns platform users from the platform identity provider
- **AND** it does not require or synthesize a tenant `instanceId`

#### Scenario: Tenant user list remains instance-scoped
- **WHEN** an authenticated tenant admin with `instanceId` calls `GET /api/v1/iam/users`
- **THEN** the system uses the existing tenant IAM read model for that `instanceId`

### Requirement: Keycloak User Synchronization Scope

The system SHALL run Keycloak user synchronization with the identity provider administration mode that matches the active scope.

#### Scenario: Root sync uses platform admin
- **WHEN** a platform admin starts `POST /api/v1/iam/users/sync-keycloak`
- **THEN** the system lists platform Keycloak users using `platform_admin`
- **AND** the response includes `executionMode=platform_admin` in diagnostics

#### Scenario: Tenant sync keeps tenant admin
- **WHEN** a tenant admin starts `POST /api/v1/iam/users/sync-keycloak`
- **THEN** the system continues to use `tenant_admin`
