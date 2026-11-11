# SSF administration design and implementation-entry evidence

## Baseline and authority

Inspected on 2026-11-11. Owning Studio source baseline:
`a7239655f2bfa851a06e6888c144f4eb4cf80731` (local `origin/main`).
The starting checkout `870bb4674` was on the unrelated coverage-fix branch.
The proposal is isolated on `docs/ssf-administration-navigation` from local
`origin/main`; pre-existing untracked reports were preserved. No remote refresh
or live inspection was performed. Recheck the implementation base before coding.

The complete supplied design is retained below as the functional acceptance
baseline. Its SSF-side relative links are recorded as external source references,
not assumed to resolve in Studio. This section resolves the implementation-entry
checks; the quoted design's earlier inspection baseline is historical context.
The following source audit records the proposal baseline; implementation approval
and subsequent decisions are recorded in the next section.

## Approved implementation refinements (2026-11-11)

The user approved local implementation, with particular protection for normal
Studio behaviour. Two subsequent user decisions resolve the strict aggregate
initialisation constraint:

- An existing valid SSF runtime template is a prerequisite. These pages do not
  initialise an absent runtime template; root shows an explicit explanation.
  Installation content remains independently editable.
- Adding a new root guest language collects its mandatory initial explanation
  and feedback content on Default configuration using the existing controls.
  This is creation-only: after the aggregate saves successfully, those text
  controls disappear there and subsequent text editing belongs solely to Default
  content. No draft persistence, permissive schema, invented translation or
  publication workflow is introduced.

Legacy UI, its exclusive browser helpers, old administration HTTP handlers,
DTOs, view mappers and repository helpers are removed. On 2026-11-12 the user
explicitly confirmed that there are no existing consumers, resolving the earlier
consumer-inventory prerequisite for administration retirement. Image deny probes
use V2. No legacy storage or authored values are deleted or migrated. Service API
retirement remains distinct from editor/admin-API retirement and is not added to
this change.

Implementation reference search used local XERJ `studio-code` and `payload-code`.
The Studio index reported revision `60059753b...`, older than this implementation
baseline; current source, including the invitation-template expected-revision
pattern, was checked directly. No third-party implementation was copied.

## 1. Navigation depth

Evidence:

- `packages/plugin-sdk/src/plugin-definition-types.ts:61`: `PluginNavigationItem`
  has a target, title, section and access metadata, but no group relationship.
- `packages/plugin-sdk/src/plugin-registry-routes.ts:31`: the navigation key
  allowlist rejects undeclared fields; lines 163–228 validate each flat item.
- `apps/sva-studio-react/src/components/sidebar-model.ts:24`: the shell already
  models a group with leaf children. `sidebar-primary-items.tsx:40` resolves
  plugin items to flat links and filters by access/module before composition.
- `packages/plugin-ssf/src/descriptor.ts:123`: only two SSF pages currently exist;
  system navigation lives under System and tenant navigation under Applications.
- `apps/sva-studio-react/src/components/sidebar-sections.ts:17`: Data management
  is already omitted when no required item survives filtering.

Decision: retain a flat registry with an optional, same-plugin application-group
reference on leaf items (proposed shape: `group: { id, titleKey }`). This is the
smallest extension for one group level; no arbitrary tree or nested framework.
Validate owned group IDs, identical group metadata, same section and same access
scope, valid leaf targets/actions, and forbid header grouping. Existing flat
plugins remain valid. Filter each leaf first, then form non-empty groups. A group
never confers access. No duplicate group with mixed root/tenant leaves, even for a
principal holding both roles; tenant context selects tenant presentation and
root context selects root presentation without expanding server rights.

Application title comes from existing host branding for both root and tenant
SSF groups; all other group metadata remains generic. Replace the existing
SSF navigation-title special case coherently, including action-title precedence,
so task labels are not replaced by permission names. Do not add SSF child routes
to host code. Module ownership must remain resolvable through the current registry.

Proposed addressable routes (confirm against registry validation in implementation):

| Scope    | Route ID                         | Path                                      | Existing access    |
| -------- | -------------------------------- | ----------------------------------------- | ------------------ |
| Tenant   | ssf-tenant-overview              | /plugins/ssf/overview                     | tenant read        |
| Tenant   | ssf-tenant-appearance            | /plugins/ssf/appearance                   | tenant read/manage |
| Tenant   | ssf-tenant-languages             | /plugins/ssf/languages                    | tenant read/manage |
| Tenant   | ssf-tenant-recordings            | /plugins/ssf/recordings                   | tenant read/manage |
| Tenant   | ssf-tenant-feedback              | /plugins/ssf/feedback                     | tenant read/manage |
| Platform | ssf-system-overview              | /plugins/ssf/system/overview              | platform access    |
| Platform | ssf-system-default-configuration | /plugins/ssf/system/default-configuration | platform access    |
| Platform | ssf-system-default-content       | /plugins/ssf/system/default-content       | platform access    |

