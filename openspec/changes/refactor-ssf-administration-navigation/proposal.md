# Change: Reorganise SSF Studio navigation and administration pages

## Status and scope

Implementation approved by the user on 2026-11-11. This change records the supplied SSF design and the
Studio implementation-entry checks. Local implementation is authorised; deployment
and external-system mutations remain outside this approval.
Documentation is English as required by the supplied design, acceptance criterion 14.

**Objective:** Make existing SSF administration understandable through scope-specific
navigation and independently saved pages, preserving existing data and authority.

**Non-goals:** New business capabilities, setup wizards, onboarding checklists,
publication/preview/translation services, operational-readiness reporting, archive
or key management, permission expansion, production enablement, or deployment.
Unrelated modules and the Studio homepage remain functional. The user confirmed
that an existing valid SSF runtime template is a prerequisite. Initial mandatory
texts are captured once when adding a root guest language; subsequent editing
remains on Default content.

**Maximum implementation areas:** Existing `plugin-ssf` administration, its current
content repository/API and tests; `plugin-sdk` navigation validation/registry;
Studio shell/routing/organisation-context hook/i18n; the existing `studio-ui-react` editor-leave contract;
existing image smoke coverage and relevant documentation. No new package, service,
database, workflow, or parallel editor. No IAM provisioning or role redesign.

## Why

SSF currently exposes tenant and system editors containing V1/V2 tabs and large
mixed-purpose forms. The agreed design assigns each existing field one editing
location, separates root and tenant administration, and uses consistent language
selection. Splitting these forms without safe aggregate writes and leave guards
would risk overwriting other pages or losing drafts.

## What Changes

- Contribute a generic single application-group level through the existing plugin
  navigation contract and shell; SSF provides its own guarded leaf routes.
- Tenant pages: Overview, Appearance and content, Languages, Recordings, Feedback.
  Root pages: Installation overview, Default configuration, Default content.
- Reuse existing templates, fields and rich-text controls; keep independent page
  drafts across tabs/languages with page-wide Save/Discard and read-only states.
- Extend existing content-v2 GET/PUT administration with mandatory explicit revision
  preconditions, checked inside the existing repository lock. Preserve unrelated
  raw overrides and return the committed saved state with its matching revision.
- Reuse and minimally extend the existing shared leave guard for SSF route/context
  changes. Do not create a second guard framework.
- **BREAKING:** Remove unused legacy administration HTTP endpoints and their exclusive
  dependencies after the user confirmed on 2026-11-12 that no existing consumers remain; retain required service APIs and compatibility data. Migrate authored
  legacy-only data only with explicit mapping and repeatable rollback evidence.
- Preserve unrelated module links, including required media/App navigation; empty
  Data management sections already disappear and need no new mechanism.

## Entry-check outcome

| Check                | Result and decision                                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation depth     | SDK is flat; shell already renders one group level. Extend the generic contribution contract and registry validation, not an SSF-specific shell tree.                                                                                                                     |
| Field audit          | Current field controls and contracts match the supplied ownership map; complete mapping and limits are in `design.md`. Compatibility storage fields remain non-editable.                                                                                                  |
| Persistence          | Shared transaction lock exists; stale-write protection does not. Add aggregate compare-and-swap with raw-state revisions on existing endpoints before page separation.                                                                                                    |
| Leaving edited pages | Shared dirty/suspension hook and host boundary exist, but SSF routes are not connected; current dialog offers Discard/Stay. Reuse and extend it for Save/Discard/Stay and context changes.                                                                                |
| Legacy dependencies  | Legacy editors/admin helpers/handlers are identified; image verification uses old admin GET paths and local SSF clients still reference V1 service output. Remove UI/API dependencies deliberately; no storage or service API deletion without current consumer evidence. |

Evidence baseline: local `origin/main` at `a7239655f2bfa851a06e6888c144f4eb4cf80731`.
The original inspection revision `26592bc4f` is superseded for this proposal.
No live account, database, deployment or external repository was modified or
verified. Local SSF client evidence is historical source evidence, not live usage.

## Impact and coordination

- Affected specs: `ui-layout-shell`, `plugin-platform`, `ssf-content-v2`.
- Related active changes: `add-ssf-content-v2`, `add-ssf-mode-legal-texts`,
  `add-ssf-supported-language-catalog`, `add-ssf-recording-administration`,
  `align-studio-ui-design-system`, `add-central-app-translations` and
  `harden-studio-access-resilience`.
- The SSF capability currently exists in active changes, not yet as a standalone
  `openspec/specs/ssf-content-v2` document. These additive requirements complement
  those changes; archive/rebase must reconcile them without duplicate ownership.
- The new presentation supersedes the earlier promise to keep V1 administration
  and the former placement of legal editing in aggregate pages. Runtime service
  compatibility and legal/source semantics from those changes remain binding.
- Affected arc42: [05 building blocks](../../../docs/architecture/05-building-block-view.md),
  [06 runtime](../../../docs/architecture/06-runtime-view.md),
  [08 cross-cutting concepts](../../../docs/architecture/08-cross-cutting-concepts.md).
  Inspect 04 for unchanged scope/authority and 09 only if implementation requires
  a new architectural decision. Current architecture documents are not rewritten
  to describe unimplemented behaviour.
- Data: keep existing JSON aggregates and tables; planned content-hash preconditions
  need no new revision columns. If migration becomes necessary, consult central
  schema guidance and the separate SSF snapshot before authoring it.
- Required implementation evidence: navigation/access, page projections, language
  drafts, repository concurrency, runtime compatibility and legacy retirement.
  See `tasks.md` and the invariant/evidence table in `design.md`.

## Approval boundary

The five source checks are complete and technical decisions are proposed below.
The user approved local implementation after reviewing this owning change. On 2026-11-12 the user confirmed that there are no existing consumers; the old
administration APIs and their exclusive dependencies are therefore removed. No
stored values are deleted or migrated, and service-runtime API retirement is
outside this change. Any later data migration still requires explicit mapping
and rollback evidence.
No PR publication, merge or rollout is authorised by this document.
