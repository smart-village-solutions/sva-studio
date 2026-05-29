# Studio Data, Form, and Test Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den OpenSpec-Change `add-studio-data-form-and-test-foundations` in einen verbindlichen, umsetzbaren Architekturstandard überführen und die technische Grundlage für RHF-, MSW- und `fast-check`-gestützte Migrationen in Host und Plugins bereitstellen.

**Architecture:** Die Arbeit erfolgt in vier Schichten: zuerst OpenSpec- und Doku-Schärfung, dann vollständige Formularinventur, danach gemeinsame Foundations in `studio-ui-react` und `tooling/testing`, anschließend gezielte Referenzmigrationen in Host und Plugins. Der Rollout bleibt bewusst adapter- und governance-getrieben, damit neue Standards nicht als lose Bibliothekswahl, sondern als prüfbarer Standardpfad eingeführt werden.

**Tech Stack:** Nx, pnpm, TypeScript strict mode, React, Zod, `react-hook-form`, `@hookform/resolvers`, Vitest, `msw`, `fast-check`

---

## File Structure Map

### OpenSpec und Planungsartefakte

- Modify: `openspec/changes/add-studio-data-form-and-test-foundations/proposal.md`
- Modify: `openspec/changes/add-studio-data-form-and-test-foundations/design.md`
- Modify: `openspec/changes/add-studio-data-form-and-test-foundations/tasks.md`
- Modify: `openspec/changes/add-studio-data-form-and-test-foundations/specs/monorepo-structure/spec.md`
- Modify: `openspec/changes/add-studio-data-form-and-test-foundations/specs/account-ui/spec.md`
- Modify: `openspec/changes/add-studio-data-form-and-test-foundations/specs/content-management/spec.md`
- Modify: `openspec/changes/add-studio-data-form-and-test-foundations/specs/test-coverage-governance/spec.md`

### Inventur und Entwicklungsdokumentation

- Create: `docs/development/studio-form-migrationsinventur.md`
- Modify: `docs/development/testing-strategy.md`
- Modify: `docs/development/testing-coverage.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/architecture/09-architecture-decisions.md`
- Modify: `docs/architecture/10-quality-requirements.md`
- Create or Modify: `docs/architecture/decisions/ADR-0xx-formular-foundation-mit-react-hook-form-und-zodresolver.md`
- Create or Modify: `docs/architecture/decisions/ADR-0xx-frontend-test-foundation-mit-msw-und-fast-check.md`

### Shared UI Foundations

- Modify: `packages/studio-ui-react/package.json`
- Modify: `packages/studio-ui-react/src/index.ts`
- Modify: `packages/studio-ui-react/src/studio-primitives.tsx`
- Modify: `packages/studio-ui-react/src/studio-primitives.test.tsx`
- Create: `packages/studio-ui-react/src/studio-form-bridge.tsx`
- Create: `packages/studio-ui-react/src/studio-form-bridge.test.tsx`

### Shared Test Foundations

- Modify: `tooling/testing/package.json`
- Create: `tooling/testing/src/msw/server.ts`
- Create: `tooling/testing/src/msw/browser.ts`
- Create: `tooling/testing/src/msw/handlers.ts`
- Create: `tooling/testing/src/msw/reset.ts`
- Create: `tooling/testing/src/msw/index.ts`
- Modify: `tooling/testing/project.json`
- Modify: `apps/sva-studio-react/vitest.shared.ts`
- Modify: `packages/plugin-poi/vitest.config.ts`
- Modify: `packages/plugin-waste-management/vitest.config.ts`

### Kleine Playwright-Bruecke vor breiterem Harness-Rollout

- Modify: `apps/sva-studio-react/e2e/news-plugin.spec.ts`
- Modify: `apps/sva-studio-react/e2e/events-poi-plugin.spec.ts`
- Create: `apps/sva-studio-react/e2e/studio-shell.helpers.ts`

