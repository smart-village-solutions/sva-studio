# Content Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die `News`-Detailseite wird von einem monolithischen Formularblock auf ein tab-basiertes, barrierefreies Detailseitenmuster mit `Basis`, `Inhalte`, `Freigabe` und `Historie` umgestellt, das später für `Events` und `POI` wiederverwendbar ist.

**Architecture:** Die erste Iteration vermeidet neue Host-/SDK-Registrierungsmechanismen. Stattdessen entsteht ein wiederverwendbares Detailseiten-Workspace-Muster in `@sva/studio-ui-react`, während `@sva/plugin-news` Eigentümer von Feldlogik, Formularzustand, API-Mapping und tab-spezifischen Panels bleibt. Historie wird nicht über neue GraphQL-Verträge modelliert, sondern über den bereits vorhandenen IAM-Content-History-Pfad beziehungsweise eine dünne, wiederverwendbare Client-Hilfe an denselben Host-Vertrag angeschlossen.

**Tech Stack:** Nx, pnpm, TypeScript strict mode, React, TanStack Router, `@sva/studio-ui-react`, `@sva/plugin-sdk`, `react-hook-form`, `@hookform/resolvers`, Zod, Vitest, Testing Library, `msw`

---

## File Structure Map

### Referenzen und Architekturgrenzen

- Reference: `docs/superpowers/specs/2026-05-24-content-detail-page-design.md`
- Reference: `docs/superpowers/specs/2026-05-24-unified-content-entry-design.md`
- Reference: `docs/development/studio-uebersichts-und-detailseiten-standard.md`
- Reference: `docs/development/studio-foundations-governance.md`
- Reference: `docs/adr/ADR-043-formular-foundation-mit-react-hook-form-und-zodresolver.md`
- Reference: `docs/adr/ADR-044-frontend-test-foundation-mit-msw-und-selektivem-fast-check.md`

### Reusable Studio-UI workspace primitives

- Create: `packages/studio-ui-react/src/studio-detail-tabs.tsx`
- Create: `packages/studio-ui-react/src/studio-detail-tabs.test.tsx`
- Modify: `packages/studio-ui-react/src/index.ts`
- Reference: `packages/studio-ui-react/src/tabs.tsx`
- Reference: `packages/studio-ui-react/src/studio-form-bridge.tsx`

### News detail page refactor

- Modify: `packages/plugin-news/src/news.pages.tsx`
- Create: `packages/plugin-news/src/news.detail-page.tsx`
- Create: `packages/plugin-news/src/news.detail-form.ts`
- Create: `packages/plugin-news/src/news.detail-tabs.tsx`
- Create: `packages/plugin-news/src/news.detail-basis-tab.tsx`
- Create: `packages/plugin-news/src/news.detail-content-tab.tsx`
- Create: `packages/plugin-news/src/news.detail-release-tab.tsx`
- Create: `packages/plugin-news/src/news.detail-history-tab.tsx`
- Create: `packages/plugin-news/src/news.history.ts`
- Modify: `packages/plugin-news/src/news.api.ts`
- Modify: `packages/plugin-news/src/news.types.ts`
- Modify: `packages/plugin-news/src/plugin.translations.ts`
- Modify: `packages/plugin-news/src/index.ts`

### News tests and package runtime/test setup

- Modify: `packages/plugin-news/package.json`
- Modify: `packages/plugin-news/vitest.config.ts`
- Modify: `packages/plugin-news/tests/news.pages.test.tsx`
- Create: `packages/plugin-news/tests/news.detail-form.test.ts`
- Create: `packages/plugin-news/tests/news.history.test.ts`

### Optional shared plugin SDK helper for history reuse

- Create: `packages/plugin-sdk/src/content-history-client.ts`
- Create: `packages/plugin-sdk/src/content-history-client.test.ts`
- Modify: `packages/plugin-sdk/src/public-api.ts`
- Modify: `packages/plugin-sdk/src/index.ts`

