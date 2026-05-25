# Tenant Module Transparency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only module table to the tenant detail view that shows all globally known modules, derives `Aktiv`/`Deaktiviert` from root assignments, and renders a plugin-owned module description for each entry.

**Architecture:** Keep `/admin/modules` as the only write path for assignments. Extend the shared module registry with plugin-owned description metadata, derive a tenant-facing view model from `studioModuleIamContracts` plus `assignedModules`, and render that view model inside the instance detail route without introducing new persistence or a second activation flow.

**Tech Stack:** React, TanStack Router, TypeScript strict mode, Vitest, Nx, shared contracts from `@sva/core`, module registry from `@sva/studio-module-iam`

---

## File Structure

- Modify: `packages/studio-module-iam/src/index.ts`
  Add plugin-owned module description metadata alongside existing IAM contract fields.
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-operations-section.tsx`
  Replace the current IAM-only module card with a tenant-facing module table or add a dedicated table section next to it.
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`
  Add UI copy for table headers, status labels, fallback description, and explanatory text.
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-page.test.tsx`
  Add route-level assertions that the tenant detail page renders the module table correctly.
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-split-sections.test.tsx`
  Extend section-level rendering coverage if the module table is split into a dedicated section component.
- Modify: `apps/sva-studio-react/src/routes/admin/modules/-modules-page.test.tsx`
  Add coverage that root and tenant views consume the same module registry shape after metadata changes.
- Modify: `openspec/specs/account-ui/spec.md`
  Add the approved tenant module transparency requirement.

## Task 1: Extend the Shared Module Registry With Plugin-Owned Descriptions

**Files:**
- Modify: `packages/studio-module-iam/src/index.ts`
- Test: `apps/sva-studio-react/src/routes/admin/modules/-modules-page.test.tsx`

- [ ] **Step 1: Write the failing test for registry-backed module descriptions**

Add expectations to `apps/sva-studio-react/src/routes/admin/modules/-modules-page.test.tsx` that mocked module contracts may include a description field and remain renderable by consumers.

```tsx
vi.mock('../../../lib/plugins', () => ({
  studioModuleIamContracts: [
    {
      moduleId: 'news',
      description: 'Veröffentlicht Nachrichten und redaktionelle Meldungen für den Tenant.',
      permissionIds: ['news.read', 'news.write'],
      systemRoles: [{ roleName: 'news_admin', permissionIds: ['news.read', 'news.write'] }],
    },
  ],
}));

expect(screen.getByText('news')).toBeTruthy();
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/modules/-modules-page.test.tsx`

Expected: FAIL because `description` is not part of the current shared contract type or the mocks no longer satisfy the contract shape.

- [ ] **Step 3: Add minimal description metadata to the shared registry**

Update `packages/studio-module-iam/src/index.ts` so `StudioModuleIamContract` carries a description and each module defines one near its plugin-owned contract.

```ts
export type StudioModuleIamContract = Readonly<{
  moduleId: string;
  namespace: string;
  ownerPluginId: string;
  description: string;
  permissionIds: readonly string[];
  systemRoles: readonly StudioModuleIamSystemRole[];
}>;

const createStandardContentContract = (pluginId: string, description: string): StudioModuleIamContract => ({
  moduleId: pluginId,
  namespace: pluginId,
  ownerPluginId: pluginId,
  description,
  permissionIds: [`${pluginId}.read`, `${pluginId}.create`, `${pluginId}.update`, `${pluginId}.delete`],
  systemRoles: createStandardContentSystemRoles(pluginId),
});
```

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/modules/-modules-page.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the registry metadata change**

```bash
git add packages/studio-module-iam/src/index.ts apps/sva-studio-react/src/routes/admin/modules/-modules-page.test.tsx
git commit -m "feat: add plugin-owned module descriptions"
```

## Task 2: Add a Tenant Module View Model Test First

**Files:**
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-page.test.tsx`
- Test: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-page.test.tsx`

- [ ] **Step 1: Write the failing tenant detail test for module transparency**

Add a test that renders the tenant detail page with one assigned module and one unassigned module and asserts that both appear with the correct status and description.