Hinweis: Wenn ein akuter `App E2E`-CI-Befund aus Playwright-Shell-Boot, frueher clientseitiger Navigation oder duplizierten `auth/me`-Wartebedingungen entsteht, ist ein kleiner Shared-Helper in `apps/sva-studio-react/e2e/` als Zwischenstufe zulaessig. Diese Bruecke stabilisiert bestehende Playwright-Specs, ohne den spaeteren `msw`-basierten Foundation-Rollout in `tooling/testing` vorwegzunehmen oder zu ersetzen.

### Property-based Test Foundations

- Modify: `packages/core/package.json`
- Modify: `packages/routing/package.json`
- Create: `docs/development/fast-check-hotspots.md`
- Create or Modify: first hotspot tests in `packages/core/src/**/*.test.ts` and/or `packages/routing/src/**/*.test.ts`

### Host Reference Migrations

- Modify: `apps/sva-studio-react/package.json`
- Modify: `apps/sva-studio-react/src/routes/admin/users/-user-create-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/users/-user-create-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/content/-content-editor-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/content/-content-editor-page.test.tsx`

### Plugin Reference Migrations

- Modify: `packages/plugin-poi/package.json`
- Modify: `packages/plugin-poi/src/poi.pages.tsx`
- Create or Modify: `packages/plugin-poi/src/poi.pages.test.tsx`
- Modify: `packages/plugin-waste-management/package.json`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-entity-dialogs.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-location-form-content.tsx`
- Create or Modify: `packages/plugin-waste-management/tests/**/*.test.tsx`

## Task 1: OpenSpec Scope auf verbindlichen Standard schärfen

**Files:**
- Modify: `openspec/changes/add-studio-data-form-and-test-foundations/proposal.md`
- Modify: `openspec/changes/add-studio-data-form-and-test-foundations/design.md`
- Modify: `openspec/changes/add-studio-data-form-and-test-foundations/tasks.md`
- Modify: `openspec/changes/add-studio-data-form-and-test-foundations/specs/monorepo-structure/spec.md`
- Modify: `openspec/changes/add-studio-data-form-and-test-foundations/specs/account-ui/spec.md`
- Modify: `openspec/changes/add-studio-data-form-and-test-foundations/specs/content-management/spec.md`
- Modify: `openspec/changes/add-studio-data-form-and-test-foundations/specs/test-coverage-governance/spec.md`
- Reference: `docs/superpowers/specs/2026-05-21-studio-data-form-and-test-foundations-design.md`

- [ ] **Step 1: Write the failing OpenSpec validation target**

Document the intended stronger language before editing:

```md
- Default-Standard statt vorsichtiger Pilot-Geltung
- explizite Ausnahmen
- vollständige Formularinventur als Pflichtartefakt
- Governance- und Review-Kriterien als Exit-Kriterien
```

- [ ] **Step 2: Run current validation to capture baseline**

Run: `openspec validate add-studio-data-form-and-test-foundations --strict`

Expected: PASS or a list of current spec issues that must still pass after rewriting.

- [ ] **Step 3: Rewrite proposal, design, tasks, and deltas to match the approved design**

Ensure the rewritten sections contain language equivalent to:

```md
- Neue oder grundlegend überarbeitete Formular-Flows MUST `react-hook-form` plus `@hookform/resolvers` verwenden.
- Neue oder grundlegend überarbeitete HTTP-nahe Frontend-Tests MUST `msw` verwenden.
- Zulässige Ausnahmen sind nur lokale Logik ohne HTTP, unveränderte Legacy-Flows und dokumentierte Spezialfälle.
- Eine vollständige Formular-Migrationsinventur ist ein Pflichtartefakt des Changes.
```

- [ ] **Step 4: Re-run OpenSpec validation**

Run: `openspec validate add-studio-data-form-and-test-foundations --strict`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add openspec/changes/add-studio-data-form-and-test-foundations
git commit -m "docs: tighten studio foundations openspec scope"
```

