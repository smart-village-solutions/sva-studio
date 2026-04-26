## MODIFIED Requirements

### Requirement: Live IAM Smoke Coverage

Live IAM smoke tests SHALL verify that Studio can be used as a practical Keycloak-admin UI for supported user and role workflows in both platform and tenant scopes.

#### Scenario: Root smoke validates editable platform IAM
- **WHEN** post-deploy smoke tests against `studio.smart-village.app` run
- **THEN** they verify Platform user listing, filtering, detail loading, role listing, and at least one non-destructive editable workflow
- **AND** they record Sync/Reconcile diagnostics without accepting hidden `invalid_instance_id` failures

#### Scenario: Tenant smoke validates tenant Keycloak administration
- **WHEN** post-deploy smoke tests against tenant hosts run
- **THEN** they verify tenant user listing, mapping visibility, role listing, and role reconcile
- **AND** `partial_failure` results are recorded with object counts and diagnosis instead of being treated as browser crashes

#### Scenario: Forbidden tenant admin rights are diagnosable
- **WHEN** a tenant role operation returns `IDP_FORBIDDEN`
- **THEN** the smoke captures the visible diagnosis and confirms the page remains usable
