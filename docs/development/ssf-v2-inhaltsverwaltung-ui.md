# SSF administration: navigation, pages and persistence

Status: locally implemented navigation/editor restructuring. Deployment and
functional acceptance are separate. The owning change is
`openspec/changes/refactor-ssf-administration-navigation`; its design preserves the
supplied cross-repository field map and the approved implementation refinements.

## Navigation and authority

The existing Applications section contains the branded Smart Speech Flow or
Kassel DIALOG group. Tenant pages are Overview, Appearance and content, Languages,
Recordings and Feedback at `/plugins/ssf/{overview,appearance,languages,recordings,feedback}`.
Root pages are Installation overview, Default configuration and Default content
at `/plugins/ssf/system/{overview,default-configuration,default-content}`.

The Studio homepage and authorised System administration retain their locations.
Only empty Data management sections disappear; required unrelated modules remain
navigable. Flat plugins keep their current navigation contract. Groups are generic
SDK contributions whose leaves are independently checked for access and module
assignment before composition. Root and tenant presentations follow the active
host scope. Group visibility does not confer authority.

Tenant pages use existing `ssf.configuration.tenant.read/manage` rights. Root uses
existing platform actions. Neither configuration permission grants recording,
reviewer, recovery-custodian or key access. The active host binds the tenant; no
new tenant selector exists.

## Field ownership and initial language creation

| Page                          | Editable content                                                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant Appearance and content | Branding; staff dashboard/load/new-conversation texts; guest explanation                                                                            |
| Tenant Languages              | Staff locale; template guest activation; guest names/icon                                                                                           |
| Tenant Recordings             | Settings and explicit tenant enablement; retention/reset and technical fields; recording wording and independent legal source/version/localisations |
| Tenant Feedback               | Existing staff and guest feedback forms, with supported question controls only                                                                      |
| Root Default configuration    | Template languages/guest metadata; recording behaviour, retention and technical defaults, without tenant activation                                 |
| Root Default content          | Installation branding/legal links/localisation/start/login/feedback and tenant-template texts/branding/recording wording/legal wording/feedback     |

An existing valid runtime template is required. Missing configuration is labelled
explicitly; read failures have retry and are not shown as empty configuration.
Installation content can still be saved independently of an absent template.
When a root administrator adds a guest language, the existing language operation
also collects that new language's mandatory explanation and feedback text. After
saving, these creation-only controls disappear and subsequent content editing is
solely under Default content. This keeps strict existing schemas and does not
invent translations or add an onboarding workflow.

Required current controls, limits, inheritance and reset semantics remain. In
particular, conversation-storage controls stay retired and disabled compatibility
output remains valid. Technical recording fields retain their existing authority.
New wording does not enable recording, implement a quality-session runtime or
constitute legal approval. Existing legal source/import limitations remain binding;
no new translations or approvals are supplied by this change.

## Drafts and languages

Each page owns one save/discard unit, covering every tab and language. Root Default
content includes both Installation and Tenant template tabs in its atomic unit.
Language selectors list actual entries independently for guest content, recording
wording and legal localisations. UI language, staff/installation locale and content
selection remain distinct; changing a locale does not translate text.

Tab/language changes keep drafts. Hidden language errors expose their tab, locale
and collapsed question before focusing the invalid field. Automatic error navigation
runs once per validation result; subsequent manual tab/language choices remain
active while editing until the next save validates again. Read-only users retain
read access without save controls. Failed or stale writes preserve drafts. Success
uses the sanitized committed response. Overview shows effective saved facts only,
including inherited recording retention, without readiness claims.

The existing host editor-leave boundary is explicitly enabled for SSF editing
routes in both Studio distributions. It offers Save/Discard/Stay, guards voluntary
organisation switching before the API call and uses native unload confirmation.
Forced session/context changes suspend drafts; root recovery verifies platform
identity without requesting a tenant organisation context. Existing content-editor
behaviour and unmarked plugin routes retain their defaults.

## Concurrency contract

The current administration endpoints remain:

- `GET/PUT /api/v1/plugins/ssf/content-v2/system`
- `GET/PUT /api/v1/plugins/ssf/content-v2/tenant`

Reads and accepted writes return `X-SSF-Content-Revision`. PUT requires the exact
`X-SSF-Expected-Content-Revision` from the loaded baseline. Missing tokens return
428, malformed/wildcard tokens 400 and stale tokens 412 without writing. Existing
422 validation/affected-tenant conflicts and operational failures remain distinct.
These headers are administrative concurrency tokens, not HTTP representation ETags.
The independently fetched language catalogue is not part of the token.

The hash covers raw installation/template state for root or template plus raw tenant
overrides for the bound tenant. It is separate from effective runtime
`configurationRevision`. Revision comparison, current-state validation and committed
response capture occur under the existing `ssf.content.v2` advisory transaction
lock. Tenant reads obtain template and overrides in a single SQL snapshot.

Page projections change only edited leaves and owned resets. Unchanged explicit
overrides remain explicit even when equal to the template, including within
feedback/legal/media objects and locale/question collections. Do not send a new
partial override object through PUT: it replaces the complete override document.
Do not retry a stale write with a fresh token without explicit user reconciliation.

## Legacy and operations

V1/V2 switches, legacy editors, exclusive browser helpers, administration handlers,
DTOs, view mappers and legacy admin repository helpers are removed. The user
confirmed on 2026-11-12 that there are no existing consumers. The current V2
administration paths are the editing API, and image verification probes those
paths for wrong-scope denial. Runtime service API retirement remains a separate
scope; stored legacy values and runtime compatibility output are not deleted or
silently converted to recording consent.

No schema, data migration, production setting, archive expiry or deployment was
changed. Any later legacy data transfer requires explicit precedence, conflict
handling, repeatability and rollback evidence. Any downgrade must account for the
currently stored JSON schema, including legal text fields.