### App-level integration verification

- Modify: `apps/sva-studio-react/src/routing/app-route-bindings.test.tsx`
- Reference: `apps/sva-studio-react/src/routes/content/-content-editor-page.tsx`
- Reference: `apps/sva-studio-react/src/hooks/use-contents.ts`

## Task 1: Lock the architecture cut before touching the News editor

**Files:**
- Reference: `docs/superpowers/specs/2026-05-24-content-detail-page-design.md`
- Reference: `docs/superpowers/specs/2026-05-24-unified-content-entry-design.md`
- Reference: `packages/plugin-sdk/src/content-types.ts`
- Reference: `packages/plugin-sdk/src/standard-content-plugin.ts`
- Reference: `packages/plugin-news/src/plugin.tsx`

- [x] **Step 1: Confirm that V1 does not need a new SDK registration contract**

Use the existing `ContentTypeDefinition` registration as the only content-type registration entry point for V1. Do not add a second registry for detail tabs.

```ts
// V1 architectural decision
type V1DetailIntegration = {
  sdkRegistrationChange: false;
  sharedUiPrimitive: true;
  pluginOwnedPanels: true;
  newContentTypeRegistry: false;
};
```

- [x] **Step 2: Record the host/plugin split that the implementation must preserve**

Treat these responsibilities as fixed:

```md
- @sva/studio-ui-react: generic tab workspace, action slots, state surfaces
- @sva/plugin-news: RHF/Zod form logic, field mapping, media handling, save/delete flows
- @sva/plugin-sdk: only stable reusable helpers such as optional content-history client
- apps/sva-studio-react: no news-specific form logic
```

- [x] **Step 3: Verify the current registration already carries the outer content entry contract**

Run:

```bash
rg -n "ContentTypeDefinition|studioContentType|createStandardContentTypeDefinition|createPath|detailPath" \
  packages/plugin-sdk/src/content-types.ts \
  packages/plugin-sdk/src/standard-content-plugin.ts \
  packages/plugin-news/src/plugin.tsx
```

Expected: The current content-type registration already owns `createPath` and `detailPath`, so V1 can reuse the unified content entry integration without new registry work.

- [x] **Step 4: Commit the architecture checkpoint**

```bash
git add docs/superpowers/archived-plans/2026-05-24-content-detail-page-implementation.md
git commit -m "docs: add content detail page implementation plan"
```

## Task 2: Extract reusable tabbed detail-workspace primitives into `@sva/studio-ui-react`

**Files:**
- Create: `packages/studio-ui-react/src/studio-detail-tabs.tsx`
- Create: `packages/studio-ui-react/src/studio-detail-tabs.test.tsx`
- Modify: `packages/studio-ui-react/src/index.ts`
- Reference: `packages/studio-ui-react/src/tabs.tsx`
- Reference: `packages/studio-ui-react/src/studio-form-bridge.tsx`

- [x] **Step 1: Write the failing primitive tests first**

Cover the reusable behavior before extracting UI:

```tsx
it('renders an accessible tablist with mobile select fallback and desktop triggers', () => {});
it('keeps visited panels mounted when keepMounted is enabled', () => {});
it('shows tab-level dirty markers without using color as the only signal', () => {});
it('renders panel header title, description, and actions slot', () => {});
it('announces blocked tab switches through an accessible status surface', () => {});
```

- [x] **Step 2: Run the new studio-ui-react test file and verify it fails**

Run:

```bash
pnpm nx run studio-ui-react:test:unit --testFiles=src/studio-detail-tabs.test.tsx
```

Expected: FAIL because `studio-detail-tabs.tsx` does not exist yet.

- [x] **Step 3: Implement the shared detail-tab workspace primitive**

Build a small public contract, not a news-specific component:

```ts
export type StudioDetailTabDefinition<TTabId extends string> = {
  readonly id: TTabId;
  readonly label: string;
  readonly description?: string;
  readonly dirtyLabel?: string;
  readonly isDirty?: boolean;
  readonly disabled?: boolean;
  readonly actions?: ReactNode;
  readonly panel: ReactNode;
};
```

