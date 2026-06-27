## 1. Specification

- [x] 1.1 Validate OpenSpec deltas with `openspec validate update-iam-ownership-authorization-model --strict`.

## 2. Data Model

- [x] 2.1 Add migration `0061_iam_content_ownership_authorization_model.sql`.
- [x] 2.2 Add `owner_user_id` and `owner_organization_id` to content tables and projection trigger.
- [x] 2.3 Remove `iam.account_permissions` and explicit permission `effect` schema.
- [x] 2.4 Update database schema snapshot and database documentation.

## 3. Authorization Runtime

- [x] 3.1 Remove Deny and direct-user permission types from public IAM contracts.
- [x] 3.2 Evaluate `own` and `organization` scopes from owner fields.
- [x] 3.3 Share the same owner-scope decision between list, detail and mutation paths.
- [x] 3.4 Keep `System Admin` as normal role with complete tenant-visible Permission sync coverage.

## 4. IAM Admin and UI

- [x] 4.1 Remove direct permission input/output from user APIs and UI.
- [x] 4.2 Remove `effect` display/filtering from IAM permission transparency surfaces.
- [x] 4.3 Keep role permission scope assignment UI without Deny support.

## 5. Verification

- [x] 5.1 Run targeted unit tests for core, auth-runtime, iam-admin and data.
- [x] 5.2 Run server runtime and affected type/unit gates.
- [x] 5.3 Run database migration validation.
