## ADDED Requirements

### Requirement: Root and Tenant Host Smoke Separation

Deployment verification SHALL test the root platform host separately from tenant hosts.

#### Scenario: Root smoke validates platform IAM
- **WHEN** post-deploy smoke tests run against `studio.smart-village.app`
- **THEN** they validate platform login, instance management, platform users, platform roles, account page, and platform user sync

#### Scenario: Tenant smoke validates tenant IAM
- **WHEN** post-deploy smoke tests run against tenant hosts
- **THEN** they validate tenant login, tenant user sync, tenant role reconcile, content access, and no browser crash