The component must provide:

```md
- Radix/shadcn tab semantics via existing Tabs primitives
- mobile select fallback
- optional visited-panel keep-mount behavior
- visible non-color-only dirty hint
- panel header with title/description/actions
- aria-live capable status slot for switch warnings or save feedback
```

- [x] **Step 4: Export the primitive through the public package entry**

Add exports in `packages/studio-ui-react/src/index.ts` for:

```ts
export type { StudioDetailTabDefinition } from './studio-detail-tabs.js';
export { StudioDetailTabs } from './studio-detail-tabs.js';
```

- [x] **Step 5: Run the focused studio-ui-react tests**

Run:

```bash
pnpm nx run studio-ui-react:test:unit --testFiles=src/studio-detail-tabs.test.tsx --testFiles=src/tabs.test.tsx
```

Expected: PASS.

- [x] **Step 6: Commit the shared UI slice**

```bash
git add packages/studio-ui-react/src/studio-detail-tabs.tsx packages/studio-ui-react/src/studio-detail-tabs.test.tsx packages/studio-ui-react/src/index.ts
git commit -m "feat: add reusable studio detail tabs workspace"
```

## Task 3: Move News edit state to RHF/Zod and split page composition away from `news.pages.tsx`

**Files:**
- Modify: `packages/plugin-news/package.json`
- Modify: `packages/plugin-news/vitest.config.ts`
- Modify: `packages/plugin-news/src/news.pages.tsx`
- Create: `packages/plugin-news/src/news.detail-page.tsx`
- Create: `packages/plugin-news/src/news.detail-form.ts`
- Modify: `packages/plugin-news/src/news.types.ts`
- Create: `packages/plugin-news/tests/news.detail-form.test.ts`

- [x] **Step 1: Add the foundations dependencies and shared test setup to plugin-news**

Mirror the proven package/test setup used by plugin-poi and waste-management:

```json
{
  "dependencies": {
    "@hookform/resolvers": "^3.10.0",
    "react-hook-form": "^7.76.0",
    "zod": "^3.x"
  }
}
```

And add MSW setup to `packages/plugin-news/vitest.config.ts`:

```ts
const studioMswSetupFile = fileURLToPath(new URL(import.meta.resolve('tooling-testing/msw/setup')));
// ...
test: {
  setupFiles: [studioMswSetupFile],
}
```

- [x] **Step 2: Write form-level failing tests for the new RHF/Zod model**

Cover the new form helpers independently from the page shell:

```ts
it('maps a NewsContentItem into default tabbed form values', () => {});
it('rejects invalid publishedAt values through the resolver schema', () => {});
it('requires a body in at least one content block', () => {});
it('derives changed field groups for basis versus content tabs', () => {});
it('builds live character metrics for title, intro, and body fields', () => {});
```

- [x] **Step 3: Run the focused plugin-news tests and verify failure**

Run:

```bash
pnpm nx run plugin-news:test:unit --testFiles=tests/news.detail-form.test.ts
```

Expected: FAIL because the new form module does not exist yet.

- [x] **Step 4: Introduce a dedicated detail-form module**

Move state/model logic out of `news.pages.tsx` into `news.detail-form.ts`:

```ts
export type NewsDetailTabId = 'basis' | 'content' | 'release' | 'history';

export type NewsDetailFormValues = {
  title: string;
  author: string;
  categoryName: string;
  categoriesText: string;
  publishedAt: string;
  publicationDate: string;
  externalId: string;
  newsType: string;
  charactersToBeShown: string;
  fullVersion: boolean;
  showPublishDate: boolean;
  teaserImageAssetId: string | null;
  headerImageAssetId: string | null;
  contentBlocks: readonly NewsContentBlockFormValue[];
  sourceUrl: { url: string; description: string };
  address: { street: string; zip: string; city: string };
  pointOfInterestId: string;
};
```