## Task 2: Vollständige Formular-Migrationsinventur anlegen

**Files:**
- Create: `docs/development/studio-form-migrationsinventur.md`
- Reference: `apps/sva-studio-react/src/routes/admin/users/-user-create-page.tsx`
- Reference: `apps/sva-studio-react/src/routes/admin/users/-user-edit-page.tsx`
- Reference: `apps/sva-studio-react/src/routes/admin/groups/-group-create-page.tsx`
- Reference: `apps/sva-studio-react/src/routes/admin/groups/-group-detail-page.tsx`
- Reference: `apps/sva-studio-react/src/routes/admin/organizations/-organization-create-page.tsx`
- Reference: `apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.tsx`
- Reference: `apps/sva-studio-react/src/routes/admin/instances/-instance-create-page.tsx`
- Reference: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-configuration-section.tsx`
- Reference: `apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-create-page.tsx`
- Reference: `apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-detail-page.tsx`
- Reference: `apps/sva-studio-react/src/routes/admin/roles/-role-create-page.tsx`
- Reference: `apps/sva-studio-react/src/routes/admin/roles/-role-detail-page.tsx`
- Reference: `apps/sva-studio-react/src/routes/interfaces/-interfaces-page.dialogs.tsx`
- Reference: `apps/sva-studio-react/src/routes/content/-content-editor-page.tsx`
- Reference: `packages/plugin-poi/src/poi.pages.tsx`
- Reference: `packages/plugin-waste-management/src/waste-management.master-data-entity-dialogs.tsx`
- Reference: `packages/plugin-waste-management/src/waste-management.master-data-location-form-content.tsx`
- Reference: `packages/plugin-waste-management/src/waste-management.settings-form.tsx`
- Reference: `packages/plugin-waste-management/src/waste-management.scheduling-form-content.tsx`
- Reference: `packages/plugin-waste-management/src/waste-management.tours-form-content.tsx`

- [ ] **Step 1: Build the inventory template with required columns**

Create the document with a table header equivalent to:

```md
| Pfad | Zweck | Host/Plugin | Muster heute | Validierung | Submit-Pfad | Primitiven | Tests | RHF-Bedarf | MSW-Bedarf | fast-check-Kandidat | Priorität | Risiko | Legacy-Ausnahme | Zielzustand |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

- [ ] **Step 2: Fill host entries**

Populate at least the host areas named in the approved design:

```md
- admin/users
- admin/groups
- admin/organizations
- admin/instances
- admin/legal-texts
- admin/roles
- interfaces
- content
```

- [ ] **Step 3: Fill plugin entries**

Populate plugin entries for at least:

```md
- packages/plugin-poi/src/poi.pages.tsx
- packages/plugin-waste-management/src/waste-management.master-data-entity-dialogs.tsx
- packages/plugin-waste-management/src/waste-management.master-data-location-form-content.tsx
- packages/plugin-waste-management/src/waste-management.settings-form.tsx
- packages/plugin-waste-management/src/waste-management.scheduling-form-content.tsx
- packages/plugin-waste-management/src/waste-management.tours-form-content.tsx
```

- [ ] **Step 4: Review the inventory for migration ordering**

Run: `rg -n "^\\|" docs/development/studio-form-migrationsinventur.md`

Expected: A complete table with no empty rows for the mandatory columns.

- [ ] **Step 5: Commit**

```bash
git add docs/development/studio-form-migrationsinventur.md
git commit -m "docs: add studio form migration inventory"
```

## Task 3: Dependencies und gemeinsame Package-Grenzen vorbereiten

**Files:**
- Modify: `package.json`
- Modify: `apps/sva-studio-react/package.json`
- Modify: `packages/studio-ui-react/package.json`
- Modify: `packages/plugin-poi/package.json`
- Modify: `packages/plugin-waste-management/package.json`
- Modify: `tooling/testing/package.json`
- Modify: `packages/core/package.json`
- Modify: `packages/routing/package.json`

