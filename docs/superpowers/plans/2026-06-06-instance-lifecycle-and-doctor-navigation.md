# Instance Lifecycle and Doctor Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Instanzverwaltung trennt Anlage, einmaliges Setup, ruhigen Bestandsbetrieb, dauerhaften Doctor-Modus und nachgeordnete Einstellungen so, dass Modulverwaltung der Happy Path bleibt und Diagnose/Reparatur gezielt fokussiert werden.

**Architecture:** Die Umsetzung trennt den heutigen Alles-auf-einer-Seite-Ansatz in zwei Ebenen. Erstens bekommt die Inbetriebnahme einen eigenen Setup-Abschluss-Pfad unter einer separaten Route. Zweitens wird die bisherige Detailseite zur Bestands-Hülle mit den drei Modi `Betrieb`, `Doctor` und `Einstellungen`, wobei bestehende Sections und Modelle gezielt wiederverwendet und neu zugeschnitten werden statt parallel neue Logik aufzubauen.

**Tech Stack:** TypeScript strict mode, React, TanStack Router, Vitest, Testing Library, Nx, shadcn/ui, OpenSpec

---

### Task 1: OpenSpec-Follow-up und Änderungsgrenzen festziehen

**Files:**
- Create: `openspec/changes/refactor-instance-lifecycle-doctor-navigation/proposal.md`
- Create: `openspec/changes/refactor-instance-lifecycle-doctor-navigation/tasks.md`
- Create: `openspec/changes/refactor-instance-lifecycle-doctor-navigation/specs/account-ui/spec.md`
- Create: `openspec/changes/refactor-instance-lifecycle-doctor-navigation/specs/instance-provisioning/spec.md`
- Reference: `docs/superpowers/specs/2026-06-06-instance-lifecycle-and-doctor-navigation-design.md`

- [ ] **Step 1: Scaffold the follow-up change**

Create the new change folder and anchor the design decisions as implementation scope:

```md
# Change: Instanz-Lebenszyklus und Doctor-Navigation neu strukturieren

## Why
Die bestehende Instanz-Detailseite mischt einmaliges Setup, laufenden Betrieb,
Diagnose und Stammdatenpflege auf derselben Fläche.

## What Changes
- separater Setup-Abschluss-Flow nach der Anlage
- Bestandsseite mit `Betrieb`, `Doctor` und `Einstellungen`
- dauerhafter Doctor-Einstieg mit geführtem Diagnose- und Reparaturablauf
```

- [ ] **Step 2: Capture the behavioral deltas**

Add requirement coverage for:

```md
### Requirement: Setup-Abschluss ist ein eigener Flow
...

### Requirement: Bestandsinstanzen öffnen standardmäßig im Betrieb
...

### Requirement: Doctor ist dauerhaft erreichbar und geführt
...
```

Use `account-ui` for the user-visible navigation and `instance-provisioning` for the setup-completion semantics.

- [ ] **Step 3: Validate the change definition**

Run:

```bash
openspec validate refactor-instance-lifecycle-doctor-navigation --strict
```

Expected:
- `Change 'refactor-instance-lifecycle-doctor-navigation' is valid`

### Task 2: Routing- und Navigationsvertrag für Setup und Bestandsmodi einführen

**Files:**
- Create: `apps/sva-studio-react/src/routes/admin/instances/-instance-management-navigation.ts`
- Modify: `packages/routing/src/route-paths.ts`
- Modify: `packages/routing/src/app.routes.shared.ts`
- Modify: `packages/routing/src/admin-resource-routes.ts`
- Modify: `apps/sva-studio-react/src/routing/app-route-bindings.tsx`
- Modify: `apps/sva-studio-react/src/routing/app-route-bindings.test.tsx`
- Modify: `packages/routing/src/app.routes.test.tsx`
- Modify: `packages/routing/src/admin-resource-routes.test.ts`

- [ ] **Step 1: Write the failing route-contract tests**