```tsx
it('renders all known modules with status derived from assignedModules', async () => {
  render(<InstanceDetailPage instanceId="demo" />);

  expect(await screen.findByText('news')).toBeTruthy();
  expect(screen.getByText('Aktiv')).toBeTruthy();
  expect(screen.getByText('Veröffentlicht Nachrichten und redaktionelle Meldungen für den Tenant.')).toBeTruthy();
  expect(screen.getByText('events')).toBeTruthy();
  expect(screen.getByText('Deaktiviert')).toBeTruthy();
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instance-detail-page.test.tsx`

Expected: FAIL because the tenant detail view does not yet render a full module table with derived statuses and descriptions.

- [ ] **Step 3: Add a fallback-focused failing assertion**

Extend the same test file with a case where one module has an empty description and assert that a fallback text is shown.

```tsx
expect(screen.getByText('Keine Modulbeschreibung hinterlegt.')).toBeTruthy();
```

- [ ] **Step 4: Re-run the targeted test to confirm both assertions fail for the right reason**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instance-detail-page.test.tsx`

Expected: FAIL with missing tenant module table and missing fallback text, not with unrelated runtime errors.

- [ ] **Step 5: Commit the failing test scaffold**

```bash
git add apps/sva-studio-react/src/routes/admin/instances/-instance-detail-page.test.tsx
git commit -m "test: cover tenant module transparency"
```

## Task 3: Implement the Tenant Module Table in the Instance Detail UI

**Files:**
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-operations-section.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`
- Test: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-page.test.tsx`

- [ ] **Step 1: Implement the minimal tenant module table renderer**

Create a derived module list from `studioModuleIamContracts` and `selectedInstance.assignedModules`, then render a read-only table or grid with module name, status badge, and description.

```tsx
const tenantModules = studioModuleIamContracts.map((module) => ({
  moduleId: module.moduleId,
  description: module.description.trim() || t('admin.instances.instanceModules.detail.descriptionFallback'),
  isActive: selectedInstance.assignedModules.includes(module.moduleId),
}));
```

- [ ] **Step 2: Add the status and fallback translations**

Extend `apps/sva-studio-react/src/i18n/resources.ts` with exact keys used by the new UI.

```ts
'admin.instances.instanceModules.detail.table.module': 'Modul',
'admin.instances.instanceModules.detail.table.status': 'Status',
'admin.instances.instanceModules.detail.table.description': 'Werbetext',
'admin.instances.instanceModules.detail.status.active': 'Aktiv',
'admin.instances.instanceModules.detail.status.inactive': 'Deaktiviert',
'admin.instances.instanceModules.detail.descriptionFallback': 'Keine Modulbeschreibung hinterlegt.',
```

- [ ] **Step 3: Run the targeted tenant detail test to verify it passes**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instance-detail-page.test.tsx`

Expected: PASS

- [ ] **Step 4: Run the section-level test file to catch rendering regressions**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instance-detail-split-sections.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the tenant module UI**

```bash
git add apps/sva-studio-react/src/routes/admin/instances/-instance-detail-operations-section.tsx apps/sva-studio-react/src/i18n/resources.ts apps/sva-studio-react/src/routes/admin/instances/-instance-detail-page.test.tsx apps/sva-studio-react/src/routes/admin/instances/-instance-detail-split-sections.test.tsx
git commit -m "feat: show tenant module transparency table"
```

## Task 4: Verify the Root View Still Works With the Enriched Registry

**Files:**
- Modify: `apps/sva-studio-react/src/routes/admin/modules/-modules-page.test.tsx`
- Test: `apps/sva-studio-react/src/routes/admin/modules/-modules-page.test.tsx`

- [ ] **Step 1: Add a regression assertion for root assignment behavior**

Extend the root modules page test so it still assigns, revokes, and seeds correctly while consuming contracts that now include descriptions.

```tsx
expect(assignModule).toHaveBeenCalledWith('demo', 'events');
expect(revokeModule).toHaveBeenCalledWith('demo', 'news');
expect(seedIamBaseline).toHaveBeenCalledWith('demo');
```

