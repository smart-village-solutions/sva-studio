# Public Waste Calendar Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone public web app for the waste calendar that reads the existing waste Supabase data server-side, resolves locations step-by-step, renders list/month/year views, and exposes stable PDF/iCal actions without requiring Studio login.

**Architecture:** Add a new app at `apps/public-waste-calendar-web` for the full public UI and HTTP surface. Keep the location-resolution, calendar-projection, repository access, config loading, cookie persistence, server functions, and UI implementation app-local so the public calendar does not introduce new shared Studio-runtime coupling.

**Tech Stack:** Nx, pnpm workspace, TypeScript strict mode, React 19, Vite, Vitest, Playwright, `pg`, `cookie-es`.

---

## File Map

### New app

- Create: `apps/public-waste-calendar-web/package.json`
- Create: `apps/public-waste-calendar-web/project.json`
- Create: `apps/public-waste-calendar-web/tsconfig.json`
- Create: `apps/public-waste-calendar-web/vite.config.ts`
- Create: `apps/public-waste-calendar-web/playwright.config.ts`
- Create: `apps/public-waste-calendar-web/public-waste-config.example.json`
- Create: `apps/public-waste-calendar-web/src/main.tsx`
- Create: `apps/public-waste-calendar-web/src/router.tsx`
- Create: `apps/public-waste-calendar-web/src/server.ts`
- Create: `apps/public-waste-calendar-web/src/styles.css`
- Create: `apps/public-waste-calendar-web/src/routes/__root.tsx`
- Create: `apps/public-waste-calendar-web/src/routes/index.tsx`
- Create: `apps/public-waste-calendar-web/src/components/public-waste-app.tsx`
- Create: `apps/public-waste-calendar-web/src/components/public-waste-selection-form.tsx`
- Create: `apps/public-waste-calendar-web/src/components/public-waste-calendar-panels.tsx`
- Create: `apps/public-waste-calendar-web/src/components/public-waste-event-dialog.tsx`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-config.server.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-config.server.test.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-contract.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-contract.test.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-resolver.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-resolver.test.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-projection.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-projection.test.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.test.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-api.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-api.test.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-preferences.server.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-preferences.server.test.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-ical.server.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-ical.server.test.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-view-model.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-view-model.test.ts`
- Create: `apps/public-waste-calendar-web/tests/public-waste-calendar.e2e.ts`

### App-local domain and server logic

- Create: `apps/public-waste-calendar-web/src/lib/public-waste-contract.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-contract.test.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-resolver.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-resolver.test.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-projection.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-projection.test.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.test.ts`

### Documentation

- Modify: `openspec/changes/add-public-waste-calendar-web-app/tasks.md`
- Modify: `docs/architecture/03-context-and-scope.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`
- Modify: `docs/architecture/07-deployment-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/architecture/10-quality-requirements.md`
- Modify: `docs/architecture/11-risks-and-technical-debt.md`

### Main verification targets

- `pnpm nx run public-waste-calendar-web:test:unit --testFiles=src/lib/public-waste-config.server.test.ts --testFiles=src/lib/public-waste-contract.test.ts --testFiles=src/lib/public-waste-resolver.test.ts --testFiles=src/lib/public-waste-projection.test.ts --testFiles=src/lib/public-waste-repository.server.test.ts --testFiles=src/lib/public-waste-api.test.ts --testFiles=src/lib/public-waste-preferences.server.test.ts --testFiles=src/lib/public-waste-ical.server.test.ts --testFiles=src/lib/public-waste-view-model.test.ts`
- `pnpm nx run public-waste-calendar-web:test:e2e`
- `pnpm nx run public-waste-calendar-web:test:types`

### Task 1: Scaffold the standalone public app and its runtime config

**Files:**

- Create: `apps/public-waste-calendar-web/package.json`
- Create: `apps/public-waste-calendar-web/project.json`
- Create: `apps/public-waste-calendar-web/tsconfig.json`
- Create: `apps/public-waste-calendar-web/vite.config.ts`
- Create: `apps/public-waste-calendar-web/playwright.config.ts`
- Create: `apps/public-waste-calendar-web/public-waste-config.example.json`
- Create: `apps/public-waste-calendar-web/src/main.tsx`
- Create: `apps/public-waste-calendar-web/src/router.tsx`
- Create: `apps/public-waste-calendar-web/src/server.ts`
- Create: `apps/public-waste-calendar-web/src/routes/__root.tsx`
- Create: `apps/public-waste-calendar-web/src/routes/index.tsx`
- Create: `apps/public-waste-calendar-web/src/styles.css`

- [x] **Step 1: Write a failing config contract test**

```ts
import { describe, expect, it } from 'vitest';