Add assertions for a dedicated setup path and the unchanged bestands detail path:

```ts
expect(uiRoutePaths.adminInstanceSetup).toBe('/admin/instances/$instanceId/setup');
expect(uiRoutePaths.adminInstanceDetail).toBe('/admin/instances/$instanceId');
```

And an app binding expectation for a new `adminInstanceSetup` route component.

- [ ] **Step 2: Run the route tests to verify failure**

Run:

```bash
pnpm nx run routing:test:unit --testFiles=src/app.routes.test.tsx --testFiles=src/admin-resource-routes.test.ts
pnpm nx run sva-studio-react:test:unit --testFiles=src/routing/app-route-bindings.test.tsx
```

Expected:
- FAIL because the setup route and binding do not exist yet.

- [ ] **Step 3: Add the route path and app binding**

Introduce a dedicated setup route plus a local bestands-view normalizer:

```ts
export const uiRoutePaths = {
  adminInstanceCreate: '/admin/instances/new',
  adminInstanceSetup: '/admin/instances/$instanceId/setup',
  adminInstanceDetail: '/admin/instances/$instanceId',
} as const;
```

```ts
export type InstanceManagementView = 'betrieb' | 'doctor' | 'einstellungen';

export const normalizeInstanceManagementView = (value: unknown): InstanceManagementView =>
  value === 'doctor' || value === 'einstellungen' ? value : 'betrieb';
```

- [ ] **Step 4: Re-run the route slice**

Run:

```bash
pnpm nx run routing:test:unit --testFiles=src/app.routes.test.tsx --testFiles=src/admin-resource-routes.test.ts
pnpm nx run sva-studio-react:test:unit --testFiles=src/routing/app-route-bindings.test.tsx
```

Expected:
- PASS

### Task 3: Setup-Abschluss aus der Detailseite herauslösen

**Files:**
- Create: `apps/sva-studio-react/src/routes/admin/instances/-instance-setup-page.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/instances/-instance-setup-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-create-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-create-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-models.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-workflow.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instances-shared-types.ts`

- [ ] **Step 1: Write failing tests for the post-create handoff**

Cover:
- success CTA from create page points to `/admin/instances/$instanceId/setup`
- the setup page shows focused completion steps instead of the full bestands surface
- setup is considered complete only after `active` plus initialized admin structure

Representative assertion:

```ts
expect(screen.getByRole('link', { name: 'Setup abschließen' }).getAttribute('href')).toBe('/admin/instances/demo/setup');
```

- [ ] **Step 2: Run the create/setup tests to verify failure**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instance-create-page.test.tsx --testFiles=src/routes/admin/instances/-instance-setup-page.test.tsx
```

Expected:
- FAIL because the create CTA still points to the old detail route and the setup page does not exist.

- [ ] **Step 3: Build the dedicated setup page**

Reuse existing provisioning and bootstrap logic, but trim the page to one-time completion concerns:

```tsx
return (
  <section className="space-y-5">
    <SetupStatusCard ... />
    <SetupWorkflowCard ... />
    <SetupAdminBootstrapCard ... />
    <SetupCompletionActions ... />
  </section>
);
```

Rules:
- keep `activateInstance` and `bootstrapAdminStructure` in this flow
- do not surface `Betrieb`, `Doctor` or `Einstellungen` here
- send the user to the bestandsseite only after setup completion

- [ ] **Step 4: Update the create success state**

Change the primary CTA after successful instance creation:

```tsx
<Link to="/admin/instances/$instanceId/setup" params={{ instanceId: createdInstance.instanceId }}>
  {t('admin.instances.success.actions.completeSetup')}
</Link>
```

Keep a secondary link back to the list or detail only if needed, but make setup completion the primary next step.

- [ ] **Step 5: Re-run the setup slice**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instance-create-page.test.tsx --testFiles=src/routes/admin/instances/-instance-setup-page.test.tsx
```

