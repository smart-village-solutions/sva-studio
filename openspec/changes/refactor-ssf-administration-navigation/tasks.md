# Implementation tasks

## 1. Source checks and design review

- [x] 1.1 Recheck Studio source against the supplied `26592bc4f` baseline; record
      the inspected revision, local-main drift and live-evidence limits in `design.md`.
- [x] 1.2 Audit generic navigation contract, validator and shell group support;
      propose one-level grouping with preserved flat plugins and per-leaf access.
- [x] 1.3 Reconcile existing controls/contracts with all tenant/root field owners,
      limits, reset controls, legal collections and supported feedback data.
- [x] 1.4 Inspect transaction/lock and GET/PUT semantics; choose atomic raw-state
      revision preconditions on existing aggregates, with no new schema/service.
- [x] 1.5 Locate the shared leave hook/boundary, identify missing SSF integration
      and define minimal Save/Discard/Stay and context-change protection.
- [x] 1.6 Inventory local legacy browser/service readers/writers and smoke tests;
      record supported-consumer/data-inventory requirements before destructive retirement.
- [x] 1.7 Review and explicitly approve this owning OpenSpec change before product
      implementation. Supplied design and recording-change approval do not substitute.

## 2. Establish safe existing persistence before page splitting

- [x] 2.1 Refresh implementation revision and inventory every writer of SSF V2 JSON
      aggregates, including imports/direct SQL. Keep tenant RLS/instance binding.
- [x] 2.2 Add dedicated X-SSF-Content-Revision response and mandatory exact
      X-SSF-Expected-Content-Revision request headers to
      existing content-v2 GET/PUT handlers and browser helpers together. Bind root or
      tenant/template raw storage state; keep runtime configurationRevision separate.
- [x] 2.3 Inside the existing advisory-lock transaction compare revisions, validate
      current locale and tenant/template constraints, sanitize, persist and capture the
      matching saved response. Missing=428, stale=412; no unconditional writer bypass.
- [x] 2.4 Verify root Default content can commit both persistence scopes atomically;
      retain null-as-no-update semantics and distinguish absent/unconfigured state.
- [x] 2.5 Prove same-aggregate/root/tenant-template stale races using real PostgreSQL
      sessions. Prove failed writes leave data unchanged and return distinct conflicts.
- [x] 2.6 Build page-owned projection updates from raw saved aggregates. Preserve
      other pages, unknown supported questions, nullable values, explicit equal
      overrides and reset semantics; do not diff/rewrite the full effective tenant view.

## 3. Extend current host navigation and leave protection

- [x] 3.1 Extend PluginNavigationItem, descriptor aggregation and registry validation
      for same-plugin application groups. Validate IDs, metadata/scope consistency and
      targets; preserve existing flat/header plugin contracts.
- [x] 3.2 Compose authorised leaves into non-empty shell groups for desktop/mobile,
      with active children, accessible expansion and existing branding in both scopes.
      Resolve task-label/action-title precedence without hardcoded SSF child routes.
- [x] 3.3 Register the eight addressable SSF routes and existing action/access bindings;
      replace old route references and optionally redirect old URLs without an editor.
- [x] 3.4 Preserve Studio overview, System administration and authorised unrelated
      modules, including required media/App entries. Remove only empty Data management
      sections; reconcile existing broad branding filters with mixed-module acceptance.
- [x] 3.5 Reuse the existing shared editor-leave hook/host boundary. Add the minimal
      generic opt-in route marker and save/discard registration; cover pathname/back,
      browser unload, voluntary context switches and forced auth/context suspension.
      Guard the existing use-organization-context mutation before its server call.
- [x] 3.6 Verify Save proceeds only after acknowledged success; failed/invalid/stale
      saves retain all drafts. Prove Stay/failed Save causes zero organisation-switch
      writes, Save success/Discard exactly one. Do not remount dirty pages.

## 4. Tenant and root page composition

- [x] 4.1 Add tenant saved-value Overview with authorised links and distinct loading,
      missing configuration, read failure/retry; no readiness or legal-approval claims.
- [x] 4.2 Split tenant Appearance and content, Languages, Recordings and Feedback
      using the exact field owners/tabs in `design.md`; preserve read-only access.
- [x] 4.3 Add root Installation overview, Default configuration and Default content;
      keep Installation/Tenant template tabs within the latter's single save unit.
- [x] 4.4 Reuse Studio page/section/field/form-action/rich-text components, existing
      choices/validation, inheritance/reset and recording tenant-only enablement.
- [x] 4.5 Replace language-tab strips with labelled per-group selects; retain drafts
      keyed by locale across tabs and errors. Use a stable draft-only identity for new
      recording-text rows with missing/editable locale. Never key drafts by array index.
- [x] 4.6 Save all hidden language/tab edits; Discard resets the entire page; focus
      invalid hidden groups. Show single staff/installation locales without implying
      automatic translation; keep legal, guest and recording memberships independent.
- [x] 4.7 Keep current feedback IDs, controls and uneditable data; no question builder.
      Keep all recording/legal fields editable while recording is disabled.

## 5. Retire replaced editors and prove compatibility

- [x] 5.1 Record the user's 2026-11-12 confirmation that there are no existing
      consumers. Retire obsolete administration APIs and exclusive dependencies;
      keep service-runtime retirement outside this change. No stored-value deletion.