The module should own:

```md
- item-to-form mapping
- form-to-mutation mapping
- Zod schema and resolver-ready validation
- character count helpers
- dirty-tab derivation helpers
```

- [x] **Step 5: Thin down `news.pages.tsx` so it delegates**

After extraction, keep `news.pages.tsx` as a route-facing wrapper:

```tsx
export const NewsCreatePage = () => <NewsDetailPage mode="create" />;
export const NewsEditPage = () => <NewsDetailPage mode="edit" contentId={resolveNewsContentId(...)} />;
```

- [x] **Step 6: Run the form-level tests**

Run:

```bash
pnpm nx run plugin-news:test:unit --testFiles=tests/news.detail-form.test.ts
pnpm nx run plugin-news:test:unit --testFiles=tests/news.validation.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit the form-foundation slice**

```bash
git add packages/plugin-news/package.json packages/plugin-news/vitest.config.ts packages/plugin-news/src/news.pages.tsx packages/plugin-news/src/news.detail-page.tsx packages/plugin-news/src/news.detail-form.ts packages/plugin-news/src/news.types.ts packages/plugin-news/tests/news.detail-form.test.ts
git commit -m "refactor: move news detail form to rhf and zod"
```

## Task 4: Implement the `Basis` and `Inhalte` tabs with tab-local save flows, counters, and accessibility hooks

**Files:**
- Create: `packages/plugin-news/src/news.detail-tabs.tsx`
- Create: `packages/plugin-news/src/news.detail-basis-tab.tsx`
- Create: `packages/plugin-news/src/news.detail-content-tab.tsx`
- Create: `packages/plugin-news/src/news.detail-page.tsx`
- Modify: `packages/plugin-news/src/news.api.ts`
- Modify: `packages/plugin-news/tests/news.pages.test.tsx`

- [x] **Step 1: Write the integration tests for the new tab shell before implementation**

Add page-level cases for:

```tsx
it('renders Basis as the default tab and shows the current metadata summary', () => {});
it('switches to Inhalte through keyboard and mobile-select navigation', () => {});
it('shows live character counters for title, intro, and body fields', () => {});
it('prompts before leaving a dirty tab', () => {});
it('keeps entered content when returning to a visited tab', () => {});
```

- [x] **Step 2: Run the page suite against the existing monolith**

Run:

```bash
pnpm nx run plugin-news:test:unit --testFiles=tests/news.pages.test.tsx
```

Expected: FAIL on missing tab structure, counters, and dirty-tab behavior.

- [x] **Step 3: Build the News detail page host around the shared workspace primitive**

`news.detail-page.tsx` should orchestrate:

```md
- loading existing item and media references
- creating the RHF form instance
- computing dirty state per tab
- rendering the StudioDetailTabs contract
- central status surface for save/error/switch feedback
- create/edit mode differences
```

- [x] **Step 4: Implement `Basis` as a focused metadata panel**

Move these fields into `news.detail-basis-tab.tsx`:

```md
- title
- author
- categoryName
- categories
- newsType
- externalId
- publishedAt
- publicationDate
- charactersToBeShown
- fullVersion
- showPublishDate
```

This tab must expose:

```md
- field-level validation via Studio form bridge helpers
- title character counter
- tab-local save action
- metadata summary header in edit mode
```

- [x] **Step 5: Implement `Inhalte` as the content/media panel**

Move these concerns into `news.detail-content-tab.tsx`:

```md
- content block add/remove
- block title/intro/body editing
- teaser/header media selection
- nested media contents
- source URL and address fields
- body/introduction character counters
```

- [x] **Step 6: Keep mutations tab-local without duplicating API mapping**

`news.api.ts` should continue to own transport, but tab saves should call focused mutation builders:

```ts
export const buildNewsBasisMutation = (values: NewsDetailFormValues): NewsFormInput => { /* ... */ };
export const buildNewsContentMutation = (values: NewsDetailFormValues): NewsFormInput => { /* ... */ };
```

Both builders should still reuse the same final `updateNews()` transport.

- [x] **Step 7: Run the focused plugin-news tests for Basis/Inhalte**

Run:

```bash
pnpm nx run plugin-news:test:unit --testFiles=tests/news.pages.test.tsx
pnpm nx run plugin-news:test:unit --testFiles=tests/news.api.test.ts
pnpm nx run plugin-news:test:unit --testFiles=tests/news.validation.test.ts
```

Expected: PASS.

- [x] **Step 8: Commit the Basis/Inhalte migration**

```bash
git add packages/plugin-news/src/news.detail-tabs.tsx packages/plugin-news/src/news.detail-basis-tab.tsx packages/plugin-news/src/news.detail-content-tab.tsx packages/plugin-news/src/news.detail-page.tsx packages/plugin-news/src/news.api.ts packages/plugin-news/tests/news.pages.test.tsx
git commit -m "feat: migrate news basis and content tabs"
```

## Task 5: Add the `Freigabe` tab on top of the existing News API contract

**Files:**
- Create: `packages/plugin-news/src/news.detail-release-tab.tsx`
- Modify: `packages/plugin-news/src/news.detail-page.tsx`
- Modify: `packages/plugin-news/src/news.detail-form.ts`
- Modify: `packages/plugin-news/tests/news.pages.test.tsx`
- Modify: `packages/plugin-news/src/plugin.translations.ts`

- [x] **Step 1: Write failing tests for the release/workflow surface**

Cover only what the current News contract can truthfully support:

```tsx
it('renders the Freigabe tab with current publish-related fields and status', () => {});
it('prevents publish-relevant saves when publishedAt is invalid', () => {});
it('shows read-only workflow hints for unsupported process steps', () => {});
it('announces save success and save failure through the page status surface', () => {});
```

- [x] **Step 2: Run the focused page tests to verify failure**

Run:

```bash
pnpm nx run plugin-news:test:unit --testFiles=tests/news.pages.test.tsx
```

Expected: FAIL because no `Freigabe` tab exists yet.

- [x] **Step 3: Implement the tab around existing API-backed fields only**

Use the existing contract instead of inventing workflow state:

```md
- status
- publishedAt / publicationDate coupling
- showPublishDate
- push-notification context where create-mode already supports it
- read-only explanatory notes for workflow concepts not represented in the current API
```

- [x] **Step 4: Keep unsupported workflow steps explicit, not implicit**

Render a structured non-goal/read-only block such as:

```md
- "Weitere Freigabeschritte folgen erst mit einem erweiterten Backend-Vertrag."
- no fake approve/reject actions
- no hidden status transitions outside current save contract
```

- [x] **Step 5: Run the release tab tests**

Run:

```bash
pnpm nx run plugin-news:test:unit --testFiles=tests/news.pages.test.tsx
```

Expected: PASS.

- [x] **Step 6: Commit the release tab**

```bash
git add packages/plugin-news/src/news.detail-release-tab.tsx packages/plugin-news/src/news.detail-page.tsx packages/plugin-news/src/news.detail-form.ts packages/plugin-news/src/plugin.translations.ts packages/plugin-news/tests/news.pages.test.tsx
git commit -m "feat: add news release tab"
```

## Task 6: Reuse IAM content history for the `Historie` tab instead of inventing a News-specific audit backend

**Files:**
- Create: `packages/plugin-sdk/src/content-history-client.ts`
- Create: `packages/plugin-sdk/src/content-history-client.test.ts`
- Modify: `packages/plugin-sdk/src/public-api.ts`
- Modify: `packages/plugin-sdk/src/index.ts`
- Create: `packages/plugin-news/src/news.history.ts`
- Create: `packages/plugin-news/src/news.detail-history-tab.tsx`
- Create: `packages/plugin-news/tests/news.history.test.ts`
- Modify: `packages/plugin-news/src/news.detail-page.tsx`
- Modify: `packages/plugin-news/tests/news.pages.test.tsx`

- [x] **Step 1: Prove the existing history path before adding code**

Run:

```bash
rg -n "/api/v1/iam/contents/.*/history|fetchContentHistory|IamContentHistoryEntry" \
  apps/sva-studio-react/src/lib/iam-api.ts \
  apps/sva-studio-react/src/hooks/use-contents.ts \
  packages/core/src/content-management.ts \
  packages/auth-runtime/src/iam-contents