import { parsePublicWasteConfig } from './public-waste-config.server.js';

describe('public waste config', () => {
  it('rejects incomplete server-only config deterministically', () => {
    expect(() =>
      parsePublicWasteConfig({
        instanceId: '',
        supabase: { databaseUrl: '', schemaName: 'waste' },
      })
    ).toThrow('public_waste_config_invalid');
  });
});
```

- [x] **Step 2: Run the app unit test target and verify the new test fails**

Run: `pnpm nx run public-waste-calendar-web:test:unit --testFiles=src/lib/public-waste-config.server.test.ts`

Expected: FAIL with a missing file or missing export for `parsePublicWasteConfig`.

- [x] **Step 3: Scaffold the app with TanStack Start and Nx targets**

```json
{
  "name": "public-waste-calendar-web",
  "private": true,
  "type": "module",
  "dependencies": {
    "@sva/core": "workspace:*",
    "@sva/data-repositories": "workspace:*",
    "@tanstack/react-router": "^1.168.24",
    "@tanstack/react-start": "^1.167.49",
    "cookie-es": "^2.0.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
```

```ts
export type PublicWasteConfig = {
  readonly instanceId: string;
  readonly supabase: {
    readonly databaseUrl: string;
    readonly schemaName: string;
  };
  readonly preferences: {
    readonly cookieName: string;
    readonly maxAgeSeconds: number;
    readonly sameSite: 'lax' | 'none';
    readonly secure: boolean;
  };
  readonly pdf: {
    readonly urlTemplate: string;
  };
};
```

- [x] **Step 4: Make the config test pass with a server-only parser and example JSON**

Run: `pnpm nx run public-waste-calendar-web:test:unit --testFiles=src/lib/public-waste-config.server.test.ts`

Expected: PASS

- [x] **Step 5: Verify the app builds its type surface and dev entry**

Run: `pnpm nx run public-waste-calendar-web:test:types`

Expected: PASS

- [x] **Step 6: Commit the scaffold**

```bash
git add apps/public-waste-calendar-web
git commit -m "feat: scaffold public waste calendar web app"
```

### Task 2: Add app-local location resolution and calendar projection

**Files:**

- Create: `apps/public-waste-calendar-web/src/lib/public-waste-contract.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-contract.test.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-resolver.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-resolver.test.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-projection.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-projection.test.ts`

- [x] **Step 1: Write failing app-local tests for staged location resolution**

```ts
it('skips the region step when only one region is available', () => {
  const result = resolvePublicWasteSelection({
    availableRegions: [{ id: 'r-1', label: 'Musterregion' }],
    selected: {},
  });

  expect(result.nextStep).toBe('city');
});

it('stops after city when only the catch-all street remains', () => {
  const result = resolvePublicWasteSelection({
    availableRegions: [{ id: 'r-1', label: 'Musterregion' }],
    availableCities: [{ id: 'c-1', label: 'Musterstadt', regionId: 'r-1' }],
    availableStreets: [{ id: 'all', label: 'Alle Straßen', cityId: 'c-1', isCatchAll: true }],
    selected: { regionId: 'r-1', cityId: 'c-1' },
  });

  expect(result.status).toBe('complete');
});
```

- [x] **Step 2: Run the focused app tests and verify failure**

Run: `pnpm nx run public-waste-calendar-web:test:unit --testFiles=src/lib/public-waste-contract.test.ts --testFiles=src/lib/public-waste-resolver.test.ts --testFiles=src/lib/public-waste-projection.test.ts`

Expected: FAIL with unresolved imports for the new public waste files.

- [x] **Step 3: Implement strict contracts and pure resolver/projection functions**

```ts
export type PublicWasteSelectionStep = 'region' | 'city' | 'street' | 'houseNumber' | 'complete';

export type PublicWasteSelectionState = {
  readonly regionId?: string;
  readonly cityId?: string;
  readonly streetId?: string;
  readonly houseNumberId?: string;
};

export const buildPublicWasteLocationKey = (state: Required<PublicWasteSelectionState>): string =>
  [state.regionId, state.cityId, state.streetId, state.houseNumberId].join(':');
```

```ts
export const projectPublicWasteCalendar = (input: PublicWasteCalendarProjectionInput): PublicWasteCalendarViewModel => ({
  nextPickupDate: input.upcomingEntries[0]?.date ?? null,
  listEntries: input.upcomingEntries,
  monthBuckets: buildMonthBuckets(input.upcomingEntries, input.referenceDate),
  yearBuckets: buildYearBuckets(input.upcomingEntries, input.referenceDate),
  fractionOptions: deriveFractionOptions(input.upcomingEntries),
});
```

- [x] **Step 4: Re-run the focused app tests**

Run: `pnpm nx run public-waste-calendar-web:test:unit --testFiles=src/lib/public-waste-contract.test.ts --testFiles=src/lib/public-waste-resolver.test.ts --testFiles=src/lib/public-waste-projection.test.ts`

Expected: PASS

- [x] **Step 5: Verify app-local types**

Run: `pnpm nx run public-waste-calendar-web:test:types`

Expected: PASS

- [x] **Step 6: Commit the app-local domain layer**

```bash
git add apps/public-waste-calendar-web/src/lib
git commit -m "feat: add public waste calendar domain logic"
```

### Task 3: Implement the app-local server-side read repository and public read surface

**Files:**

- Create: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.test.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-api.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-api.test.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-ical.server.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-ical.server.test.ts`
- Modify: `apps/public-waste-calendar-web/src/server.ts`

- [x] **Step 1: Write a failing repository test against the expected query surface**

```ts
it('lists only the next valid step options for a partially selected location', async () => {
  const repository = createPublicWasteCalendarRepository(createSqlExecutorStub());

  await expect(
    repository.listSelectionOptions({
      instanceId: 'de-musterhausen',
      selection: { regionId: 'r-1', cityId: 'c-1' },
    })
  ).resolves.toMatchObject({
    step: 'street',
  });
});
```

- [x] **Step 2: Run the app repository test target and verify failure**

Run: `pnpm nx run public-waste-calendar-web:test:unit --testFiles=src/lib/public-waste-repository.server.test.ts`

Expected: FAIL with missing repository implementation.

- [x] **Step 3: Implement a server-only repository that reads from the existing `waste_*` tables**

```ts
export const createPublicWasteCalendarRepository = (sql: SqlExecutor) => ({
  async listSelectionOptions(input: PublicWasteSelectionQuery) {
    return listNextSelectionOptions(sql, input);
  },
  async loadResolvedCalendar(input: PublicWasteResolvedLocationQuery) {
    return loadResolvedCalendarEntries(sql, input);
  },
  async resolveStoredLocationKey(input: PublicWasteStoredLocationQuery) {
    return loadStoredLocationResolution(sql, input);
  },
});
```

```ts
export const listPublicWasteSelectionServerFn = createServerFn().handler(async ({ data }) => {
  const config = await loadPublicWasteConfig();
  const repository = await createPublicWasteRepositoryFromConfig(config);
  return loadNextPublicWasteSelection({ repository, config, request: getWebRequest(), input: data });
});
```

- [x] **Step 4: Add a dedicated iCal responder for calendar clients**

```ts
export const renderPublicWasteIcal = (calendar: PublicWasteCalendarIcalModel): string =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    ...calendar.events.flatMap((event) => [
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTART;VALUE=DATE:${event.startDate}`,
      `SUMMARY:${event.summary}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ].join('\r\n');
```

- [x] **Step 5: Run repository and app server tests**

Run: `pnpm nx run public-waste-calendar-web:test:unit --testFiles=src/lib/public-waste-repository.server.test.ts --testFiles=src/lib/public-waste-api.test.ts --testFiles=src/lib/public-waste-ical.server.test.ts`

Expected: PASS

- [x] **Step 6: Verify app types after server additions**

Run: `pnpm nx run public-waste-calendar-web:test:types`

Expected: PASS

- [x] **Step 7: Commit the server-side read layer**

```bash
git add apps/public-waste-calendar-web/src/lib apps/public-waste-calendar-web/src/server.ts
git commit -m "feat: add public waste calendar read services"
```

### Task 4: Build the public UI, cookie-backed preference flow, and export actions

**Files:**

- Create: `apps/public-waste-calendar-web/src/components/public-waste-app.tsx`
- Create: `apps/public-waste-calendar-web/src/components/public-waste-selection-form.tsx`
- Create: `apps/public-waste-calendar-web/src/components/public-waste-calendar-panels.tsx`
- Create: `apps/public-waste-calendar-web/src/components/public-waste-event-dialog.tsx`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-preferences.server.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-preferences.server.test.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-view-model.ts`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-view-model.test.ts`
- Modify: `apps/public-waste-calendar-web/src/routes/index.tsx`
- Modify: `apps/public-waste-calendar-web/src/routes/__root.tsx`
- Modify: `apps/public-waste-calendar-web/src/styles.css`

- [x] **Step 1: Write failing tests for cookie restore and filter behavior**

```ts
it('restores one valid stored location and exposes a dismissible info message', async () => {
  const response = await loadInitialPublicWastePage({
    request: new Request('https://example.invalid', {
      headers: { cookie: 'sva_public_waste_location=r-1:c-1:s-1:h-1' },
    }),
  });

  expect(response.restoredLocation.notice).toContain('Adresse');
});

it('filters visible fractions without clearing the resolved location', () => {
  const result = filterPublicWasteCalendarFractions(calendarModel, ['bio']);
  expect(result.locationKey).toBe(calendarModel.locationKey);
});
```

- [x] **Step 2: Run the focused app unit tests and verify failure**

Run: `pnpm nx run public-waste-calendar-web:test:unit --testFiles=src/lib/public-waste-preferences.server.test.ts --testFiles=src/lib/public-waste-view-model.test.ts`

Expected: FAIL with missing preference or view-model implementation.

- [x] **Step 3: Implement cookie persistence and stable UI state**

```ts
export const PUBLIC_WASTE_PREFERENCE_COOKIE = 'sva_public_waste_location';

export const writePublicWastePreferenceCookie = (input: PublicWastePreferenceCookieInput): string =>
  serializeCookie(PUBLIC_WASTE_PREFERENCE_COOKIE, input.locationKey, {
    path: '/',
    maxAge: input.maxAgeSeconds,
    sameSite: input.sameSite,
    secure: input.secure,
    httpOnly: true,
  });
```

```tsx
export function PublicWasteApp() {
  const [selectedFractions, setSelectedFractions] = React.useState<readonly string[]>([]);
  const deferredFractions = React.useDeferredValue(selectedFractions);
  const filteredModel = projectVisibleFractions(calendarModel, deferredFractions);

  return (
    <>
      <PublicWasteSelectionForm />
      <PublicWasteCalendarPanels model={filteredModel} />
    </>
  );
}
```

- [x] **Step 4: Add global PDF and iCal actions derived from the resolved location**

```ts
export const buildPublicWastePdfLinks = (input: { readonly urlTemplate: string; readonly locationKey: string; readonly year: number }) => [
  interpolatePdfTemplate(input.urlTemplate, input.locationKey, input.year - 1),
  interpolatePdfTemplate(input.urlTemplate, input.locationKey, input.year),
  interpolatePdfTemplate(input.urlTemplate, input.locationKey, input.year + 1),
];
```

- [x] **Step 5: Re-run app unit tests**

Run: `pnpm nx run public-waste-calendar-web:test:unit --testFiles=src/lib/public-waste-preferences.server.test.ts --testFiles=src/lib/public-waste-view-model.test.ts --testFiles=src/lib/public-waste-api.test.ts`

Expected: PASS

- [x] **Step 6: Commit the public UX**

```bash
git add apps/public-waste-calendar-web/src
git commit -m "feat: add public waste calendar user flow"
```

### Task 5: Add end-to-end coverage, accessibility checks, and required documentation updates

**Files:**

- Create: `apps/public-waste-calendar-web/tests/public-waste-calendar.e2e.ts`
- Modify: `apps/public-waste-calendar-web/playwright.config.ts`
- Modify: `openspec/changes/add-public-waste-calendar-web-app/tasks.md`
- Modify: `docs/architecture/03-context-and-scope.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`
- Modify: `docs/architecture/07-deployment-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/architecture/10-quality-requirements.md`
- Modify: `docs/architecture/11-risks-and-technical-debt.md`

- [x] **Step 1: Write a failing end-to-end test for the complete public flow**

```ts
test('resolves a location, restores it from cookie, and exposes the iCal action', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Ort').selectOption({ label: 'Musterstadt' });
  await page.getByLabel('Straße').selectOption({ label: 'Hauptstraße' });
  await page.getByLabel('Hausnummer').selectOption({ label: '12' });
  await expect(page.getByRole('button', { name: 'iCal abonnieren' })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Gespeicherte Adresse geladen')).toBeVisible();
});
```

- [x] **Step 2: Run the E2E target and verify failure**

Run: `pnpm nx run public-waste-calendar-web:test:e2e`

Expected: FAIL because the full public flow is not wired yet.

- [x] **Step 3: Implement the missing runtime hooks and accessibility affordances**

```tsx
<dialog aria-labelledby="pickup-detail-title" aria-modal="true">
  <h2 id="pickup-detail-title">{selectedEntry.fractionLabel}</h2>
  <p>{selectedEntry.note ?? 'Kein zusätzlicher Hinweis vorhanden.'}</p>
</dialog>
```

- [x] **Step 4: Update OpenSpec task statuses and arc42 documentation**

Run: `pnpm nx run public-waste-calendar-web:test:unit && pnpm nx run public-waste-calendar-web:test:e2e`

Expected: PASS before setting the corresponding OpenSpec checkboxes to `- [x]`.

- [x] **Step 5: Run the final local gate for touched projects**

Run: `pnpm nx run public-waste-calendar-web:test:unit && pnpm nx run public-waste-calendar-web:test:e2e && pnpm nx run public-waste-calendar-web:test:types`

Expected: PASS

- [x] **Step 6: Commit tests and docs**

```bash
git add apps/public-waste-calendar-web/tests openspec/changes/add-public-waste-calendar-web-app/tasks.md docs/architecture
git commit -m "test: cover and document public waste calendar"
```

## Self-Review

- Spec coverage: app separation, server-only config, staged location resolution, delayed calendar loading, one-cookie preference, list/month/year views, fraction filters, PDF/iCal actions, and WCAG-oriented embedded UX are each mapped to Tasks 1-5.
- Placeholder scan: no `TODO`, `TBD`, or “implement later” markers remain.
- Type consistency: the plan uses one naming family throughout: `PublicWasteConfig`, `resolvePublicWasteSelection`, `projectPublicWasteCalendar`, `createPublicWasteCalendarRepository`, `renderPublicWasteIcal`, and `PUBLIC_WASTE_PREFERENCE_COOKIE`.
