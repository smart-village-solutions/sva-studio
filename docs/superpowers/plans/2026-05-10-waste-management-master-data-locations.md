# Waste-Management Master-Data Locations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Waste-Management-Plugin soll im Tab `master-data` sekundäre Tabs `Fractions` und `Locations` erhalten, wobei `Locations` eine Newcms-nahe, dichtere Arbeitsfläche für Abholorte und Hierarchiepflege bietet.

**Architecture:** Die Top-Level-Struktur des Plugins bleibt unverändert. Die Änderung sitzt vollständig in `packages/plugin-waste-management`, erweitert das Search-Param-Modell um einen URL-synchronisierten Untertab und komponiert bestehende Controller, Dialoge und Mutationen in eine neue `Locations`-Arbeitsfläche um.

**Tech Stack:** React, TanStack Router Search-Params, TypeScript strict mode, `@sva/studio-ui-react`, Vitest, Nx

---

### Task 1: Search-Params für `master-data`-Untertabs ergänzen

**Files:**
- Modify: `packages/plugin-waste-management/src/search-params.ts`
- Test: `packages/plugin-waste-management/tests/search-params.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('normalizes the master-data subtab and keeps valid deep links stable', () => {
  expect(
    normalizeWasteManagementSearchParams({
      tab: 'master-data',
      masterDataTab: 'locations',
    })
  ).toMatchObject({
    tab: 'master-data',
    masterDataTab: 'locations',
  });

  expect(
    normalizeWasteManagementSearchParams({
      tab: 'master-data',
      masterDataTab: 'bogus',
    })
  ).toMatchObject({
    tab: 'master-data',
    masterDataTab: 'fractions',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run plugin-waste-management:test:unit -- --runInBand tests/search-params.test.ts`
Expected: FAIL because `masterDataTab` is not part of the normalized output yet.

- [ ] **Step 3: Write minimal implementation**

```ts
const wasteManagementMasterDataTabs = ['fractions', 'locations'] as const;

export type WasteManagementMasterDataTabId = (typeof wasteManagementMasterDataTabs)[number];

const normalizeMasterDataTab = (value: unknown): WasteManagementMasterDataTabId =>
  typeof value === 'string' && wasteManagementMasterDataTabs.includes(value as WasteManagementMasterDataTabId)
    ? (value as WasteManagementMasterDataTabId)
    : 'fractions';

// inside WasteManagementSearchParams
masterDataTab: WasteManagementMasterDataTabId;

// inside normalizeWasteManagementSearchParams
masterDataTab: normalizeMasterDataTab(search.masterDataTab),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run plugin-waste-management:test:unit -- --runInBand tests/search-params.test.ts`
Expected: PASS

### Task 2: Master-Data-Panel auf sekundäre Tabs umstellen

**Files:**
- Create: `packages/plugin-waste-management/tests/waste-management.master-data-panel.test.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-panel.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('switches between fractions and locations via the URL-synced masterDataTab', () => {
  render(<WasteMasterDataPanel search={{ ...baseSearch, tab: 'master-data', masterDataTab: 'locations' }} />);

  expect(screen.getByRole('tab', { name: 'masterData.tabs.locations' })).toHaveAttribute('data-state', 'active');
  expect(screen.getByText('masterData.locationsWorkspace.title')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run plugin-waste-management:test:unit -- --runInBand tests/waste-management.master-data-panel.test.tsx`
Expected: FAIL because there are no secondary tabs and no locations workspace title.

- [ ] **Step 3: Write minimal implementation**

```tsx
<Tabs value={search.masterDataTab} onValueChange={...navigate with masterDataTab...}>
  <TabsList aria-label={pt('masterData.tabs.ariaLabel')}>
    <TabsTrigger value="fractions">{pt('masterData.tabs.fractions')}</TabsTrigger>
    <TabsTrigger value="locations">{pt('masterData.tabs.locations')}</TabsTrigger>
  </TabsList>
  <TabsContent value="fractions">...</TabsContent>
  <TabsContent value="locations">...</TabsContent>
</Tabs>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run plugin-waste-management:test:unit -- --runInBand tests/waste-management.master-data-panel.test.tsx`
Expected: PASS

### Task 3: Fractions- und Locations-Inhalte trennen

