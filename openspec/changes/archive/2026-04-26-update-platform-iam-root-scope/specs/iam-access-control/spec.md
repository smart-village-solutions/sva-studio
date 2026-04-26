## ADDED Requirements

### Requirement: Platform and Tenant Admin Permissions

The system SHALL keep platform IAM administration and tenant IAM administration as separate authorization scopes while reusing stable IAM-v1 route paths.

#### Scenario: Platform admin accesses root IAM lists
- **WHEN** a user with a platform admin role accesses root-host `/admin/users` or `/admin/roles`
- **THEN** the API evaluates platform roles and returns platform data

#### Scenario: Tenant admin cannot fall back to platform admin
- **WHEN** tenant-local Keycloak role reconciliation fails with `IDP_FORBIDDEN`
- **THEN** the system reports the tenant admin permission failure
- **AND** it does not retry the tenant operation with global platform credentials