- [ ] **Step 1: Write the failing dependency checklist**

Document the expected dependency placement:

```md
- `react-hook-form` and `@hookform/resolvers` only in frontend runtime projects
- `msw` and `fast-check` only as test/dev dependencies where needed
- no browser-only runtime dependency added to server-side workspace packages
```

- [ ] **Step 2: Inspect current package manifests before editing**

Run: `rg -n "\"dependencies\"|\"devDependencies\"|react-hook-form|@hookform/resolvers|msw|fast-check" package.json apps/sva-studio-react/package.json packages/studio-ui-react/package.json packages/plugin-poi/package.json packages/plugin-waste-management/package.json tooling/testing/package.json packages/core/package.json packages/routing/package.json`

Expected: No existing or only partial foundation dependencies.

- [ ] **Step 3: Add minimal dependencies in the correct scopes**

Manifest changes should follow this pattern:

```json
{
  "dependencies": {
    "react-hook-form": "^7.x",
    "@hookform/resolvers": "^3.x"
  },
  "devDependencies": {
    "msw": "^2.x",
    "fast-check": "^3.x"
  }
}
```

- [ ] **Step 4: Validate install and project graph**

Run: `pnpm install --lockfile-only`

Run: `pnpm nx show projects | rg 'sva-studio-react|studio-ui-react|plugin-poi|plugin-waste-management|tooling-testing|core|routing'`

Expected: Lockfile updates cleanly and all target projects remain visible.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml apps/sva-studio-react/package.json packages/studio-ui-react/package.json packages/plugin-poi/package.json packages/plugin-waste-management/package.json tooling/testing/package.json packages/core/package.json packages/routing/package.json
git commit -m "build: add studio foundation dependencies"
```

## Task 4: RHF-Bridge in `studio-ui-react` einführen

**Files:**
- Create: `packages/studio-ui-react/src/studio-form-bridge.tsx`
- Modify: `packages/studio-ui-react/src/index.ts`
- Modify: `packages/studio-ui-react/src/studio-primitives.tsx`
- Modify: `packages/studio-ui-react/src/studio-primitives.test.tsx`
- Create: `packages/studio-ui-react/src/studio-form-bridge.test.tsx`

- [ ] **Step 1: Write failing bridge tests**

Add tests for:

```tsx
it('maps a field error to StudioField', () => {})
it('renders summary errors with focusable anchor behavior', () => {})
it('supports register-only inputs without Controller', () => {})
it('supports Controller for controlled Select components', () => {})
```

- [ ] **Step 2: Run the new studio-ui-react tests to verify failure**

Run: `pnpm nx run studio-ui-react:test --testFiles=src/studio-form-bridge.test.tsx`

Expected: FAIL because the bridge module and exports do not exist yet.

- [ ] **Step 3: Implement the minimal bridge API**

Introduce a focused API shaped like:

```tsx
export type StudioFormFieldError = Readonly<{ field: string; message: string }>;

export function StudioFormSummaryErrors(props: {
  errors: readonly StudioFormFieldError[];
  title?: string;
}): JSX.Element;

export function getStudioFieldError(
  error: FieldError | undefined,
): string | undefined;
```

- [ ] **Step 4: Export and integrate the bridge with existing primitives**

Update exports so consumers import from one place:

```ts
export {
  StudioFormSummaryErrors,
  getStudioFieldError,
} from './studio-form-bridge.js';
```

- [ ] **Step 5: Run the targeted package checks**

Run: `pnpm nx run studio-ui-react:test --testFiles=src/studio-form-bridge.test.tsx --testFiles=src/studio-primitives.test.tsx`

Run: `pnpm nx run studio-ui-react:test:types`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/studio-ui-react/src/studio-form-bridge.tsx packages/studio-ui-react/src/studio-form-bridge.test.tsx packages/studio-ui-react/src/studio-primitives.tsx packages/studio-ui-react/src/studio-primitives.test.tsx packages/studio-ui-react/src/index.ts packages/studio-ui-react/package.json
git commit -m "feat: add studio react hook form bridge"
```

