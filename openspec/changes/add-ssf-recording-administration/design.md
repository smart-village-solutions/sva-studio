# Studio recording administration design

## Context

The user confirmed these requirements as obligations of Studio, with SSF as the runtime consumer. The [decision record](https://github.com/smart-village-solutions/smart-speech-flow/blob/291f613f/docs/meeting-notes/2026-11-02-studio-recording-settings.md) captures the approved product decisions. This design proposes implementation details for review.

SSF uses `RecordingPolicy` in `services/api_gateway/studio_v2.py`, five permission constants in `recording/permissions.py` and `studio_recording_directory_client.py`. Studio already has v2 template/tenant overrides, legal-text administration and an authorization projection. Extend these boundaries rather than creating another configuration service.

## Decisions

1. Studio resolves retention as tenant override, installation default, then 720 hours. Missing override means inheritance; zero does not mean unlimited. Validate explicit values as integers in 1..8760 and reject invalid writes. A missing entire recording block still disables recording in SSF.
2. Store defaults in Studio's installation runtime template and tenant overrides in the existing tenant content JSON. Resolve `recording.retentionHours` before serialization and include the effective recording block in `configurationRevision`. Inheritance metadata is administrative data; SSF receives one effective value.
3. Tenant recording enablement is explicit and defaults false. An installation retention default must not enable recording. An enabled policy requires all consumer-required fields; in particular `auditRetentionHours >= retentionHours` and an HTTPS timestamp-authority URL.
4. Preserve existing `legalTexts` and its versioned localization model. Also support `recording.texts` where the current SSF consumer expects it. Do not introduce the older flat `recordingConsentHtml` field names from issue #612. Missing legal configuration uses existing SSF fallback rules; source-language legal fallback remains visibly identified.
5. Add the exact five recording permission IDs to Studio's existing permission allowlist and Keycloak projection. Use `ssf_languages` for the actor's competence claim and `languages` in directory entries. Sworn status is the `ssf.recording.review.sworn` permission. Administration permissions alone confer no recording role or archive decryption access.
6. Directory responses use the currently implemented SSF v2 envelope and live effective IAM data. A revoked grant disappears on the next read; an unavailable authority yields an error, never a fabricated empty success or stale cached list.
7. Studio Core/IAM owns a tenant realm policy `optional | required` for ordinary-login MFA. The plugin does not implement OTP. Users enroll through Keycloak. Changes use existing audited, idempotent provisioning/reconciliation; display desired and applied status. Required MFA is not shown as applied before Keycloak confirms the configuration.
8. Preserve fresh `acr=mfa` and `auth_time` checks for existing sensitive recording-key actions. This plan does not interpret optional ordinary-login MFA as permission to bypass those checks. Real realm tests must prove both voluntary login MFA and requested step-up; a password-only login must never receive `acr=mfa`.
9. Stop editing and emitting legacy storage choices. Where old schema compatibility still requires `conversationContentStorage`, send only `disabled` with null retention and null `storageQuestionHtml`. Remove these compatibility fields only in a separately coordinated contract migration.

## Alignment with current Studio structure

The relevant source paths were checked against Studio main `7e0d71a8718754859b7c4efdc8e319d41a7170f4` on 2026-11-02. These are concrete integration constraints, not evidence that the new capability already exists:

- **Policy resolution:** `content-v2-overrides.ts` treats `enabled` as content suppression metadata and removes it from merged objects. Extract the recording subtrees before the generic content merge and use a dedicated recording resolver. Tenant enablement defaults false and is never inherited from the installation template. Preserve existing content suppression semantics; test policy serialization and editor diff/reset round trips.
- **Identifiers:** the current host service context names the tenant `context.tenant.instanceId`; plugin tenant persistence uses `instance_id`. Map that value unchanged to SSF `tenantId`. Installation defaults belong to singleton `ssf.server_settings`. Do not confuse tenant-local organisation membership records with the realm/SSF tenant boundary.
- **Plugin declaration and loading:** add the five recording permission definitions to `descriptor.ts` and the module IAM permission list. Keep the tenant administrator baseline complete for all tenant-local module permissions, including recording; ordinary roles require explicit grants, while platform actions remain separate. Declare the directory service endpoint in the descriptor and bind it in `server/index.ts`, the exported `./server` entry point. `server.ts` contains lifecycle job handlers and is not the ordinary endpoint registration location.
- **IAM read boundary:** the current `readTenantPermissionProjectionSubjects` returns only subjects, role names and permission IDs. Extend the existing Core/IAM reader path with a generic live directory read that includes display names and competence languages, using existing effective-permission and profile-decoding logic. The plugin must neither query IAM tables nor infer competence from UI locale. Carry languages through the existing source, projection comparison, mapper and read-back so language-only changes reconcile.
- **Host composition:** define the small `SsfPluginServerCapabilities` reader contract in the plugin and inject the Core/IAM implementation from `plugin-server-runtime.server.ts`, following its existing waste-management capability-composition pattern. Preserve the no-argument server-factory contract with an unavailable directory handler when no capability is supplied. Test installed-package and workspace entry parity; do not introduce a new loader or plugin framework.
- **MFA management:** optional/required MFA is a new generic Core/IAM administration feature. Extend its existing tenant/instance settings DTO, authorized mutation, persistence, audit and realm reconciliation; tenant administrators manage their own realm policy. Store desired state separately from verified applied state and use the existing provisioning job/run diagnostics. A failed update must remain visible and must not claim required MFA is applied. No MFA state belongs in the SSF content JSON. Preserve unmanaged Keycloak configuration or report a conflict.

Studio implementation must document these changes in arc42 sections 04, 05, 06 and 08 and record the IAM pattern in an ADR referenced from section 09. The detailed interfaces and acceptance cases are in the implementation plan.

## Alternatives considered

- Resolve retention in SSF: rejected because Studio would display an incomplete effective policy and duplicate configuration rules.
- Reuse the old storage-retention setting: rejected because it belongs to the retired plaintext persistence flow.
- Implement MFA in SSF: rejected because Keycloak owns authentication and Studio already owns realm provisioning.

## Migration and rollout

Add optional recording configuration to Studio's existing JSON schemas. Backfill no automatic enablement. Preserve explicit recording retention where already present; only absent recording retention inherits the new default. Never copy a legacy storage-retention value into recording without an explicit administrative choice. Existing archive expiry and audit-retention rules remain unchanged.

Deliver policy, identity/directory and MFA as independently tested slices. Converge them in two-tenant staging acceptance. Enable one tenant only after archive, keys, recovery ceremony and timestamp service are ready. A rollback disables new recording and preserves existing archives and keys. Use the existing Studio and SSF release procedures.

## Risks and constraints

- Issue #612 has older text-field names and mentions recovery threshold `k`; current `RecordingPolicy` has no `k` field. This plan keeps `k` in the existing SSF recovery ceremony and validates compatibility with the selected recovery mode.
- The published `studio-runtime-integration` and `guest-consent` specs still contain legacy storage behavior; current code/runbooks have retired it. Do not claim those historical specs establish current production state. Reconcile their lifecycle in a separate focused change rather than combining archive history maintenance with this delivery.
- Studio paths were initially inspected at `234eeff76` in a local worktree containing merged legal-text work; the structural paths were subsequently checked against main `7e0d71a8`. Rebase to current Studio main and recheck paths before implementing; an older local Studio checkout lacks the plugin.
- User identities, credentials and private legal wording do not belong in shared fixtures or the plan.

## Approval boundary

The user approved implementation of this reviewed plan on 2026-11-02. This matching Studio proposal records the approved producer obligations; deployment and merge remain separate operations.