Expected:
- PASS

### Task 4: Bestandsseite zur ruhigen Betriebs-Hülle umbauen

**Files:**
- Create: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-header.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-betrieb-section.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-view-shared.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-sections.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/modules/-instance-modules-workspace.tsx`
- Test: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-page.test.tsx`
- Test: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-split-sections.test.tsx`

- [ ] **Step 1: Write failing tests for the new bestands shell**

Add assertions for:

```ts
expect(screen.getByRole('tab', { name: 'Betrieb' })).toBeTruthy();
expect(screen.getByRole('tab', { name: 'Doctor' })).toBeTruthy();
expect(screen.getByRole('tab', { name: 'Einstellungen' })).toBeTruthy();
expect(screen.getByRole('button', { name: 'Doctor öffnen' })).toBeTruthy();
```

Also assert that a fully configured instance opens with `Betrieb` selected.

- [ ] **Step 2: Run the detail-page tests to verify failure**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instance-detail-page.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-split-sections.test.tsx
```

Expected:
- FAIL because the current page still renders `Überblick`, `Konfiguration`, `Module`, `Historie`.

- [ ] **Step 3: Replace the old cockpit-first shell**

Introduce a compact head plus the three permanent bestands modes:

```tsx
<InstanceDetailHeader
  selectedInstance={selectedInstance}
  setupStatus={setupStatus}
  operationalStatus={operationalStatus}
  onOpenDoctor={() => setActiveView('doctor')}
/>

<Tabs value={activeView} ...>
  <TabsTrigger value="betrieb">Betrieb</TabsTrigger>
  <TabsTrigger value="doctor">Doctor</TabsTrigger>
  <TabsTrigger value="einstellungen">Einstellungen</TabsTrigger>
</Tabs>
```

Keep the detail route stable and default to `betrieb` for completed setups.

- [ ] **Step 4: Make Betrieb the happy-path module workspace**

Build `-instance-detail-betrieb-section.tsx` around the existing workspace:

```tsx
<InstanceModulesWorkspace
  selectedInstance={selectedInstance}
  showBootstrapAction={false}
  showGuidance={true}
  ...
/>
```

Rules:
- module assignment and revoke stay here
- `seedIamBaseline` can stay here as an operational standard action
- `bootstrapAdminStructure` must not remain a normal Betrieb action once setup is separate

- [ ] **Step 5: Re-run the bestands-shell tests**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instance-detail-page.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-split-sections.test.tsx
```

Expected:
- PASS

### Task 5: Doctor als geführten Diagnose- und Reparaturmodus aufbauen

**Files:**
- Create: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-doctor-section.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-doctor-model.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-cockpit.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-cockpit-helpers.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-history-section.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-operations-section.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-models.test.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-split-sections.test.tsx`

- [ ] **Step 1: Write failing Doctor-flow tests**

Cover:
- `Doctor öffnen` is always present in the header
- an auto-detected problem adds warning context without moving the button
- the Doctor surface shows the four steps `Überblick`, `Empfohlene Maßnahme`, `Reparatur ausführen`, `Validieren`
- the overview shows green and non-green checks together
- history lives inside the Doctor context

Representative assertion:

```ts
expect(screen.getByText('Überblick')).toBeTruthy();
expect(screen.getByText('Empfohlene Maßnahme')).toBeTruthy();
```