```

Expected: Existing IAM content history read path backed by persisted content history rows.

- [x] **Step 2: Write the failing shared-client and news-history tests**

Add client-level cases:

```ts
it('loads iam content history through the shared host endpoint', async () => {});
it('maps api list responses into descending timeline entries', async () => {});
it('returns an empty list for successful no-history responses', async () => {});
it('surfaces forbidden and not-found errors as readable UI states', async () => {});
```

Add page-level cases:

```tsx
it('renders Historie entries in reverse chronological order', () => {});
it('renders a trustworthy empty state when no history exists', () => {});
it('keeps Historie read-only and free of save actions', () => {});
```

- [x] **Step 3: Run the focused tests and verify failure**

Run:

```bash
pnpm nx run plugin-sdk:test:unit --testFiles=src/content-history-client.test.ts
pnpm nx run plugin-news:test:unit --testFiles=tests/news.history.test.ts --testFiles=tests/news.pages.test.tsx
```

Expected: FAIL because the shared client and history tab do not exist yet.

- [x] **Step 4: Add a minimal shared history client to plugin-sdk**

Create a stable reusable helper instead of app-internal imports:

```ts
export const fetchIamContentHistory = async (
  contentId: string
): Promise<readonly IamContentHistoryEntry[]> => {
  const response = await requestJson<ApiListResponse<IamContentHistoryEntry>>(`/api/v1/iam/contents/${contentId}/history`);
  return response.data;
};
```

- [x] **Step 5: Implement the News history adapter and read-only tab**

`news.history.ts` should convert shared history records into UI-ready entries if needed:

```ts
export type NewsHistoryEntry = {
  readonly id: string;
  readonly actionLabel: string;
  readonly createdAt: string;
  readonly actor: string;
  readonly summary?: string;
  readonly changedFields: readonly string[];
};
```

`news.detail-history-tab.tsx` must provide:

```md
- loading state
- empty state
- error state
- reverse-chronological timeline rendering
- no mutation controls
```

- [x] **Step 6: Run the history-focused tests**

Run:

```bash
pnpm nx run plugin-sdk:test:unit --testFiles=src/content-history-client.test.ts
pnpm nx run plugin-news:test:unit --testFiles=tests/news.history.test.ts --testFiles=tests/news.pages.test.tsx
```

Expected: PASS.

- [x] **Step 7: Commit the history slice**

```bash
git add packages/plugin-sdk/src/content-history-client.ts packages/plugin-sdk/src/content-history-client.test.ts packages/plugin-sdk/src/public-api.ts packages/plugin-sdk/src/index.ts packages/plugin-news/src/news.history.ts packages/plugin-news/src/news.detail-history-tab.tsx packages/plugin-news/src/news.detail-page.tsx packages/plugin-news/tests/news.history.test.ts packages/plugin-news/tests/news.pages.test.tsx
git commit -m "feat: add reusable content history tab for news"
```

## Task 7: Final integration, accessibility hardening, documentation, and verification

**Files:**
- Modify: `packages/plugin-news/src/index.ts`
- Modify: `packages/plugin-news/src/plugin.translations.ts`
- Modify: `apps/sva-studio-react/src/routing/app-route-bindings.test.tsx`
- Modify: `docs/superpowers/specs/2026-05-24-content-detail-page-design.md` if implementation learning requires a small clarification
- Modify: relevant docs under `docs/architecture/` only if the code cut materially changes package responsibilities

- [x] **Step 1: Add explicit accessibility regression coverage**

Extend tests to prove:

```tsx
it('supports keyboard-only tab switching and preserves focus expectations', () => {});
it('wires aria-describedby and field errors through Studio form bridge helpers', () => {});
it('announces save and blocked-switch feedback through an accessible status region', () => {});
it('exposes the dirty indicator in text or icon-plus-text form, not color only', () => {});
```

- [x] **Step 2: Verify route binding compatibility stays intact**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/routing/app-route-bindings.test.tsx
```