## Task 5: Gemeinsames MSW-Test-Setup bereitstellen

**Files:**
- Create: `tooling/testing/src/msw/server.ts`
- Create: `tooling/testing/src/msw/browser.ts`
- Create: `tooling/testing/src/msw/handlers.ts`
- Create: `tooling/testing/src/msw/reset.ts`
- Create: `tooling/testing/src/msw/index.ts`
- Modify: `tooling/testing/project.json`
- Modify: `apps/sva-studio-react/vitest.shared.ts`
- Modify: `packages/plugin-poi/vitest.config.ts`
- Modify: `packages/plugin-waste-management/vitest.config.ts`

- [ ] **Step 1: Write failing setup smoke tests**

Add one lightweight test in a consuming project asserting the setup contract:

```ts
it('resets MSW handlers between tests', async () => {})
it('can override a default handler per test', async () => {})
```

- [ ] **Step 2: Run the consumer test before implementation**

Run: `pnpm nx run sva-studio-react:test --testFiles=src/routes/content/-content-editor-page.test.tsx`

Expected: FAIL or continue using old mocking style until the shared setup exists.

- [ ] **Step 3: Implement the shared MSW modules**

The exported contract should look like:

```ts
export const studioMswServer = setupServer(...defaultHandlers);
export function resetStudioMswHandlers(): void {
  studioMswServer.resetHandlers();
}
export { http, HttpResponse } from 'msw';
```

- [ ] **Step 4: Wire the setup into shared Vitest configuration**

Ensure the shared test bootstrap imports the reset hook once:

```ts
beforeAll(() => studioMswServer.listen());
afterEach(() => resetStudioMswHandlers());
afterAll(() => studioMswServer.close());
```

- [ ] **Step 5: Run targeted test suites**

Run: `pnpm nx run tooling-testing:test`

Run: `pnpm nx run sva-studio-react:test --testFiles=src/routes/content/-content-editor-page.test.tsx`

Run: `pnpm nx run plugin-poi:test`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tooling/testing/src/msw tooling/testing/project.json tooling/testing/package.json apps/sva-studio-react/vitest.shared.ts packages/plugin-poi/vitest.config.ts packages/plugin-waste-management/vitest.config.ts
git commit -m "test: add shared msw foundation"
```

## Task 6: `fast-check`-Hotspots und erste Properties definieren

**Files:**
- Create: `docs/development/fast-check-hotspots.md`
- Modify: `packages/core/package.json`
- Modify: `packages/routing/package.json`
- Create or Modify: first hotspot tests under `packages/core/src/**/*.test.ts`
- Create or Modify: first hotspot tests under `packages/routing/src/**/*.test.ts`

- [ ] **Step 1: Select the initial hotspots from existing critical logic**

Record at least:

```md
- parser or guard logic in `packages/core`
- routing or query invariant logic in `packages/routing`
```

- [ ] **Step 2: Write failing property tests**

Use concrete property shapes like:

```ts
it('normalization is idempotent for arbitrary valid input', () => {
  fc.assert(fc.property(arbitraryInput(), (value) => {
    expect(normalize(normalize(value))).toEqual(normalize(value));
  }));
});
```

- [ ] **Step 3: Run targeted tests to verify failure or missing dependency**

Run: `pnpm nx run core:test`

Run: `pnpm nx run routing:test`

Expected: FAIL until `fast-check` and the first properties are wired.

- [ ] **Step 4: Implement or refine the hotspot tests**

Keep the first batch intentionally small:

```md
- one property in `core`
- one property in `routing`
- a short rationale per property in `docs/development/fast-check-hotspots.md`
```

- [ ] **Step 5: Re-run targeted checks**

Run: `pnpm nx run core:test`

Run: `pnpm nx run routing:test`

Run: `pnpm check:server-runtime`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add docs/development/fast-check-hotspots.md packages/core/package.json packages/routing/package.json packages/core/src packages/routing/src
git commit -m "test: add first fast-check hotspot coverage"
```

