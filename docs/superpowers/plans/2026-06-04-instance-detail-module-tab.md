# Instance Detail Module Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Root-Admin-Instanz-Detailseite bekommt einen eigenen Tab `Module`, der die bestehende instanzgebundene Modulverwaltung fuer genau diese Instanz wiederverwendet.

**Architecture:** Die bestehende UI aus `/admin/modules` wird in einen gemeinsamen Workspace extrahiert. Derselbe Workspace rendert entweder mit Instanz-Select fuer die Sammelseite oder mit festem `instanceId`-Kontext fuer den neuen Detail-Tab. Root-only-Mutationen, `useInstances` und die bestehenden API-Vertraege bleiben unveraendert.

**Tech Stack:** React, TanStack Router, Vitest, Testing Library, shadcn/ui, OpenSpec

---

### Task 1: OpenSpec und Doku verankern

**Files:**
- Modify: `openspec/changes/update-instance-detail-module-tab/proposal.md`
- Modify: `openspec/changes/update-instance-detail-module-tab/tasks.md`
- Modify: `openspec/changes/update-instance-detail-module-tab/specs/account-ui/spec.md`
- Modify: `docs/guides/instance-module-management.md`

- [ ] **Step 1: Validate the change definition**

Run: `openspec validate update-instance-detail-module-tab --strict`
Expected: `Change 'update-instance-detail-module-tab' is valid`

- [ ] **Step 2: Update the operator guide after code is in place**

Add the detail-tab entry path to `docs/guides/instance-module-management.md`:

```md
1. Instanzdetail unter `/admin/instances/$instanceId` oeffnen.
2. Tab `Module` waehlen.
3. Zuweisung, Entzug, IAM-Basis-Rebuild oder Admin-Struktur direkt fuer diese Instanz ausfuehren.
```

### Task 2: Shared module workspace extract

**Files:**
- Create: `apps/sva-studio-react/src/routes/admin/modules/-instance-modules-workspace.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/modules/-modules-page.tsx`
- Test: `apps/sva-studio-react/src/routes/admin/modules/-modules-page.test.tsx`

- [ ] **Step 1: Write a failing test for instance-bound rendering**

Add a test proving the workspace can render without an instance select and still show assigned plus available modules for a fixed `instanceId`.

- [ ] **Step 2: Run the targeted test to verify failure**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/modules/-modules-page.test.tsx`
Expected: FAIL because the shared workspace or fixed-instance mode does not exist yet.

- [ ] **Step 3: Extract the shared workspace**

Move the assigned/available module cards, seed action, revoke confirm dialog, and bootstrap action wiring into a reusable component with props roughly shaped like:

```ts
type InstanceModulesWorkspaceProps = {
  readonly mode: 'selected-instance' | 'fixed-instance';
  readonly instanceId?: string;
};
```

- [ ] **Step 4: Keep `/admin/modules` working through the shared workspace**

Refactor `AdminModulesPage` so it only handles top-level page framing and passes the selected instance context into the extracted workspace.

- [ ] **Step 5: Re-run the targeted unit test**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/modules/-modules-page.test.tsx`
Expected: PASS

### Task 3: Integrate the new detail tab

**Files:**
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-page.tsx`
- Possibly modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-modules-section.tsx`
- Test: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-page.test.tsx`

- [ ] **Step 1: Write failing detail-page tests for the new tab**

Add assertions for:

```ts
expect(screen.getByRole('tab', { name: 'Module' })).toBeTruthy();
```

And a flow that opens the tab and triggers module actions for the current instance.

- [ ] **Step 2: Run the detail-page test to verify failure**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instance-detail-page.test.tsx`
Expected: FAIL because the tab does not exist yet.

- [ ] **Step 3: Add the `Module` tab and mount the shared workspace**

Extend the tab union and tab list in `-instance-detail-page.tsx`, then render the extracted shared workspace with the current route `instanceId`.

- [ ] **Step 4: Remove duplicated read-only module rendering from the overview**

Keep the IAM baseline signal where it belongs, but move the full module list and actions into the new tab so the page has one clear module workspace.

- [ ] **Step 5: Re-run the detail-page test**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instance-detail-page.test.tsx`
Expected: PASS

### Task 4: Confirmation semantics and action coverage

**Files:**
- Modify: `apps/sva-studio-react/src/routes/admin/modules/-instance-modules-workspace.tsx`
- Modify: `apps/sva-studio-react/src/hooks/use-instances.ts`
- Test: `apps/sva-studio-react/src/routes/admin/modules/-modules-page.test.tsx`
- Test: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-page.test.tsx`

- [ ] **Step 1: Add failing tests for confirm behavior**

Cover:
- `assignModule` runs directly
- `seedIamBaseline` runs directly
- `revokeModule` requires dialog confirmation
- `bootstrapAdminStructure` requires dialog confirmation

- [ ] **Step 2: Run the affected tests to verify failure**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/modules/-modules-page.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-page.test.tsx`
Expected: FAIL on the missing bootstrap confirm and/or shared tab flow.

- [ ] **Step 3: Implement the confirm split**

Use the existing `ConfirmDialog` pattern for revoke and add an analogous confirm path for bootstrap, while keeping assign and seed direct.

- [ ] **Step 4: Re-run the affected tests**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/modules/-modules-page.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-page.test.tsx`
Expected: PASS

### Task 5: i18n, docs, and gate path

**Files:**
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`
- Modify: `docs/guides/instance-module-management.md`

- [ ] **Step 1: Add the new tab label and confirm copy**

Introduce the `admin.instances.cockpit.tabs.modules` label and any missing bootstrap-confirm strings in `resources.ts`.

- [ ] **Step 2: Run the smallest real gate path**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/modules/-modules-page.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-page.test.tsx`
Expected: PASS

Run: `pnpm nx affected --target=test:unit --base=origin/main`
Expected: PASS for affected unit targets.

- [ ] **Step 3: Run the relevant type gate if UI types changed**

Run: `pnpm nx affected --target=test:types --base=origin/main`
Expected: PASS