- [ ] **Step 2: Run the Doctor-focused tests to verify failure**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instance-detail-page.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-split-sections.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-models.test.ts
```

Expected:
- FAIL because the current technical views are not organized as a guided Doctor flow.

- [ ] **Step 3: Build a Doctor model from existing evidence**

Use existing runtime state instead of inventing parallel status logic:

```ts
export type InstanceDoctorModel = {
  readonly checks: readonly DoctorCheckItem[];
  readonly recommendedAction: DetailWorkflowAction | 'focus_history';
  readonly validationState: 'ready' | 'blocked' | 'degraded';
};
```

Sources:
- tenant IAM status
- configuration assessment
- latest provisioning run
- preflight and keycloak status

- [ ] **Step 4: Compose the guided Doctor section**

Render one focused section instead of multiple equal-weight technical cards:

```tsx
<DoctorOverviewStep checks={doctorModel.checks} />
<DoctorRecommendationStep action={doctorModel.recommendedAction} />
<DoctorRepairStep ... />
<DoctorValidationStep ... />
<InstanceDetailHistorySection ... />
```

Rules:
- do not skip the overview even when the system already found a problem
- show green prerequisites explicitly
- keep technical run history subordinate to the Doctor flow

- [ ] **Step 5: Re-run the Doctor slice**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instance-detail-page.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-split-sections.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-models.test.ts
```

Expected:
- PASS

### Task 6: Einstellungen aus der Hauptarbeitsfläche herausziehen

**Files:**
- Create: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-settings-section.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-configuration-section.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-view-shared.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-page.test.tsx`

- [ ] **Step 1: Write failing tests for Einstellungen isolation**

Add assertions that:
- configuration fields only render under `Einstellungen`
- the default bestands page does not show the full configuration form
- saving settings still calls `updateInstance` with the current contract

- [ ] **Step 2: Run the settings-focused test to verify failure**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instance-detail-page.test.tsx
```

Expected:
- FAIL because the configuration form is still part of the main current layout.

- [ ] **Step 3: Mount the existing configuration form as Einstellungen**

Keep the existing contract and form model, but move the surface under the dedicated settings view:

```tsx
<TabsContent value="einstellungen">
  <InstanceDetailSettingsSection
    selectedInstance={selectedInstance}
    detailFormValues={detailFormValues}
    ...
  />
</TabsContent>
```

The settings view may retain the configuration assessment card, but it should not compete with Betrieb in the default state.

- [ ] **Step 4: Re-run the settings slice**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instance-detail-page.test.tsx
```

Expected:
- PASS

### Task 7: Copy, user docs, and real gate path

**Files:**
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`
- Create: `docs/guides/instance-lifecycle-navigation.md`
- Modify: `openspec/changes/refactor-instance-lifecycle-doctor-navigation/tasks.md`

- [ ] **Step 1: Add the new copy surface**

Introduce labels and helper copy for:
- `Setup abschließen`
- `Betrieb`
- `Doctor`
- `Einstellungen`
- `Doctor öffnen`
- header warning text for auto-detected issues
- Doctor step labels and summaries

Representative keys:

```ts
admin.instances.navigation.betrieb
admin.instances.navigation.doctor
admin.instances.navigation.settings
admin.instances.doctor.open
admin.instances.doctor.steps.overview
```

- [ ] **Step 2: Document the new operator path**

Create `docs/guides/instance-lifecycle-navigation.md` with:

```md
1. Neue Instanz über `/admin/instances/new` anlegen.
2. Direkt in `Setup abschließen` wechseln.
3. Nach erfolgreichem Setup die Bestandsseite standardmäßig im Modus `Betrieb` nutzen.
4. Für technische Diagnose jederzeit `Doctor öffnen` verwenden.
5. Stammdaten nur noch über `Einstellungen` pflegen.
```

- [ ] **Step 3: Run the smallest real UI gate path**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instance-create-page.test.tsx --testFiles=src/routes/admin/instances/-instance-setup-page.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-page.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-split-sections.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-models.test.ts --testFiles=src/routing/app-route-bindings.test.tsx
```

Expected:
- PASS

Run:

```bash
pnpm nx affected --target=test:unit --base=origin/main
```

Expected:
- PASS for affected unit targets.

- [ ] **Step 4: Run the relevant type and spec gates**

Run:

```bash
pnpm nx affected --target=test:types --base=origin/main
openspec validate refactor-instance-lifecycle-doctor-navigation --strict
```

Expected:
- PASS