Tenant read/manage mean existing `ssf.configuration.tenant.read` and
`ssf.configuration.tenant.manage`. Root keeps existing platform access and
`ssf.configuration.system.read/manage` action binding. Direct-route checks and
API dispatcher checks remain independent. Update existing route references,
settings/help/breadcrumbs and tests with the route replacement. Old configuration
URLs may redirect to the matching overview if needed for existing links; a
redirect must never render or preserve a legacy editor.

### App-menu finding and baseline drift

Unlike the earlier inspected checkout and screenshot, the refreshed local-main
source already gates the App group on `showGenericApplicationLinks`
(`sidebar-primary-items.tsx:237`). Kassel branding sets this flag to false
(`lib/studio-branding.ts:19`). This is code evidence, not proof of the deployed
screenshot being fixed. The supplied design additionally requires unrelated
modules to remain navigable: review this broad gate and existing content-branding
filters against actual required modules rather than blindly retaining or removing
them. Explicitly authorised App/media modules must remain discoverable; no module
assignment is changed here. The screenshot's unresolved `appTranslations.ui.sourceTitle`
is a separate translation-loading symptom; check the owning resource path if that
entry is included, without claiming a root cause from the screenshot alone.

## 2. Field audit

`admin.content-v2-runtime-fields.tsx` owns StaffFields (line 31), recording controls
(line 74), and guest membership/content/feedback (lines 128–269).
`admin.content-v2-fields.tsx:52` owns branding, line 90 feedback and line 125
installation content. `admin.content-v2-legal-fields.tsx` owns legal source/version,
localisation membership and the five legal groups. The complete target ownership
map below matches these controls and `content-v2-contracts.ts`.

Important reconciliation details:

- Guest metadata, explanation and feedback are currently edited together; splitting
  them needs locale-based projection updates, not replacement of guest arrays.
- Staff locale moves to Languages/Default configuration; staff texts move to
  Appearance/Default content. Neither appears in both editors.
- Recording settings, retention, technical fields, recording wording and legal
  wording remain available to current configuration managers, including while
  disabled. No archive/reviewer/custodian rights are inferred or altered.
- Root Default content is one save unit across Installation and Tenant template
  tabs, although these are different persistence columns. Both must commit or
  neither may commit. Default configuration owns only template behaviour.
- Existing branding reset, field reset and retention reset must remain. Preserve
  explicit override provenance; do not normalise another page's overrides away.
- `content-v2-overrides.ts:18` merges language/question collections by locale/id;
  `diffSsfContentV2` currently recomputes the whole override aggregate. Reuse its
  semantics within the owned projection, preserving the raw unrelated overrides.
- Feedback has five supported editable IDs, preserving other valid question IDs,
  question types, numeric bounds and non-editable data. Do not loosen strict Zod
  contracts to accept arbitrary unknown JSON properties. “Unknown supported” means
  data accepted by existing contracts but not exposed by this editor.
- Existing limits: 1–30 guest languages, staff primary language excluded from guests;
  1–30 legal localisations with a source member; at most 40 recording wording entries;
  unique locale/question IDs. Recording retention 1–8760 integer hours, default 720;
  audit retention positive safe integer and not below effective recording retention.
  Keep existing text, HTML, URL, size and supported-language validation unchanged.
- `conversationContentStorage` and `guest.storageQuestionHtml` are compatibility
  fields, not editable fields. `effectiveSsfRuntimeFieldsV2` forces disabled/null
  output. No editor is reintroduced for them.

## 3. Persistence and concurrency decision

Evidence:

- `content-v2-admin-contracts.ts:34–59`: GET views and PUT inputs have no concurrency
  precondition. System null means “do not replace this column”, not delete it.
- `content-v2-repository.ts:76–148`: root writes share one transaction/advisory lock
  and reject a template invalidating existing tenants, but replace whole JSON columns.
- `content-v2-repository.ts:150–179`: tenant writes use the same lock and replace all
  raw overrides. A later stale request can overwrite an earlier committed request.
- `server/content-v2-admin.ts:150–210`: prior-state locale validation happens outside
  the write transaction; response rereads happen after the write. Neither proves
  atomic validation or a matching saved response.
- `repository.transaction.ts:24`: tenant transaction binds `app.instance_id`; retain
  RLS and server-derived tenant context. GET's multiple SELECTs need one consistent
  snapshot when generating a revision for template plus overrides.

Chosen extension: keep existing GET/PUT routes and add dedicated `X-SSF-Content-Revision` response and
`X-SSF-Expected-Content-Revision` request headers for administration only. These
are application concurrency tokens, not HTTP representation validators. The
independently fetched `supportedLanguages` catalogue is excluded from the token;
its availability must not pretend that the stored aggregate has changed. Hash canonical raw stored JSON with existing
canonicalisation/hash dependencies; distinguish null from an empty object and bind
scope/tenant identity. A root token covers installation plus runtimeTemplate; a
tenant token covers runtimeTemplate plus that tenant's raw overrides. Do not reuse
the effective runtime `configurationRevision`: equal effective values can have
different explicit overrides, and runtime output omits administrative state.

