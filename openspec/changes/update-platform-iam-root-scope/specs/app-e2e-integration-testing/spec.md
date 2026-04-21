## MODIFIED Requirements

### Requirement: Live IAM Smoke Coverage

Live IAM smoke tests SHALL distinguish platform-scope results from tenant-scope results and preserve diagnostic evidence for sync outcomes.

#### Scenario: Platform smoke has no invalid instance failure
- **WHEN** a root-host smoke opens `/admin/users` and `/admin/roles`
- **THEN** no `invalid_instance_id` response is accepted as a passing result

#### Scenario: Tenant sync partial failure remains visible
- **WHEN** tenant Keycloak user sync returns HTTP 200 with `partial_failure`
- **THEN** the smoke records the counters and treats the finding as fachlich offen rather than a browser crash