**Files:**
- Create: `packages/plugin-waste-management/src/waste-management.master-data-fractions-content.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-summary-content.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-panel.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('shows fraction actions only in the fractions subtab', () => {
  render(<WasteMasterDataPanel search={{ ...baseSearch, masterDataTab: 'fractions' }} />);
  expect(screen.getByRole('button', { name: 'masterData.fractions.actions.openCreate' })).toBeTruthy();
  expect(screen.queryByText('masterData.locationsWorkspace.title')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run plugin-waste-management:test:unit -- --runInBand tests/waste-management.master-data-panel.test.tsx`
Expected: FAIL because fractions and locations are still mixed together.

- [ ] **Step 3: Write minimal implementation**

```tsx
<TabsContent value="fractions">
  <WasteMasterDataFractionsContent ... />
</TabsContent>
<TabsContent value="locations">
  <WasteMasterDataLocationsWorkspace ... />
</TabsContent>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run plugin-waste-management:test:unit -- --runInBand tests/waste-management.master-data-panel.test.tsx`
Expected: PASS

### Task 4: Newcms-nahe `Locations`-Arbeitsfläche einführen

**Files:**
- Create: `packages/plugin-waste-management/src/waste-management.master-data-locations-workspace.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-locations-content.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data.presentation.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data.derived.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.master-data-panel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('renders the create menu, tour filter, bulk action and dense location table in the locations subtab', () => {
  render(<WasteMasterDataPanel search={{ ...baseSearch, masterDataTab: 'locations', tourId: 'tour-1' }} />);

  expect(screen.getByRole('button', { name: 'masterData.locationsWorkspace.actions.createRegion' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'masterData.collectionLocations.bulk.actions.openAssign' })).toBeTruthy();
  expect(screen.getByText('masterData.locationsWorkspace.filters.tour')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run plugin-waste-management:test:unit -- --runInBand tests/waste-management.master-data-panel.test.tsx`
Expected: FAIL because the locations subtab still uses the old card layout and has no create menu or tour filter.

- [ ] **Step 3: Write minimal implementation**

```tsx
<StudioActionMenu
  items={[
    { id: 'create-region', label: pt('masterData.locationsWorkspace.actions.createRegion'), onSelect: onOpenCreateRegion },
    { id: 'create-city', label: pt('masterData.locationsWorkspace.actions.createCity'), onSelect: onOpenCreateCity },
    { id: 'create-street', label: pt('masterData.locationsWorkspace.actions.createStreet'), onSelect: onOpenCreateStreet },
    { id: 'create-location', label: pt('masterData.locationsWorkspace.actions.createLocation'), onSelect: onOpenCreateLocation },
  ]}
/>
<StudioDataTable ... />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run plugin-waste-management:test:unit -- --runInBand tests/waste-management.master-data-panel.test.tsx`
Expected: PASS

### Task 5: Übersetzungen und Regressionstests vervollständigen

**Files:**
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.masterData.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.masterData.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.page-shell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
expect(
  normalizeWasteManagementSearchParams({
    tab: 'master-data',
    masterDataTab: 'locations',
  }).masterDataTab
).toBe('locations');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run plugin-waste-management:test:unit -- --runInBand tests/search-params.test.ts tests/waste-management.page-shell.test.tsx`
Expected: FAIL until the test fixtures and translations align with the new search param.

- [ ] **Step 3: Write minimal implementation**

```ts
"tabs": {
  "ariaLabel": "Stammdatenbereiche",
  "fractions": "Fraktionen",
  "locations": "Abholorte"
}
```

- [ ] **Step 4: Run focused verification**

Run: `pnpm nx run plugin-waste-management:test:unit -- --runInBand tests/search-params.test.ts tests/waste-management.page-shell.test.tsx tests/waste-management.master-data-panel.test.tsx`
Expected: PASS

### Task 6: Paketweit verifizieren

**Files:**
- Test: `packages/plugin-waste-management/tests/**/*`

- [ ] **Step 1: Run the affected unit suite**

Run: `pnpm nx run plugin-waste-management:test:unit`
Expected: PASS

- [ ] **Step 2: Run the package type tests**

Run: `pnpm nx run plugin-waste-management:test:types`
Expected: PASS