GET returns data and its revision from one snapshot. PUT requires one exact revision
token (`428` missing; `412` stale; malformed or wildcard tokens rejected without a
write). Under the existing `ssf.content.v2` transaction lock, read current storage,
compare the token, validate locale/membership and the merged candidate against that
same current state, sanitize, persist and capture the resulting saved view/token
before releasing the lock. Keep current `422` validation and affected-tenant
conflicts distinct from stale `412`; operational failures remain errors. Every
supported writer of these JSON columns must participate; inventory direct SQL,
imports and tests before claiming this invariant.

The browser retains the loaded raw aggregate plus page draft. Build the complete
PUT payload by applying only the page's owned edits/resets to that loaded aggregate;
other page-owned values and explicit overrides remain byte-for-byte equivalent as
JSON values. Membership changes belong only to Languages; reset deletes only the
owned override and retains unrelated locale fields. Default content can update
both root columns in one existing transaction. Do not silently retry a stale PUT
with a freshly acquired token. Preserve the draft, report the conflict and let the
user explicitly reload/discard or reconcile against the new saved state. A concurrent
change on a different page may also cause a conservative conflict; automatic
non-overlapping merge is intentionally outside this design.

Rejected alternatives: client-only fresh read/merge/write still races; a per-section
PATCH API adds another contract without being necessary for safety; revision
columns add migrations when content hashes of current aggregates suffice. Existing
transaction locking remains the serialization boundary. No new database service,
store, or lock layer is introduced. Content-hash semantics detect changed state;
an ABA change returning to identical stored state is an intentional no-conflict.

## 4. Leaving an edited page

Evidence: `studio-ui-react/src/studio-editor-leave-guard.tsx:36` already exposes dirty
registration, save revision acknowledgement and suspension. Host
`routing/content-editor-leave-boundary.tsx:43` already protects pathname navigation,
browser unload and session recovery, with Discard/Stay at line 177.
`app-plugin-view-adapter.tsx:83` mounts it for content views; SSF directly contributes
route components in `plugin.tsx` and is not connected to that boundary.

Reuse these existing modules. Extend the shared registration minimally with a
page save/discard callback and in-flight state. Add an opt-in generic route marker
for editor-boundary composition (proposed `editorLeaveGuard: true` on
`PluginRouteDefinition`, including descriptor/allowlist handling). Mark the six
editing routes only; the host mounts the boundary through its existing route
composition, without importing router APIs into `plugin-ssf` or hardcoding SSF IDs.
No automatic remount is permitted to destroy a dirty page during host context
switching. The existing owner `apps/sva-studio-react/src/hooks/use-organization-context.ts:78–111`
currently calls `updateMyOrganizationContext` directly. Extend that existing host
context transition path to confirm before invoking the server mutation; the route
boundary alone cannot protect this operation. For forced auth/scope changes, suspend and
retain the draft, deny writes and resume only after the original context is
confirmed. Do not add a parallel navigation interception layer.

Save/Discard/Stay must guard pathname changes, back/forward and voluntary tenant/
organisation changes. Save proceeds only after successful save acknowledgement;
failed validation, conflict or network write retains the page and draft. Discard
resets the whole page; Stay changes nothing. Refresh/tab close use the native
beforeunload confirmation (browsers do not support custom three-button dialogs).
Tabs and language selection are in-page state and do not trigger this guard.
Unregister on clean unmount; reuse suspension to prevent cross-context writes.
Explicitly test that Stay and failed Save cause zero `updateMyOrganizationContext`
calls; successful Save or Discard permits exactly one requested switch.

## 5. Legacy dependency inventory and retirement

This is the historical proposal inventory. The consumer uncertainty below was
resolved by the user on 2026-11-12 as recorded above; obsolete administration
dependencies are now removed. No data deletion or service API retirement occurs.