- [x] 5.2 Remove V1/V2 switches, replaced legacy editors and exclusive UI keys/helpers
      in the same section delivering replacement pages. Keep shared exports/action IDs.
- [x] 5.3 Rebind route reads and migrate image-smoke deny probes to V2, then remove
      obsolete browser admin handlers. Keep equivalent access-denial evidence.
- [x] 5.4 Preserve the separate runtime API contract and disabled compatibility
      output in this navigation/admin change. There is no retained administration
      consumer or hidden legacy editor; service API retirement is a separate scope.
- [x] 5.5 Omit speculative data migration: no stored legacy values are deleted or
      converted, and no schema changes are made. Any later transfer must establish
      field precedence, conflicts, repeatability and rollback first; never infer
      recording consent from obsolete storage wording.

## 6. Focused validation and current documentation

- [x] 6.1 Run focused registry/navigation/access and mixed-module desktop/mobile tests;
      route resolution, keyboard and root/tenant wrong-scope checks. Full authenticated
      browser refresh is not claimed by isolated component verification.
- [x] 6.2 Run projection/override and language-draft tests, conflict/sanitization/readback
      integration tests and existing recording/legal/runtime regressions affected by changes.
- [x] 6.3 Run the smallest affected type/unit gates as code is added; required server
      runtime/security/data-integrity gates remain mandatory. Measure affected scope
      before a broad affected unit run. Local checks are recorded below; no remote CI
      or exact-HEAD merge/release evidence is claimed.
- [x] 6.4 Verify DE/EN labels, read-only/loading/error/saving states, accessible names,
      focus, native unload handling and any affected shared visual references together.
- [x] 6.5 Update arc42 05/06/08 and current SSF API/admin docs, contextual help/user
      manual and area indices. Check 04 for unchanged authority; 09/ADR only if needed.
- [x] 6.6 Reconcile overlapping active SSF and shared-shell changes, especially prior
      V1-editor retention promises; retain runtime compatibility requirements.
- [x] 6.7 Validate OpenSpec strictly and file placement; report source implementation,
      checks, live verification and functional acceptance separately. No rollout here.

## Completion evidence

All implementation tasks above are complete locally. See `design.md`, section
“Local implementation evidence (2026-11-12)”, for commands, test counts and scope
limits. The user approved an existing runtime-template prerequisite and mandatory
initial guest-language texts during creation. No consumers remain for the retired
administration API; there is no data migration or service-runtime retirement.
No publication, remote CI, rollout, authenticated live verification or functional
acceptance is claimed.

Review corrections (2026-11-12): error navigation now respects manual language/tab
choices after a failed save and reveals errors again on the next validation. The
Cockpit link follows module assignment and permissions in both standard and Kassel
branding. Targeted regression cases reproduced both findings before correction.
Targeted suites after correction: `plugin-ssf:test:unit` with
`--testFiles=tests/admin.content-v2-page.test.tsx` (19 passed) and
`sva-studio-react:test:unit:ui` with `--testFiles=src/components/Sidebar.test.tsx`
(58 passed). Targeted ESLint: zero errors; existing test assertion warnings remain.

## Reopened implementation cleanup (2026-11-12)

The user authorised simplifying the implementation after PR CI reported 29 new
complexity findings and a timeout in the root language/tab regression test. This
reopens implementation within the existing functional scope; it does not waive
merge gates or authorise threshold/baseline changes. Existing field, persistence,
revision and authority contracts remain the acceptance boundary.

The existing controllers separate lifecycle/save logic from page composition and
read-only summaries. Local field, translation and validation files are split only
where their independent existing responsibilities exceed the mandatory file and
function limits. All consumers stay on the original editor/repository path.
Final targeted tests, unchanged complexity gate and exact-HEAD CI are required
before continuing the previously requested merge and Kassel standalone rollout.

Cleanup evidence: page tests 19/19 both normally and with V8 coverage; the former
root timeout case completed in 561 ms under coverage without changing its timeout
or assertions. Projection/repository/handler tests: 10/10, 10/10 and 21/21; real
PostgreSQL integration: 15/15. Host boundary/context tests: 15/15 and 13/13; SDK
settings/registry tests: 16/16 and 73/73. Plugin typecheck and targeted ESLint passed
(zero lint errors). A read-only follow-up found no controller lifecycle regression.

The optional aggregate i18n formatter check fails in its existing aggregator
generator on the unrelated hyphenated `roles-permission-descriptions` identifier;
it changed no files. Changed resources use the same Prettier configuration and
are checked directly. This cleanup does not modify that generator.

Coverage follow-up: the changed-code gate identified 83.29% against its unchanged
85% requirement. Added 26 real contract cases in the existing admin-handler, page
projection and editor-page tests, without changing production code or thresholds.
The combined `plugin-ssf:test:coverage` run passed 250 tests (15 PostgreSQL-only
cases skipped there; their separate integration run passed). Re-evaluating the
plugin LCOV with the existing gate functions raises its covered units from
1579/1908 to 1701/1908; retaining unchanged CI evidence for the other projects
projects global changed-code coverage of 88.94%. Final CI confirmation remains
required. Manual rollout browser checks are explicitly skipped at user request;
this does not waive automated merge/image gates or backup/health/digest checks.
