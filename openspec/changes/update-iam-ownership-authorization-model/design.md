## Context

Tenant authorization is moving to the documented target model: Permissions grant rights through roles, groups bundle roles, content ownership is a separate IAM concept, and the runtime is allow-only.

## Goals

- Make owner-based scoping the single source for content record authorization.
- Remove direct account permissions and explicit Deny semantics from active schema and contracts.
- Preserve authorization correctness by keeping pre-existing rows without canonical owners ownerless until an explicit owner assignment is made.

## Non-Goals

- No Keycloak realm role expansion beyond existing technical special-role boundaries.
- No new runtime superuser bypass for `system_admin`.
- No broad redesign of plugin-specific business authorization.

## Decisions

- Add new canonical database columns `owner_user_id` and `owner_organization_id` instead of renaming existing columns in place.
- Remove `iam.account_permissions` and `iam.permissions.effect` in the same migration because the target model is intentionally breaking.
- Treat old rows without canonical owner fields as ownerless; only global `all` grants can access them.

## Risks / Trade-offs

- Dropping `account_permissions` and `effect` is breaking. The migration must fail early if production data still contains unsupported `deny` rows requiring manual review.
- Removing `effect` requires coordinated API, UI and fixture updates because existing transparency views display it.
- Owner-based list filtering can affect performance; add indexes for `owner_user_id` and `owner_organization_id`.

## Migration Plan

1. Add owner columns and indexes.
2. Keep existing content ownerless unless canonical owner fields are already populated.
3. Update projection trigger and synchronize projection owner fields from canonical content ownership.
4. Drop direct account permissions.
5. Fail if any `iam.permissions.effect = 'deny'` exists, then drop `effect`.
6. Update schema snapshot and tests.