## Task 7: Host-Referenzmigrationen auf den Standardpfad

**Files:**
- Modify: `apps/sva-studio-react/src/routes/admin/users/-user-create-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/users/-user-create-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/content/-content-editor-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/content/-content-editor-page.test.tsx`

- [ ] **Step 1: Write or tighten failing tests around form behavior**

Cover at least:

```tsx
it('shows resolver-driven field errors in the user create form', async () => {})
it('focuses the summary or first invalid field on invalid submit', async () => {})
it('submits the content editor through the shared RHF path', async () => {})
```

- [ ] **Step 2: Run the host tests before migration**

Run: `pnpm nx run sva-studio-react:test --testFiles=src/routes/admin/users/-user-create-page.test.tsx --testFiles=src/routes/content/-content-editor-page.test.tsx`

Expected: FAIL or show current manual orchestration assumptions that must be removed.

- [ ] **Step 3: Migrate the host forms to the shared RHF bridge**

The migrated structure should resemble:

```tsx
const form = useForm<FormValues>({
  resolver: zodResolver(schema),
  defaultValues,
});

return (
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <StudioFormSummaryErrors errors={summaryErrors} />
  </form>
);
```

- [ ] **Step 4: Replace HTTP-level stubs in associated tests with MSW where applicable**

Use the shared handler override style:

```ts
studioMswServer.use(
  http.post('/api/...', () => HttpResponse.json({ ok: true })),
);
```

- [ ] **Step 5: Run affected checks**

Run: `pnpm nx run sva-studio-react:test --testFiles=src/routes/admin/users/-user-create-page.test.tsx --testFiles=src/routes/content/-content-editor-page.test.tsx`

Run: `pnpm nx run sva-studio-react:test:types`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/sva-studio-react/src/routes/admin/users/-user-create-page.tsx apps/sva-studio-react/src/routes/admin/users/-user-create-page.test.tsx apps/sva-studio-react/src/routes/content/-content-editor-page.tsx apps/sva-studio-react/src/routes/content/-content-editor-page.test.tsx
git commit -m "feat: migrate host forms to studio foundations"
```

## Task 8: Plugin-Referenzmigrationen auf den Standardpfad

**Files:**
- Modify: `packages/plugin-poi/src/poi.pages.tsx`
- Create or Modify: `packages/plugin-poi/src/poi.pages.test.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-entity-dialogs.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-location-form-content.tsx`
- Create or Modify: targeted tests under `packages/plugin-waste-management/tests/`

- [ ] **Step 1: Add failing plugin tests for shared form behavior**

Cover at least:

```tsx
it('maps POI validation errors through shared StudioField helpers', async () => {})
it('submits waste management entity dialogs through RHF', async () => {})
it('uses MSW for plugin HTTP-facing test paths', async () => {})
```

- [ ] **Step 2: Run plugin tests before migration**

Run: `pnpm nx run plugin-poi:test`

Run: `pnpm nx run plugin-waste-management:test`

Expected: FAIL in the new tests or expose manual form wiring that the migration will replace.

- [ ] **Step 3: Migrate the chosen plugin forms**

Aim for the same form contract as host code:

```tsx
const form = useForm<PluginFormValues>({
  resolver: zodResolver(pluginSchema),
});
```

- [ ] **Step 4: Convert plugin HTTP-level test doubles to MSW where the test is really about network behavior**

Shared handler usage should look like:

```ts
studioMswServer.use(
  http.get('/api/plugin/...', () => HttpResponse.json(payload)),
);
```

- [ ] **Step 5: Run affected plugin checks**

Run: `pnpm nx run plugin-poi:test`

Run: `pnpm nx run plugin-waste-management:test`

Run: `pnpm nx run plugin-poi:test:types`

Run: `pnpm nx run plugin-waste-management:test:types`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-poi/src/poi.pages.tsx packages/plugin-poi/src/poi.pages.test.tsx packages/plugin-waste-management/src/waste-management.master-data-entity-dialogs.tsx packages/plugin-waste-management/src/waste-management.master-data-location-form-content.tsx packages/plugin-waste-management/tests
git commit -m "feat: migrate plugin forms to studio foundations"
```