- [ ] **Step 2: Run the root modules page test**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/modules/-modules-page.test.tsx`

Expected: PASS

- [ ] **Step 3: If the root page should show descriptions too, add one focused failing assertion**

Optional only if adopted during implementation:

```tsx
expect(screen.getByText('Veröffentlicht Nachrichten und redaktionelle Meldungen für den Tenant.')).toBeTruthy();
```

- [ ] **Step 4: Implement the minimal root-page description rendering if the optional assertion was added**

Use the shared `module.description` directly in the existing assigned and available cards without altering assignment behavior.

```tsx
<p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
```

- [ ] **Step 5: Commit the root-view compatibility changes**

```bash
git add apps/sva-studio-react/src/routes/admin/modules/-modules-page.test.tsx apps/sva-studio-react/src/routes/admin/modules/-modules-page.tsx
git commit -m "test: keep root module management compatible with module descriptions"
```

## Task 5: Update the OpenSpec Requirement for Tenant Module Transparency

**Files:**
- Modify: `openspec/specs/account-ui/spec.md`

- [ ] **Step 1: Add a failing validation step by editing the spec before validating**

Insert a new requirement section near the existing module-management requirements describing the tenant detail module table, derived statuses, and plugin-owned descriptions.

```md
### Requirement: Tenant-Detailseite zeigt Modultransparenz

Das System SHALL auf der Instanz-Detailseite alle global bekannten Module mit einem aus der Root-Zuordnung abgeleiteten Status und einer pluginseitig gepflegten Beschreibung anzeigen.
```

- [ ] **Step 2: Run strict OpenSpec validation**

Run: `openspec validate account-ui --strict`

Expected: PASS

- [ ] **Step 3: If validation fails, fix the scenario formatting immediately**

Use a complete scenario block:

```md
#### Scenario: Tenant zeigt aktive und deaktivierte Module

- **GIVEN** eine Instanzdetailseite kennt globale Module und den zugewiesenen Modulsatz
- **WHEN** der Studio-Admin die Detailseite oeffnet
- **THEN** zeigt die UI alle global bekannten Module an
- **AND** markiert zugewiesene Module als aktiv
- **AND** markiert nicht zugewiesene Module als deaktiviert
- **AND** zeigt pro Modul eine pluginseitig gepflegte Beschreibung oder einen definierten Fallbacktext
```

- [ ] **Step 4: Re-run strict validation**

Run: `openspec validate account-ui --strict`

Expected: PASS

- [ ] **Step 5: Commit the spec update**

```bash
git add openspec/specs/account-ui/spec.md
git commit -m "docs: add tenant module transparency requirement"
```

## Task 6: Run the Final Verification Gate

**Files:**
- No code changes expected

- [ ] **Step 1: Run the targeted unit suite for tenant modules**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instance-detail-page.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-split-sections.test.tsx --testFiles=src/routes/admin/modules/-modules-page.test.tsx`

Expected: PASS

- [ ] **Step 2: Run the affected type tests for the React app**

Run: `pnpm nx run sva-studio-react:test:types`

Expected: PASS

- [ ] **Step 3: Run the server-runtime guard only if the implementation touched server-loaded workspace packages**

Run: `pnpm check:server-runtime`

Expected: PASS or SKIPPED if no affected server-runtime package was changed

- [ ] **Step 4: Run the affected lint gate for the app**

Run: `pnpm nx run sva-studio-react:test:eslint`

Expected: PASS

- [ ] **Step 5: Commit the verification checkpoint**

```bash
git add .
git commit -m "test: verify tenant module transparency"
```

## Self-Review

- Spec coverage:
  Task 1 covers plugin-owned descriptions.
  Task 2 and Task 3 cover tenant visibility for all modules, derived statuses, and fallback behavior.
  Task 4 protects the existing root assignment flow.
  Task 5 updates the normative `account-ui` requirement.
  Task 6 covers the requested verification gate.
- Placeholder scan:
  No `TODO`, `TBD`, or implicit “write tests later” steps remain.
- Type consistency:
  The plan consistently uses `description`, `assignedModules`, `studioModuleIamContracts`, `Aktiv`, and `Deaktiviert`.