| Path                                                                                                         | Evidence / required treatment                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin.tenant-page.tsx:30,126`, `admin.system-page.tsx:21,64`                                                | Active V1 editors and V1/V2 switches; replace, retaining current V2 editor logic in the new page owners.                                                   |
| `admin.configuration-fields.tsx` (including locale controls), `admin-api.ts:42–78`, `admin.editor-labels.ts` | V1 controls/browser calls; remove exclusive exports only after import review. Rich-text labels may be shared with V2 and must remain if used.              |
| `descriptor.ts:199,234–254`, `server/index.ts:124–196`                                                       | Legacy browser GET/PUT handlers and route read bindings; rebind new UI routes to V2 reads, update internal consumers, then remove obsolete admin handlers. |
| `admin-repository.ts`, `admin-service.ts`, `admin-contracts.ts`                                              | Review individual exports: shared action IDs or runtime helpers cannot be removed with UI-only code.                                                       |
| `scripts/ci/verify-studio-image.sh:774–775,812`                                                              | Real legacy admin GET consumer for deny tests. Point to V2 and keep equivalent tenant/platform deny evidence before deleting old paths.                    |
| `server/index.ts:103`, `repository.overrides.ts:25`                                                          | V1 service still reads separate legacy settings/locales; do not drop these storage columns/tables just because browser editors disappear.                  |
| `constants.ts:2`, `openapi.ts:24`, `scripts/ops/ssf-runtime-service-client.sh:7`                             | V1 runtime contract and service action remain published; distinguish runtime and admin endpoint retirement.                                                |
| local SSF worktrees listed below                                                                             | V1 service client references exist; no proof all supported consumers use V2. Preserve required service contract.                                           |
| existing SSF tests and translations                                                                          | Retire V1 UI tests/keys only when exclusive; keep runtime compatibility/authorization tests. Update documentation/help bindings with route changes.        |

Cross-repository read-only evidence: local
`smart-speech-flow-worktrees/fix-studio-permission-auth` at `3ca6aa0`,
`services/api_gateway/studio_runtime_client.py:24`, and
`441-gateway-selector-pin` at `89b0abe`, same file line 23, use
`/internal/plugins/ssf/v1/runtime-configuration`. These older checkouts establish
that a blanket V1 deletion is unsafe; they do not establish deployed usage.

Retirement condition: browser writers and internal checks are migrated; inventory
supported runtime consumers and stored authored values. Remove legacy editors in
the same delivery as the new pages; retain service persistence where still read.
If legacy-only authored data is present, stop destructive retirement until a
value-by-value precedence/mapping is approved. Multiple legacy staff-language
texts cannot be collapsed into one staff locale by guessing. Never map obsolete
storage consent into recording consent or silently replace existing V2 content.
For each retained V1 consumer, record whether its configuration is intentionally
frozen compatibility data or must reflect future administrative edits. Where
ongoing edits are required, migrate that consumer to V2 or prove an explicit
compatible projection/mapping before removing its last writer. Merely retaining
an endpoint and its rows does not preserve recurring administration. There is no
hidden legacy editor or speculative dual-write synchroniser as a fallback.
A required migration must be idempotent, report conflicts without copying private
content into logs, and have tested backup/rollback. No speculative migration is
created by this planning change. Live inventory is pending because no live-system
access was authorised for these source checks.

## Critical invariants and planned evidence

| Invariant                   | Failure mode                                                       | Required implementation evidence                                                                                             |
| --------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Existing scope/authority    | Root gains tenant/recording rights via group visibility            | route + dispatcher wrong-scope deny tests; read-only manager matrix; no permission projection changes                        |
| Page ownership              | Saving feedback overwrites language metadata/explanation           | full fixture round-trips per page; untouched raw overrides and supported question data preserved                             |
| Atomic revision check       | Two stale PUTs serially succeed despite lock                       | real PostgreSQL two-client stale-write test; one succeeds, stale one gets 412; template-vs-tenant and root page races        |
| Matching readback           | Another writer's data/token treated as this save                   | transaction-bound response tests; post-save UI baseline uses returned sanitized data                                         |
| Inheritance                 | Page diff pins or deletes another page's override                  | explicit equal overrides, reset, nullable/absent values and inherited template update cases                                  |
| Draft integrity             | Hidden locales lost; failed save proceeds; context switch remounts | language/tab tests, invalid hidden locale focus, failed Save/Stay/Discard and forced-session suspension tests                |
| Recording policy            | Defaults enable recording or retention edit changes archives       | existing recording/contract regressions, effective retention/reset/conflict fixtures; no archive write path                  |
| Legacy consumers            | Deleted handler breaks smoke/service or authored values disappear  | updated image deny checks; static reader/writer inventory; SSF contract regression; migration proof only if data requires it |
| Honest overview             | Read failure shown as empty/healthy                                | distinct loading/retry/error/unconfigured tests and saved-value links                                                        |
| Preserved modules/i18n/a11y | Branding hides valid unrelated module; inaccessible child routes   | SSF-only + mixed-module desktop/mobile navigation; direct refresh, focus/keyboard, DE/EN rendered labels                     |

## Delivery and documentation

1. Existing API/repository gets revision protection with focused tests before
   page restructuring; existing browser writers must send preconditions together.
2. Generic navigation and existing leave boundary are extended and tested with
   existing flat plugins and SSF as the immediate consumer.
3. Tenant and root pages reuse current field components and implement the ownership
   map; remove replaced aggregate/legacy UI in that same delivery section.
4. Retire old admin APIs after consumer updates; keep required service/storage paths
   and record the explicit remaining consumer/removal condition.

These are implementation order constraints, not a mandatory stack of PRs. No
intermediate page is exposed before persistence and draft protection are proven.
Update arc42 05/06/08, current SSF administration/reference docs, route help and
relevant user documentation with actual implementation. Keep 04 authority choices
unchanged; add an ADR/09 entry only for a new architecture decision that survives
review. Inspect `docs/development/studio-db-schema-final.sql`,
`studio-db-schema.md` and the separate `ssf-plugin-db-schema-final.sql` before any
migration; update the relevant snapshot if a schema change becomes necessary.

## Proposal review disposition

Planning reviews covered Architecture/Documentation/Code Quality,
Security/System Assurance/Interoperability/Logging, and UX/Accessibility/i18n/
User Journey/Test Quality using the repository reviewer instructions. Three
concrete corrections were incorporated:

1. Use dedicated revision headers instead of a strong representation ETag, since
   the response also includes an independently fetched language catalogue.
2. Name the organisation-context mutation owner and require zero-call/one-call
   assertions for guarded switches; a route wrapper alone is insufficient.
3. For retained V1 consumers, prove either intentional frozen compatibility or a
   future-edit mapping/consumer migration before removing the last writer.

No unresolved proposal-design blocker remained from these planning reviews.
Implementation approval, user confirmation of absent consumers, and the completed
local checks are recorded separately; this planning review itself is not runtime
or live-system evidence.

## Local implementation evidence (2026-11-12)

Implementation branch: `feature/ssf-administration-navigation`, based on
`a7239655f2bfa851a06e6888c144f4eb4cf80731`. These checks cover the local working
changes, not a published commit or remote CI result.

- `pnpm nx run plugin-ssf:test:unit`: 223 passed, 15 PostgreSQL-only cases skipped
  in the ordinary unit run. Coverage includes revision headers/conflicts, page
  ownership, equal override pins, whole-media resets followed by edits, language
  drafts, root guest-language creation, error focus, translations and runtime
  recording/legal contracts.
- `pnpm nx run plugin-ssf:test:integration`: all 15 passed against ephemeral real
  PostgreSQL. Two-client stale-write races, template/tenant races, root writes,
  RLS, conflict rollback and unchanged data on rejected writes are included.
- Targeted existing Studio suites: Sidebar 57, route bindings 37, leave boundary
  15, organisation-context hook 13 and shared editor guard 8 tests passed.
  SDK registry/group validation: 16 passed. The route marker is opt-in, flat
  plugin navigation stays supported, and refused context changes cause no write.
- Plugin and application type gates, script TypeScript, server-runtime checks,
  plugin UI/architecture boundaries, documentation and file-placement checks
  passed. Architecture checking retains its existing advisory path signals.
  Targeted ESLint reported zero errors and 43 warnings, primarily test non-null
  assertions; no warning threshold was relaxed.
- Isolated Playwright rendering used actual SSF page components and Studio CSS
  with synthetic API fixtures. Five desktop/mobile screenshots were inspected;
  there were no browser errors, unresolved translation keys or horizontal page
  overflow at 390px. Tabs wrap and language controls use labelled native selects.
  This is component-level visual verification, not authenticated full-app or live
  tenant verification. No shared visual baseline was changed.
- Strict OpenSpec validation and `git diff --check` passed. Current documentation,
  arc42 05/06/08 and generated route-help catalogue reflect the eight new pages.

Surface review: extended the existing SDK navigation metadata, existing shared
leave protection and current SSF controllers/fields/repository. Removed legacy
administration endpoints, three exclusive source files and their obsolete unit
suites; added no package, service, schema, migration or alternate editor path.
The six OpenSpec files are the already approved owning change. Existing unrelated
reports and local environment configuration remain untouched.

No account, remote service, production setting, stored legacy value or archive
was changed. No PR, deployment, live verification or functional acceptance is
claimed. An existing valid runtime template is required as approved by the user.

## Supplied cross-repository functional design

The following design was supplied by the user on 2026-11-11. Its functional field
map and acceptance criteria are retained; the evidence and decisions above apply
to the current Studio baseline. Referenced SSF documents below live in the SSF
repository and were not all revalidated during this source audit.

## SSF Studio administration: navigation and page design

### Status and ownership

Design for review, dated 2026-11-11. The user requested this specification
after agreeing the direction below. This document does not authorize runtime
implementation or claim that the proposed UI is available in production.

The implementation belongs primarily to the Studio repository. This SSF-side
document records the agreed cross-repository design. Before implementation,
Studio must carry the owning OpenSpec proposal and obtain its approval. The
existing recording-administration change is context, not approval for this
navigation and editor restructuring.

### Objective and decisions

Make existing SSF administration understandable to an organisation administrator
without adding business capabilities.

- Use the same pages and actions for initial setup and recurring administration.
- Keep Studio's Applications and System sidebar sections.
- Use the existing application branding: Smart Speech Flow or KasselDIALOG.
- Remove the Data management section from the SSF presentation only when it has
  no required entries; preserve unrelated modules and their navigation.
- Separate installation/root administration from tenant administration.
- Reorganise existing fields; reuse Studio UI components and existing authority.
- Remove legacy administration rather than retaining a compatibility editor.
- Give multilingual editors one consistent language-selection pattern.
- Keep one editing location for each field in each scope.

There is no setup wizard, separate onboarding checklist, publication workflow,
new preview, translation service, readiness monitor, reporting UI, archive UI,
or key-management UI in this change. Overview pages only present existing
configuration and links. Their summaries are a presentation change, not a new
source of operational status.

### Evidence and limitations

The inspected Studio source is the local `studio-recording` worktree at
`26592bc4f`. It is an inspection baseline, not evidence of deployed state.
Recheck its successor before implementation.

Relevant Studio paths, relative to that repository:

| Source                                                                                  | Existing responsibility                               |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `packages/plugin-ssf/src/admin.tenant-page.tsx`, `admin.system-page.tsx`                | Current/legacy page tabs and access composition       |
| `packages/plugin-ssf/src/admin.content-v2-tenant-page.tsx`, `admin.content-v2-page.tsx` | Loading, editing, validating and saving content       |
| `packages/plugin-ssf/src/admin.content-v2-runtime-fields.tsx`                           | Staff, guest-language and recording fields            |
| `packages/plugin-ssf/src/admin.content-v2-fields.tsx`                                   | Branding, installation content and feedback editors   |
| `packages/plugin-ssf/src/admin.content-v2-legal-fields.tsx`                             | Legal source locale, version and localisations        |
| `packages/plugin-ssf/src/content-v2-admin-contracts.ts`, `admin-api.ts`                 | Existing aggregate read/write contracts               |
| `packages/plugin-ssf/src/content-v2-overrides.ts`                                       | Effective values and tenant override comparison       |
| `packages/plugin-ssf/src/descriptor.ts`                                                 | Scope-bound routes, permissions and plugin navigation |
| `apps/sva-studio-react/src/components/sidebar-primary-items.tsx`                        | Plugin navigation composition and branding            |
| `packages/studio-ui-react/src/studio-page-templates.tsx`                                | Existing overview/detail templates and form actions   |

Related SSF documents:

- Control-plane boundaries (SSF repository: `../../architecture/sva-studio-control-plane.md`).
- Recording administration plan (SSF repository: `../plans/2026-11-02-studio-recording-settings.md`).
- Recording producer obligations (SSF repository: `../../../openspec/changes/add-studio-recording-administration/specs/studio-runtime-integration/spec.md`).
- Legal wording consumer behaviour (SSF repository: `../../guides/studio-recording-legal-texts.md`).

### Navigation and scope

Tenant sidebar, with translated labels:

```text
Overview
Applications
  Smart Speech Flow / KasselDIALOG
    Overview
    Appearance and content
    Languages
    Recordings
    Feedback