Expected: PASS with `newsDetail` and `newsEditor` still resolving through the refactored plugin exports.

- [x] **Step 3: Run the affected package-level validation suite**

Run:

```bash
pnpm nx run studio-ui-react:test:unit --testFiles=src/studio-detail-tabs.test.tsx
pnpm nx run plugin-sdk:test:unit --testFiles=src/content-history-client.test.ts
pnpm nx run plugin-news:test:unit --testFiles=tests/news.detail-form.test.ts --testFiles=tests/news.history.test.ts --testFiles=tests/news.pages.test.tsx
pnpm nx run plugin-news:test:unit
pnpm nx run plugin-news:test:types
pnpm nx run plugin-news:lint
```

Expected: PASS.

- [x] **Step 4: Run the cross-project affected checks required by the repo rules**

Run:

```bash
pnpm nx affected --target=test:unit --files=packages/studio-ui-react/src/studio-detail-tabs.tsx --files=packages/plugin-sdk/src/content-history-client.ts --files=packages/plugin-news/src/news.detail-page.tsx
pnpm nx affected --target=test:types --files=packages/studio-ui-react/src/studio-detail-tabs.tsx --files=packages/plugin-sdk/src/content-history-client.ts --files=packages/plugin-news/src/news.detail-page.tsx
pnpm check:file-placement
```

