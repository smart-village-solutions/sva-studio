# Change: Manage separate SSF consent and recording-release texts

## Why

Kassel's legal counsel supplied distinct user-facing texts for mode 2 (recording), mode 3 (quality sessions), recording releases for guests and staff, and recording status messages on 23 September 2026. The existing SSF editor only provides `guest.storageQuestionHtml`; combining those texts would erase their different purposes and audiences.

## What Changes

- Extend the existing SSF system-template and tenant-content editors with a dedicated legal-text section for these five groups.
- Store a separately identifiable German source and optional translations, including headings, full rich text, choice labels, and status messages.
- Preserve per-field tenant overrides, reset-to-template behavior, permissions, HTML sanitization, and content revisions.
- Add optional structured legal content to the existing v2 runtime response, preserving existing v2 configurations and the current storage question.
- Prepare the counsel's German wording for Kassel, retaining its draft designation and unresolved contact placeholder explicitly.

## Scope

The deliverable is Studio content management and the Studio runtime contract. SSF conversation screens, mode selection, recording control, consent evidence, retention behavior, and activating the new wording in live conversations require consumer implementation and are outside this change. Saving text MUST NOT enable recording or imply that these functions already exist.

## Impact

- Affected specification: `ssf-content-v2`, extending the implemented `add-ssf-content-v2` change.
- Affected code: `packages/plugin-ssf` content contracts, resolver, overrides, repository validation, editors, translations, and tests; existing runtime JSON schema and example.
- Affected documentation: SSF content-editor documentation and arc42 sections 05 and 08.
- Persistence: reuse existing `runtime_content_v2` JSON columns; no new database table or service.
- Deployment: prepare and validate the implementation first; use the repository's established rollout process for production.

## Approval

Status: approved by the user on 31 October 2026. Implementation follows `design.md` and `implementation-plan.md`.