System
  Existing authorised tenant administration entries
```

Root sidebar:

```text
Overview
Applications
  Smart Speech Flow / KasselDIALOG
    Installation overview
    Default configuration
    Default content
System
  Tenants and existing authorised root administration entries
```

The application label comes from existing branding, not a new editable name.
Preserve the Studio overview and its existing functions. The SSF overview is
application-specific; this change does not merge or replace the Studio homepage.

Users, roles/groups and authentication settings remain in their existing Studio
locations and retain existing permissions. Link to them where useful and
authorised; do not create duplicate SSF editors or assume they all already have
standalone routes named exactly as this conceptual grouping.

Root permissions do not confer tenant rights. Tenant configuration rights do
not confer recording, reviewer or recovery-custodian rights. The active host
context supplies the tenant; no additional SSF tenant selector is introduced.

Nested application navigation is the target presentation. Verify SDK and shell
support before selecting route IDs. If insufficient, extend the generic plugin
navigation contract and shell together in the Studio proposal; do not hardcode
SSF children into the shell. Every page must have an addressable route, active
navigation indication and the existing server-side access checks.

### Shared page layout

Reuse `StudioOverviewPageTemplate` or `StudioDetailPageTemplate`, `StudioSection`,
`StudioField`, the existing rich-text editor, tabs, buttons, loading/error states,
form summaries and action bars from `studio-ui-react`.

Each editable page has a title, short purpose, named sections, applicable
language selection and its own Save / Discard changes actions. Preserve
read-only access for users who can read but cannot manage configuration.
Retain existing validation limits and allowed values. Navigation names must
describe user tasks; wire-contract names such as V1, V2 and runtimeTemplate
are not regular UI labels.

Use tabs for the groups below, and the existing collapsible sections for long
question/text groups. Language selection uses one consistently labelled select
per multilingual editor rather than nested language-tab strips. Use existing
spacing, typography, focus states and error styling. Do not encode state only
by colour.

### Tenant pages and field ownership

The paths below refer to the effective current runtime content model. Root
template editing uses the same paths inside `runtimeTemplate`.

#### Overview

Read-only sections link to the four editing pages. Show existing branding,
staff locale, configured guest locales, recording enablement/retention and
existing feedback forms by audience. Derive these from the same saved values
used by the editors. Do not copy configuration into a separate overview store.

Recording enablement means configured enablement, not verified archive/key or
runtime availability. Missing configuration is labelled not configured; a read
failure is an error with retry, not an empty or healthy configuration. Do not
add readiness badges, missing-translation scores or administrative approvals.

#### Appearance and content

| Tab        | Fields owned here                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Appearance | `branding.logo`, `branding.icon`: URL and alternative text                                                                                                                    |
| Staff      | `staff.dashboard.headline`, `explanationHtml`, `callToAction`; `staff.dashboard.load.headline`, `green`, `yellow`, `red`; `staff.newConversation.headline`, `descriptionHtml` |
| Guests     | `guestLanguages[locale].guest.explanationHtml`, selected by existing guest locale                                                                                             |

Do not duplicate staff locale, guest activation, legal wording or feedback
editing here. Tenant users do not gain installation legal-link or public
start/login editing rights.

#### Languages

| Section                 | Fields and actions owned here                                                    |
| ----------------------- | -------------------------------------------------------------------------------- |
| Staff language          | `staff.locale`, using the existing supported-language catalogue and restrictions |
| Guest languages         | Existing template language activation/deactivation                               |
| Selected guest language | `nativeName`, `staffName`, `icon.url`, `icon.alternativeText`                    |

Preserve current limits, at-least-one-language rules and staff/guest exclusions.
Tenant activation remains constrained by existing template capabilities; the
page does not introduce arbitrary new tenant languages. Explain this as SSF
language/content configuration, not a control over installed translation models.

#### Recordings

| Tab                              | Fields owned here                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Settings                         | `recording.enabled`, `legalBasis`, `signature`, `idCheck`, `verificationRequired`, `recoveryMode`                         |
| Retention and technical settings | `recording.retentionHours`, effective retention and existing reset action; `auditRetentionHours`, `timestampAuthorityUrl` |
| Consent and releases             | Existing `recording.texts` entries (`locale`, `consentHtml`, `resumePromptHtml`); the separate `legalTexts` editor        |

Keep technical fields editable wherever current permissions allow them. Moving
them to root-only administration would be an authority change outside scope.
Keep current retention units and numeric constraints; a days/hours conversion
editor is not required. Defaults never enable tenant recording.

Within Consent and releases, distinguish the two existing contract groups:

- Recording wording: existing locale entries and add/remove actions.
- Legal wording: `sourceLocale`, `version`, localisations and their existing
  `mode2Consent`, `mode3Consent`, `guestRecordingRelease`,
  `staffRecordingRelease`, and `recordingStatus` groups. Choice groups retain
  headline, body and affirmative/refusal labels; status retains its four texts.

Do not merge these storage models or infer that quality-mode wording implements
a quality-session runtime. Preserve the existing source-locale and localisation
creation/removal constraints. Keep all text fields editable when recording is
disabled so administrators can prepare configuration.

#### Feedback

Staff and Guests tabs edit `staff.feedback` and
`guestLanguages[locale].feedback`, respectively. The Guests tab selects an
existing guest language. The form contains its existing headline, supported
question text/headline, required flag, applicable scale labels, free-text
placeholder/maximum length, `noticeHtml` and button label.

Reuse the existing supported question IDs and controls. Do not add question
creation, deletion, reordering, new types or response analytics. Preserve fields
that the current editor cannot edit when saving the surrounding form.

### Root pages and field ownership

#### Installation overview

Summarise existing `installation` and `runtimeTemplate` configuration and link
to the two root editing pages. Present installation branding/locale, template
languages and retention as configuration facts. Tenant lifecycle, provisioning
jobs and plugin activation remain in their existing System/tenant-detail views.

#### Default configuration

Edit the behavioural parts of `runtimeTemplate`:

- Languages: `staff.locale`; existing guest-language add/remove controls;
  guest `nativeName`, `staffName` and `icon`.
- Recording settings: the same settings as the tenant page except tenant
  activation, which has no root-template activation control.
- Retention and technical settings: `retentionHours`, `auditRetentionHours`,
  `timestampAuthorityUrl` and existing validation/conflict handling.

Root language add/remove uses the existing catalogue and actions; removing an
entry keeps the existing semantics for its dependent content. This is not a
new independent language catalogue. Do not alter existing archive expiry dates.

#### Default content

Two top-level tabs separate the existing persistence scopes:

| Tab             | Sections and field ownership                                                                                                                                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installation    | `installation.branding`; `legal.imprintUrl`, `privacyPolicyUrl`, `accessibilityStatementUrl`; `localization.locale`, `startpage.enterCode`, `send`, `login`; `localization.login.headline`, `descriptionHtml`; `localization.feedback` |
| Tenant template | `runtimeTemplate.branding`; staff dashboard/new-conversation texts; guest explanation texts; recording/legal wording; staff and guest feedback forms                                                                                   |

Use the same named sections and field components as tenant editing. Template
staff locale and guest-language membership are edited only in Default
configuration. Installation locale stays here because it belongs to the
installation's single localisation object. Installation and template branding
remain separate values, labelled by their actual scope.

### Language switching

Studio UI locale, selected content locale and SSF configured languages are
separate concepts. Changing content locale changes only the displayed editor.

1. Place a labelled Language version selector above each multilingual group.
2. List actual entries using human-readable names and locale codes. Preserve
   an existing locale in the selector even if the current catalogue lacks it.
3. Switch all fields in the selected group together, keyed by locale rather
   than array position. Reordering must not attach a draft to another language.
4. Keep all language drafts in memory until the page is saved or discarded.
5. Save includes every edited language on that page, including hidden ones.
   Validation errors identify their language and expose the relevant editor.
6. Discard resets the entire page, including every language and tab.
7. On initial load select the legal source locale for legal wording; for other
   collections select the first available entry. Retain the selection while it
   exists during editing; after removal select the source/first remaining entry.

There is no global cross-page content-language setting. Guest content,
recording wording and legal localisations have independent memberships. A
runtime fallback must never be displayed as an authored translation. Existing
source-language behaviour stays unchanged.

Staff content and installation localisation currently each have one configured
locale, not a collection of translations. Show that locale; do not add a
multilingual switch that implies otherwise. Selecting another configured locale
does not translate the existing text. Locale fields themselves keep their
existing editing locations and semantics.

Adding/removing recording wording remains available as today. Its locale-entry
field remains editable; the selector navigates existing entries and must still
allow selection of an unfinished entry with a missing locale so it can be fixed.

### Drafts, persistence and conflicts

The UI is split into pages; the existing content aggregates are not split into
new databases or domain services. Existing endpoints remain the initial reuse
target:

- `/api/v1/plugins/ssf/content-v2/tenant` for template/overrides reads and
  tenant override writes.
- `/api/v1/plugins/ssf/content-v2/system` for installation/template operations.

Each editing page owns a defined projection of the aggregate. Save and Discard
apply to that whole page, including its tabs and languages. Moving between its
tabs/languages does not save, reload or reset the draft. Overview shows saved
values only. No cross-page draft workspace or autosave is introduced.

For navigation away from an unsaved page, use an existing Studio unsaved-change
guard if available. Otherwise add the minimal shared Save/Discard/Stay guard
needed for the new page boundaries, including context changes; do not silently
discard work. This is editor integrity, not a new business workflow.

Save must preserve unrelated content, unknown supported fields, template
inheritance and tenant overrides. Editing a guest collection on one page must
not replace its explanation/feedback values from an old snapshot. Restore the
draft from the successful server response; preserve it after a failed write.
Existing tenant-invalidating template conflicts must remain visible.

The inspected DTOs expose aggregate writes without an explicit concurrency
precondition. A client-only read/merge/write cannot guarantee protection from
concurrent updates. Before implementation, the owning proposal must verify
server transaction/concurrency semantics and select either an existing atomic
update mechanism or the smallest required revision-precondition/section-update
extension. Stale conflicting writes must be rejected without losing the draft;
unrelated fields must not be overwritten. Do not claim this guarantee from a
fresh client read alone.

### Legacy retirement

Remove V1/V2 selection, legacy tabs, legacy editors and their exclusive UI
translations, browser API helpers and admin handlers after dependency review.
Do not provide a hidden compatibility editor.

Before removing storage or an endpoint, identify its active writers and readers.
If legacy-only values are still used, map them explicitly into the current model
with documented precedence and an idempotent migration. Preserve authored texts
and tenant-specific choices; surface an unmappable conflict rather than silently
discard it. If no live dependency exists, remove the obsolete path directly.

Retirement of a browser administration API is distinct from retirement of an
SSF service runtime API. Keep a service endpoint or compatibility field while a
supported consumer requires it. In particular, retired conversation-storage
controls must not be restored, and required disabled compatibility output must
remain valid. No runtime API removal is implied by removal of its editor.

### Acceptance criteria

1. Tenant and root navigation use the agreed Applications/System structure and
   existing branding. Unrelated module navigation still works.
2. Direct routes, active navigation, refresh and keyboard navigation work;
   server authorization rejects wrong-scope access regardless of visibility.
3. Every current editable field has exactly one editing location per scope,
   as mapped above. No legacy editor or version-selection tab remains.
4. No configuration right automatically grants recording or key access.
5. Existing valid configuration renders and round-trips without changing runtime
   responses, except for deliberate administrator edits.
6. Every page can save independently without changing fields owned elsewhere;
   concurrent stale writes cannot silently overwrite another editor's changes.
7. Switching language/tab preserves drafts. Save covers hidden language edits;
   Discard resets all page edits; errors expose the affected language/group.
8. Legal source locale/version and independent language collections retain
   current semantics. Missing translations are never invented or mislabelled.
9. Existing defaults, override/reset actions, explicit tenant recording
   enablement, retention limits and template-conflict rejection still work.
10. Feedback editing retains current supported controls and preserves other
    form data. No general question builder or analytics is introduced.
11. Overview values match saved configuration and make no operational-readiness
    or legal-approval claims. Read failures remain distinguishable from absence.
12. Legacy removal has consumer/dependency evidence; any required data migration
    preserves values, is repeatable and has a documented rollback approach.
13. Loading, retry, validation, read-only and saving states use Studio patterns;
    controls have accessible labels and keyboard/focus behaviour.
14. New UI labels use existing DE/EN translation infrastructure. This design and
    implementation documentation remain English.

Validate with focused Studio UI, navigation/access, override/persistence and
affected type/runtime tests, plus SSF contract regression where producer output
or legacy compatibility is touched. No production enablement is part of design
acceptance.

### Implementation-entry checks

Resolve these technical checks in the Studio proposal before changing code:

| Check                  | Required outcome                                                   |
| ---------------------- | ------------------------------------------------------------------ |
| Navigation depth       | Confirm supported SDK contract or specify a generic extension      |
| Field audit            | Reconcile this mapping against the chosen current Studio revision  |
| Persistence            | Demonstrate safe section ownership and concurrency handling        |
| Leaving an edited page | Locate the shared guard or specify the minimal common guard        |
| Legacy dependencies    | Record consumer inventory and any migration/retention requirements |

These are implementation-entry checks, not additional product features. Review
this design before producing the implementation plan; retain a separate approval
step for the owning OpenSpec change.
