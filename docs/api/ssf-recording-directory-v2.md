# SSF live recording directory V2

`GET /internal/plugins/ssf/v2/recording-directory` uses the existing `ssf-runtime` service audience/action (`ssf.runtime-configuration.read`) and `X-Studio-Tenant-Id` binding. No browser route or additional service-token permission is introduced. The host validates the caller, tenant readiness and module activation before invoking the plugin. Query parameters cannot override the validated tenant context.

The [schema](ssf-recording-directory-v2.schema.json) and [synthetic example](ssf-recording-directory-v2.example.json) describe the successful response. `directoryRevision` is a deterministic SHA-256 of normalized tenant ID and directory content; changes in permissions, languages, names or membership change it. Resolved display labels are bounded to 200 Unicode code points while preserving every eligible subject. All eligible subjects are enumerated; over 10,000 eligible subjects or invalid identity data fail closed instead of returning a truncated directory.

IAM owns the live reader and profile decryption. The plugin receives only `readPermissionDirectorySubjects`; it never reads IAM tables. Each read uses a new tenant-scoped repeatable-read transaction. Active, unblocked, undeleted, non-deactivated accounts with active deletion lifecycle, unrestricted processing and tenant membership are eligible. Direct roles, delegations and active group memberships use the existing time-valid assignment source and effective permission normalization. Record-, organization- and otherwise restricted grants cannot be represented by a tenant-wide directory and are excluded. Only the five declared recording grants are returned. The protected tenant-local `system_admin` receives all assigned SSF module permissions, including recording permissions, through the existing IAM reconciliation. Other roles require an explicit role or group assignment. Sworn status comes solely from `ssf.recording.review.sworn`. No recording permission grants archive key access.

Managed account editing stores up to 40 canonical competence language tags, independent of UI language. Empty values clear the list; omitted PATCH fields preserve it. Self-profile writes do not manage competence. Reconciliation carries `languages` through source DTO, desired comparison, staff-client `ssf_languages` mapper and read-back. Managed language saves and clears atomically enqueue the existing durable lifecycle retry task for reconciliation. A running reconciliation cannot consume the later edit: its follow-up retries the existing lifecycle start after the active job completes. No manual repair is required. Language-only updates change per-user projection data, while the contract revision remains independent of user data. Mappers remain exclusive to the intended tenant client and managed attributes are admin-only.

A committed revocation changes the next directory read without process restart or token refresh. It does **not** revoke already-issued actor access tokens: those retain their original claims until expiry. Newly issued tokens reflect attributes after successful authorization reconciliation. Live directory freshness and access-token lifetime are distinct guarantees.

Failures use the existing V2 error envelope (`contractVersion`, `error.code`, `message`, `retryable`, `correlationId`):

| Status | Codes |
| --- | --- |
| 401 | `service_authentication_invalid` |
| 403 | `service_action_forbidden` |
| 404 | `tenant_not_found` |
| 409 | `tenant_suspended`, `ssf_plugin_inactive`, `ssf_tenant_not_ready` |
| 503 | `recording_directory_unavailable` |

Missing host capability and IAM authority failures return retryable 503 responses, never empty successful directories. Malformed tenant binding is rejected by the host before IAM access.