Expected: PASS.

- [x] **Step 5: Run the preferred PR gate if time and resources allow**

Run:

```bash
pnpm test:pr
```

Expected: PASS. If this is not feasible, record the exact reason and keep the minimum affected checks from Step 4 as the push gate.

- [x] **Step 6: Commit the final integration pass**

```bash
git add packages/plugin-news/src/index.ts packages/plugin-news/src/plugin.translations.ts packages/plugin-news/tests/news.pages.test.tsx apps/sva-studio-react/src/routing/app-route-bindings.test.tsx docs/superpowers/specs/2026-05-24-content-detail-page-design.md
git commit -m "test: harden news detail page accessibility and integration"
```

## Spec Coverage Check

- `Basis`, `Inhalte`, `Freigabe`, `Historie`: covered by Tasks 4, 5, and 6.
- Waste-like reusable tab workspace: covered by Task 2.
- Form foundations (`react-hook-form`, `@hookform/resolvers`): covered by Task 3.
- `msw` for HTTP-near tests: covered by Tasks 3 and 6.
- Accessibility and WCAG-oriented behavior: covered by Tasks 2 and 7.
- Plugin/package boundaries: covered by Task 1 and reinforced through Task 2 versus plugin-owned Tasks 3-6.
- Unified content entry consistency without a second SDK registry: covered by Task 1.
- History from local persisted content history instead of GraphQL changes: covered by Task 6.

## Placeholder Scan

- No `TODO`, `TBD`, or deferred pseudo-steps remain.
- History implementation is concrete: reuse `/api/v1/iam/contents/:id/history` via a shared client.
- SDK work is concrete and bounded: shared client helper only, no speculative registration contract.

## Type Consistency Check

- Tab ids are consistently `basis`, `content`, `release`, `history`.
- The page shell is consistently `NewsDetailPage`.
- Shared history client shape is consistently based on `IamContentHistoryEntry`.
- The reusable studio UI contract stays `StudioDetailTabDefinition`.