## Task 9: Governance-, ADR- und Architektur-Dokumentation abschließen

**Files:**
- Modify: `docs/development/testing-strategy.md`
- Modify: `docs/development/testing-coverage.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/architecture/09-architecture-decisions.md`
- Modify: `docs/architecture/10-quality-requirements.md`
- Create or Modify: `docs/architecture/decisions/ADR-0xx-formular-foundation-mit-react-hook-form-und-zodresolver.md`
- Create or Modify: `docs/architecture/decisions/ADR-0xx-frontend-test-foundation-mit-msw-und-fast-check.md`

- [ ] **Step 1: Draft the ADR skeletons**

Each ADR should include:

```md
## Status
## Kontext
## Entscheidung
## Konsequenzen
## Ausnahmen
```

- [ ] **Step 2: Add governance language to testing and architecture docs**

Required doc points:

```md
- wann RHF verpflichtend ist
- wann MSW verpflichtend ist
- wann Modul-Mocks zulässig bleiben
- wie `fast-check`-Pflicht im Review geprüft wird
- wie Legacy-Ausnahmen dokumentiert werden
```

- [ ] **Step 3: Run document placement and link checks that exist today**

Run: `pnpm check:file-placement`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/development/testing-strategy.md docs/development/testing-coverage.md docs/architecture/05-building-block-view.md docs/architecture/08-cross-cutting-concepts.md docs/architecture/09-architecture-decisions.md docs/architecture/10-quality-requirements.md docs/architecture/decisions
git commit -m "docs: document studio foundations governance"
```

## Task 10: Final validation and PR gate

**Files:**
- Verify only

- [ ] **Step 1: Run targeted affected tests after all migration blocks**

Run: `pnpm nx affected --target=test --base=origin/main`

Expected: PASS

- [ ] **Step 2: Run required type and lint gates**

Run: `pnpm test:types`

Run: `pnpm test:eslint`

Expected: PASS

- [ ] **Step 3: Run server runtime gate because `core` or `routing` may change**

Run: `pnpm check:server-runtime`

Expected: PASS

- [ ] **Step 4: Run the preferred PR gate**

Run: `pnpm test:pr`

Expected: PASS

- [ ] **Step 5: Commit any final fixes**

```bash
git status --short
git add -A
git commit -m "chore: finish studio foundations rollout" || true
```

## Self-Review

### Spec coverage

- OpenSpec tightening is covered by Task 1.
- Mandatory inventory is covered by Task 2.
- Runtime and test dependency placement is covered by Task 3.
- Shared RHF path is covered by Task 4.
- Shared MSW path is covered by Task 5.
- First `fast-check` hotspots are covered by Task 6.
- Host and plugin reference migrations are covered by Tasks 7 and 8.
- Governance, ADR, and architecture updates are covered by Task 9.
- Required validation gates are covered by Task 10.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” markers remain in task steps.
- Every task names exact files and concrete commands.
- Code-bearing steps include an explicit target API or test shape.

### Scope check

- The plan stays within one implementation stream: strengthen the change, create the inventory, build shared foundations, migrate representative flows, then document and validate.
- Full migration of every legacy form is intentionally not in scope for this first rollout; the inventory and governance work define the queue for later migrations.
