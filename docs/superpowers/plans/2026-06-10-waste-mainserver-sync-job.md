# Waste Mainserver Sync Job Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single `Synchronisieren` header action to Waste Management that starts a background job which aligns Mainserver waste pickup times with the Studio-derived scheduling state.

**Architecture:** Keep the browser plugin thin. The plugin starts a new Waste plugin-operation job through the existing host facade, `apps/sva-studio-react` executes the job runtime, and `packages/sva-mainserver` owns all typed Waste GraphQL reads and writes. Before the matching rules are frozen, add a controlled verification step and persist the findings in a report under `docs/reports/`.

**Tech Stack:** TypeScript, React, Nx, Vitest, plugin operations platform, `@sva/core`, `@sva/auth-runtime`, `@sva/plugin-waste-management`, `@sva/sva-mainserver`

---

## File Structure

### New files

- `docs/reports/waste-mainserver-sync-api-verification-2026-06-10.md`
  - Captures the real query/mutation findings from the safe `de-musterhausen` systems.
- `packages/sva-mainserver/src/server/service-internals/waste-operations.ts`
  - Server-only typed Waste Mainserver query/mutation documents, response mapping, and batching helpers.
- `packages/sva-mainserver/src/server/service-internals/waste-operations.test.ts`
  - Unit tests for Waste GraphQL document execution, payload mapping, and error handling.
- `apps/sva-studio-react/src/lib/waste-management-mainserver-sync.server.ts`
  - App-side orchestration helper that derives Studio target rows, reads Mainserver rows, computes the diff, and runs `create`/`delete`.
- `apps/sva-studio-react/src/lib/waste-management-mainserver-sync.server.test.ts`
  - Unit tests for the sync diff and orchestration helper.

### Modified files

- `packages/core/src/waste-management-operations-contract.ts`
  - Add the new Waste job type and shared job input for Mainserver sync.
- `packages/core/src/waste-management-operations-contract.test.ts`
  - Lock the shared contract for the new job type.
- `packages/plugin-waste-management/src/plugin-operations.ts`
  - Declare the new plugin job type and result/progress metadata.
- `packages/plugin-waste-management/tests/plugin-operations.test.ts`
  - Assert the new job type remains declared inside the Waste plugin package.
- `packages/plugin-waste-management/src/waste-management.api.types.operations-inputs.ts`
  - Add the browser-side start payload type for the sync job.
- `packages/plugin-waste-management/src/waste-management.api.operations.ts`
  - Add the browser API helper that starts the sync job.
- `packages/plugin-waste-management/src/waste-management.ui-access.ts`
  - Add a dedicated UI capability for the sync button.
- `packages/plugin-waste-management/tests/waste-management.ui-access.test.ts`
  - Assert the sync capability follows the chosen permission model.
- `packages/plugin-waste-management/src/waste-management.page.tsx`
  - Render the header button and start the job.
- `packages/plugin-waste-management/tests/waste-management.page-shell.test.tsx`
  - Assert the button state and the job-start flow.
- `packages/plugin-waste-management/src/plugin.translations.de.tools.ts`
  - Add German text for the sync button and messages.
- `packages/plugin-waste-management/src/plugin.translations.en.tools.ts`
  - Add English text for the sync button and messages.
- `packages/plugin-waste-management/src/server.ts`
  - Register the new plugin job execution handler.
- `packages/auth-runtime/src/waste-management/core/schemas.ts`
  - Add the new request schema for starting the sync job.
- `packages/auth-runtime/src/waste-management/core/operations.ts`
  - Add the new `startWasteManagementMainserverSyncInternal` handler using the shared tool-job helper.
- `packages/auth-runtime/src/waste-management/core/operations.test.ts`
  - Test authorization, payload parsing, idempotency, and job-start payload mapping.
- `packages/auth-runtime/src/waste-management/core.ts`
  - Export the new sync start handler.
- `packages/auth-runtime/src/waste-management/server.ts`
  - Wire the new route handler into the Waste host facade.
- `packages/auth-runtime/src/waste-management/server.test.ts`
  - Assert the new HTTP path dispatches to the correct internal handler.
- `packages/sva-mainserver/src/server/service.ts`
  - Export typed Waste adapter entry points used by the sync runtime.
- `packages/sva-mainserver/src/index.server.ts`
  - Re-export the new Waste adapter functions.
- `apps/sva-studio-react/src/lib/waste-management-operations.types.ts`
  - Extend the runtime contract with `syncMainserver`.
- `apps/sva-studio-react/src/lib/waste-management-operations.server.ts`
  - Delegate the new runtime method to the sync helper.
- `apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts`
  - Assert the runtime delegates correctly.
- `apps/sva-studio-react/src/lib/plugin-operation-runtime.server.ts`
  - Register the new runtime factory handler.
- `apps/sva-studio-react/src/lib/plugin-operation-runtime.server.test.ts`
  - Lock coverage for the new declared job type.

### Existing files to consult while implementing

- `packages/plugin-waste-management/src/waste-management.tools.actions.ts`
  - Existing pattern for starting Waste plugin-operation jobs and surfacing status messages.
- `packages/plugin-waste-management/src/waste-management.page.tsx`
  - Existing `StudioOverviewPageTemplate` usage; the sync button belongs in `primaryAction`.
- `packages/plugin-waste-management/src/waste-management.ui-access.ts`
  - Current permission-to-UI-capability mapping.
- `packages/auth-runtime/src/waste-management/core/operations.ts`
  - Existing `startToolJob()` helper used by other Waste background jobs.
- `packages/sva-mainserver/src/server/service.ts`
  - Existing typed Mainserver service export surface for News/Events/POI.
- `packages/sva-mainserver/src/server/news-route.ts`
  - Existing content-authorized Mainserver write flow and idempotency patterns.
- `apps/sva-studio-react/src/lib/plugin-operation-runtime.server.ts`
  - Existing plugin-operation runtime discovery and coverage guard.
- `packages/core/src/waste-management-location-tour-pickup-date-planner.ts`
  - Useful normalization patterns for Waste location/tour matching keys.

---

### Task 1: Extend the shared Waste job contract and browser/plugin declarations

**Files:**
- Modify: `packages/core/src/waste-management-operations-contract.ts`
- Modify: `packages/core/src/waste-management-operations-contract.test.ts`
- Modify: `packages/plugin-waste-management/src/plugin-operations.ts`
- Modify: `packages/plugin-waste-management/tests/plugin-operations.test.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.types.operations-inputs.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.ui-access.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.ui-access.test.ts`

- [ ] **Step 1: Write the failing shared-contract and plugin-declaration tests**

```ts
// packages/core/src/waste-management-operations-contract.test.ts
expect(wasteManagementOperationsContract.jobTypeIds).toEqual({
  initializeDataSource: 'waste-management.initialize-data-source',
  applyMigrations: 'waste-management.apply-migrations',
  importData: 'waste-management.import-data',
  seedData: 'waste-management.seed-data',
  resetData: 'waste-management.reset-data',
  syncMainserver: 'waste-management.sync-mainserver',
});
expect(wasteManagementOperationsContract.isJobTypeId('waste-management.sync-mainserver')).toBe(true);
```

```ts
// packages/plugin-waste-management/tests/plugin-operations.test.ts
expect(createWasteManagementPluginJobTypes()).toEqual([
  expect.objectContaining({ jobTypeId: 'waste-management.initialize-data-source' }),
  expect.objectContaining({ jobTypeId: 'waste-management.apply-migrations' }),
  expect.objectContaining({ jobTypeId: 'waste-management.import-data' }),
  expect.objectContaining({ jobTypeId: 'waste-management.seed-data' }),
  expect.objectContaining({ jobTypeId: 'waste-management.reset-data' }),
  expect.objectContaining({ jobTypeId: 'waste-management.sync-mainserver' }),
]);
```

```ts
// packages/plugin-waste-management/tests/waste-management.ui-access.test.ts
const access = deriveWasteManagementUiAccess([
  'waste-management.read',
  'waste-management.scheduling.manage',
]);

expect(access.canRunMainserverSync).toBe(true);
expect(access.visibleTabIds).toEqual(['fractions', 'tours', 'locations', 'scheduling']);
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run:

```bash
pnpm nx run core:test:unit --testFiles=src/waste-management-operations-contract.test.ts
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/plugin-operations.test.ts --testFiles=tests/waste-management.ui-access.test.ts
```

Expected:
- FAIL because `syncMainserver` and `canRunMainserverSync` are not defined yet

- [ ] **Step 3: Add the new shared job id, job input, plugin declaration, and UI capability**

```ts
// packages/core/src/waste-management-operations-contract.ts
const wasteManagementJobTypeIds = {
  initializeDataSource: 'waste-management.initialize-data-source',
  applyMigrations: 'waste-management.apply-migrations',
  importData: 'waste-management.import-data',
  seedData: 'waste-management.seed-data',
  resetData: 'waste-management.reset-data',
  syncMainserver: 'waste-management.sync-mainserver',
} as const;

export type WasteManagementSyncMainserverJobInput = {
  readonly operation: 'sync-mainserver';
};

export type WasteManagementJobInput =
  | WasteManagementInitializeJobInput
  | WasteManagementApplyMigrationsJobInput
  | WasteManagementImportJobInput
  | WasteManagementSeedJobInput
  | WasteManagementResetJobInput
  | WasteManagementSyncMainserverJobInput;
```

```ts
// packages/plugin-waste-management/src/plugin-operations.ts
{
  jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncMainserver,
  queue: wasteManagementOperationsContract.queueName,
  displayName: 'Waste-Mainserver synchronisieren',
  progress: {
    phaseKeys: ['waste-management.mainserver-sync', 'waste-management.completed'],
    stepKeys: ['load-studio-state', 'sync-mainserver', 'complete-operation'],
  },
  result: {
    summaryKeys: ['durationMs'],
    detailKeys: ['studioItemCount', 'mainserverItemCount', 'createCount', 'deleteCount', 'errorCount'],
  },
  errors: {
    detailKeys: ['failed-step', 'failed-item-key'],
  },
}
```

```ts
// packages/plugin-waste-management/src/waste-management.api.types.operations-inputs.ts
export type StartWasteManagementMainserverSyncInput = Readonly<Record<string, never>>;
```

```ts
// packages/plugin-waste-management/src/waste-management.ui-access.ts
export type WasteManagementUiAccess = Readonly<{
  visibleTabIds: readonly WasteManagementTabId[];
  canAccessSettings: boolean;
  canAccessTools: boolean;
  canDuplicateTour: boolean;
  canRunInitialize: boolean;
  canRunMigrations: boolean;
  canRunImport: boolean;
  canRunSeed: boolean;
  canRunReset: boolean;
  canRunMainserverSync: boolean;
  canDeleteHistoryEntries: boolean;
}>;

const canManageScheduling = grantedPermissions.has('waste-management.scheduling.manage');

return {
  visibleTabIds,
  canAccessSettings,
  canAccessTools,
  canDuplicateTour: canManageTours && canManageScheduling,
  canRunInitialize,
  canRunMigrations,
  canRunImport,
  canRunSeed,
  canRunReset,
  canRunMainserverSync: canManageScheduling,
  canDeleteHistoryEntries: false,
};
```

- [ ] **Step 4: Re-run the focused tests**

Run:

```bash
pnpm nx run core:test:unit --testFiles=src/waste-management-operations-contract.test.ts
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/plugin-operations.test.ts --testFiles=tests/waste-management.ui-access.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the contract slice**

```bash
git add packages/core/src/waste-management-operations-contract.ts \
  packages/core/src/waste-management-operations-contract.test.ts \
  packages/plugin-waste-management/src/plugin-operations.ts \
  packages/plugin-waste-management/tests/plugin-operations.test.ts \
  packages/plugin-waste-management/src/waste-management.api.types.operations-inputs.ts \
  packages/plugin-waste-management/src/waste-management.ui-access.ts \
  packages/plugin-waste-management/tests/waste-management.ui-access.test.ts
git commit -m "feat(waste): declare mainserver sync job contract"
```

### Task 2: Add typed Waste Mainserver adapters and a verification-first orchestration helper

**Files:**
- Create: `packages/sva-mainserver/src/server/service-internals/waste-operations.ts`
- Create: `packages/sva-mainserver/src/server/service-internals/waste-operations.test.ts`
- Modify: `packages/sva-mainserver/src/server/service.ts`
- Modify: `packages/sva-mainserver/src/index.server.ts`
- Create: `apps/sva-studio-react/src/lib/waste-management-mainserver-sync.server.ts`
- Create: `apps/sva-studio-react/src/lib/waste-management-mainserver-sync.server.test.ts`

- [ ] **Step 1: Write the failing Mainserver adapter and diff tests**

```ts
// packages/sva-mainserver/src/server/service-internals/waste-operations.test.ts
it('maps waste tours, location types, and pickup times into a stable sync snapshot', async () => {
  const result = await listSvaMainserverWasteSyncSnapshot({
    instanceId: 'de-musterhausen',
    keycloakSubject: 'subject-1',
  });

  expect(result.tours).toEqual([
    expect.objectContaining({
      id: 'tour-1',
      wasteType: 'Restmüll',
    }),
  ]);
  expect(result.pickupTimes).toEqual([
    expect.objectContaining({
      pickupDate: '2026-01-10',
      wasteType: 'Restmüll',
      street: 'Hauptstraße',
    }),
  ]);
});
```

```ts
// apps/sva-studio-react/src/lib/waste-management-mainserver-sync.server.test.ts
it('computes create and delete sets from normalized Studio and Mainserver rows', async () => {
  const result = await runWasteManagementMainserverSync({
    studioRows: [
      { key: '2026-01-10::restmüll::hauptstraße::16928::musterhausen', pickupDate: '2026-01-10' },
    ],
    mainserverRows: [
      { key: '2026-01-17::restmüll::hauptstraße::16928::musterhausen', pickupDate: '2026-01-17', id: 'pickup-2' },
    ],
    dryRun: false,
  });

  expect(result.createCount).toBe(1);
  expect(result.deleteCount).toBe(1);
});
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run:

```bash
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service-internals/waste-operations.test.ts
pnpm nx run sva-studio-react:test:unit:server --testFiles=src/lib/waste-management-mainserver-sync.server.test.ts
```

Expected:
- FAIL because the new adapters and orchestration helper do not exist yet

- [ ] **Step 3: Implement typed Mainserver Waste reads/writes and the app-side diff helper**

```ts
// packages/sva-mainserver/src/server/service-internals/waste-operations.ts
export type SvaMainserverWasteSyncItem = Readonly<{
  id?: string;
  pickupDate: string;
  wasteType: string;
  street: string;
  zip?: string;
  city?: string;
  note?: string;
  district?: string;
  rhythmRrule?: string;
  rhythmStartDate?: string;
  rhythmExcludes?: readonly string[];
}>;

export const listSvaMainserverWasteSyncSnapshot = async (
  input: SvaMainserverConnectionInput
): Promise<Readonly<{
  tours: readonly { id: string; wasteType: string }[];
  pickupTimes: readonly SvaMainserverWasteSyncItem[];
}>> => {
  // query wasteTours -> wasteLocationTypes(tourId) -> wasteTourDates(tourId)
};

export const createSvaMainserverWastePickupTimes = async (
  input: SvaMainserverConnectionInput & { readonly items: readonly SvaMainserverWasteSyncItem[] }
) => {
  // call createWastePickUpTimes in batches
};

export const deleteSvaMainserverWastePickupTimes = async (
  input: SvaMainserverConnectionInput & { readonly items: readonly SvaMainserverWasteSyncItem[] }
) => {
  // prefer ids, fall back to pickupDate + wasteLocationType
};
```

```ts
// apps/sva-studio-react/src/lib/waste-management-mainserver-sync.server.ts
const buildWasteSyncKey = (item: {
  pickupDate: string;
  wasteType: string;
  street: string;
  zip?: string;
  city?: string;
}) =>
  [
    item.pickupDate,
    item.wasteType.trim().toLocaleLowerCase('de-DE'),
    item.street.trim().toLocaleLowerCase('de-DE'),
    item.zip?.trim() ?? '',
    item.city?.trim().toLocaleLowerCase('de-DE') ?? '',
  ].join('::');

export const runWasteManagementMainserverSync = async (input: {
  studioRows: readonly WasteSyncRow[];
  mainserverRows: readonly WasteSyncRow[];
  dryRun: boolean;
}) => {
  // normalize -> diff -> optionally execute create/delete -> return counts
};
```

```ts
// packages/sva-mainserver/src/server/service.ts
export const listSvaMainserverWasteSyncSnapshot = (input: SvaMainserverConnectionInput) =>
  createSvaMainserverService().listWasteSyncSnapshot(input);

export const createSvaMainserverWastePickupTimes = (
  input: SvaMainserverConnectionInput & { readonly items: readonly SvaMainserverWasteSyncItem[] }
) => createSvaMainserverService().createWastePickupTimes(input);

export const deleteSvaMainserverWastePickupTimes = (
  input: SvaMainserverConnectionInput & { readonly items: readonly SvaMainserverWasteSyncItem[] }
) => createSvaMainserverService().deleteWastePickupTimes(input);
```

- [ ] **Step 4: Re-run the focused tests**

Run:

```bash
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service-internals/waste-operations.test.ts
pnpm nx run sva-studio-react:test:unit:server --testFiles=src/lib/waste-management-mainserver-sync.server.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the adapter/orchestration slice**

```bash
git add packages/sva-mainserver/src/server/service-internals/waste-operations.ts \
  packages/sva-mainserver/src/server/service-internals/waste-operations.test.ts \
  packages/sva-mainserver/src/server/service.ts \
  packages/sva-mainserver/src/index.server.ts \
  apps/sva-studio-react/src/lib/waste-management-mainserver-sync.server.ts \
  apps/sva-studio-react/src/lib/waste-management-mainserver-sync.server.test.ts
git commit -m "feat(waste): add typed mainserver sync adapters"
```

### Task 3: Wire the sync job into the app runtime and plugin-operation registration

**Files:**
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.types.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.server.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts`
- Modify: `packages/plugin-waste-management/src/server.ts`
- Modify: `apps/sva-studio-react/src/lib/plugin-operation-runtime.server.ts`
- Modify: `apps/sva-studio-react/src/lib/plugin-operation-runtime.server.test.ts`

- [ ] **Step 1: Write the failing runtime registration tests**

```ts
// apps/sva-studio-react/src/lib/plugin-operation-runtime.server.test.ts
expect(Object.keys(handlers).sort()).toEqual([
  'waste-management.apply-migrations',
  'waste-management.import-data',
  'waste-management.initialize-data-source',
  'waste-management.reset-data',
  'waste-management.seed-data',
  'waste-management.sync-mainserver',
]);
```

```ts
// apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts
await expect(runtime.syncMainserver('de-musterhausen', { operation: 'sync-mainserver' })).resolves.toMatchObject({
  details: expect.objectContaining({
    createCount: expect.any(Number),
    deleteCount: expect.any(Number),
  }),
});
```

- [ ] **Step 2: Run the focused server tests and confirm they fail**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:server --testFiles=src/lib/plugin-operation-runtime.server.test.ts --testFiles=src/lib/waste-management-operations.server.test.ts
```

Expected:
- FAIL because the sync runtime method and handler are missing

- [ ] **Step 3: Add the runtime method and register the new handler**

```ts
// apps/sva-studio-react/src/lib/waste-management-operations.types.ts
import type { WasteManagementSyncMainserverJobInput } from '@sva/core';

export type WasteManagementOperationRuntime = {
  initializeDataSource: (
    instanceId: string,
    input: WasteManagementInitializeJobInput
  ) => Promise<OperationSummary>;
  applyMigrations: (
    instanceId: string,
    input: WasteManagementApplyMigrationsJobInput
  ) => Promise<OperationSummary>;
  importData: (
    instanceId: string,
    input: WasteManagementImportJobInput,
    progressReporter?: WasteImportProgressReporter
  ) => Promise<OperationSummary>;
  seedData: (instanceId: string, input: WasteManagementSeedJobInput) => Promise<OperationSummary>;
  resetData: (instanceId: string, input: WasteManagementResetJobInput) => Promise<OperationSummary>;
  syncMainserver: (instanceId: string, input: WasteManagementSyncMainserverJobInput) => Promise<OperationSummary>;
};
```

```ts
// apps/sva-studio-react/src/lib/waste-management-operations.server.ts
import { runWasteManagementMainserverSyncForInstance } from './waste-management-mainserver-sync.server.js';

async syncMainserver(instanceId, input) {
  const startedAt = Date.now();
  const details = await runWasteManagementMainserverSyncForInstance({ instanceId, input, deps });
  return buildOperationSummary(startedAt, {
    operation: 'sync-mainserver',
    mode: 'executed',
    studioItemCount: details.studioItemCount,
    mainserverItemCount: details.mainserverItemCount,
    createCount: details.createCount,
    deleteCount: details.deleteCount,
    errorCount: details.errorCount,
  });
},
```

```ts
// packages/plugin-waste-management/src/server.ts
{
  [wasteManagementOperationsContract.jobTypeIds.syncMainserver]: createOperationHandler({
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncMainserver,
    expectedOperation: 'sync-mainserver',
    phaseKey: 'waste-management.mainserver-sync',
    execute: (runtime, instanceId, payload) => runtime.syncMainserver(instanceId, payload),
  }),
}
```

- [ ] **Step 4: Re-run the focused server tests**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:server --testFiles=src/lib/plugin-operation-runtime.server.test.ts --testFiles=src/lib/waste-management-operations.server.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the runtime slice**

```bash
git add apps/sva-studio-react/src/lib/waste-management-operations.types.ts \
  apps/sva-studio-react/src/lib/waste-management-operations.server.ts \
  apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts \
  packages/plugin-waste-management/src/server.ts \
  apps/sva-studio-react/src/lib/plugin-operation-runtime.server.ts \
  apps/sva-studio-react/src/lib/plugin-operation-runtime.server.test.ts
git commit -m "feat(waste): wire mainserver sync runtime job"
```

### Task 4: Add the authenticated Waste host endpoint that starts the sync job

**Files:**
- Modify: `packages/auth-runtime/src/waste-management/core/schemas.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/operations.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/operations.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core.ts`
- Modify: `packages/auth-runtime/src/waste-management/server.ts`
- Modify: `packages/auth-runtime/src/waste-management/server.test.ts`

- [ ] **Step 1: Write the failing handler and route tests**

```ts
// packages/auth-runtime/src/waste-management/core/operations.test.ts
const response = await startWasteManagementMainserverSyncInternal(
  new Request('https://studio.test/api/v1/waste-management/tools/mainserver-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'idem-sync-1',
      'X-CSRF-Token': 'csrf-1',
    },
    body: JSON.stringify({}),
  }),
  ctx,
  deps,
);

expect(startPluginOperationJobMock).toHaveBeenCalledWith(
  expect.objectContaining({
    endpoint: 'POST:/api/v1/waste-management/tools/mainserver-sync',
    data: expect.objectContaining({
      jobTypeId: 'waste-management.sync-mainserver',
      input: { operation: 'sync-mainserver' },
    }),
  }),
);
```

```ts
// packages/auth-runtime/src/waste-management/server.test.ts
await expect(
  wasteManagementHandlers.startMainserverSync(
    new Request('https://studio.test/api/v1/waste-management/tools/mainserver-sync', { method: 'POST' })
  )
).resolves.toBeInstanceOf(Response);
expect(coreHandlerMocks.startWasteManagementMainserverSyncInternal).toHaveBeenCalled();
```

- [ ] **Step 2: Run the focused auth-runtime tests and confirm they fail**

Run:

```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core/operations.test.ts --testFiles=src/waste-management/server.test.ts
```

Expected:
- FAIL because the schema, internal handler, and route binding do not exist yet

- [ ] **Step 3: Implement the new start endpoint using the existing `startToolJob()` helper**

```ts
// packages/auth-runtime/src/waste-management/core/schemas.ts
const startMainserverSyncSchema = z.object({});

export const wasteManagementOperationSchemas = {
  previewLocationTourPickupDateImportSchema,
  startImportSchema,
  startInitializeSchema,
  startMigrationsSchema,
  startResetSchema,
  startSeedSchema,
  startMainserverSyncSchema,
};
```

```ts
// packages/auth-runtime/src/waste-management/core/operations.ts
startWasteManagementMainserverSyncInternal: async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
) =>
  startToolJob(request, ctx, deps, {
    requiredPermission: 'waste-management.scheduling.manage',
    endpoint: 'POST:/api/v1/waste-management/tools/mainserver-sync',
    schema: startMainserverSyncSchema,
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncMainserver,
    auditActionId: 'waste-management.mainserver-sync.started',
    toPayload: () => ({
      operation: 'sync-mainserver',
    }),
  }),
```

```ts
// packages/auth-runtime/src/waste-management/server.ts
startMainserverSync: (request: Request): Promise<Response> =>
  withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
    startWasteManagementMainserverSyncInternal(nextRequest, ctx)
  ),
```

- [ ] **Step 4: Re-run the focused auth-runtime tests**

Run:

```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core/operations.test.ts --testFiles=src/waste-management/server.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the host-endpoint slice**

```bash
git add packages/auth-runtime/src/waste-management/core/schemas.ts \
  packages/auth-runtime/src/waste-management/core/operations.ts \
  packages/auth-runtime/src/waste-management/core/operations.test.ts \
  packages/auth-runtime/src/waste-management/core.ts \
  packages/auth-runtime/src/waste-management/server.ts \
  packages/auth-runtime/src/waste-management/server.test.ts
git commit -m "feat(waste): add mainserver sync start endpoint"
```

### Task 5: Add the Waste page header button, browser API helper, and user feedback

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.api.operations.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.page.tsx`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.tools.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.tools.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.page-shell.test.tsx`

- [ ] **Step 1: Write the failing page-shell test**

```ts
// packages/plugin-waste-management/tests/waste-management.page-shell.test.tsx
const startWasteManagementMainserverSyncMock = vi.hoisted(() => vi.fn(async () => ({
  id: 'job-sync-1',
  status: 'queued',
  jobTypeId: 'waste-management.sync-mainserver',
})));

expect(screen.getByRole('button', { name: 'tools.sync.actionLabel' })).toBeTruthy();
fireEvent.click(screen.getByRole('button', { name: 'tools.sync.actionLabel' }));
await waitFor(() => {
  expect(startWasteManagementMainserverSyncMock).toHaveBeenCalledWith({});
});
```

- [ ] **Step 2: Run the focused plugin UI test and confirm it fails**

Run:

```bash
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.page-shell.test.tsx
```

Expected:
- FAIL because the sync API helper and button are missing

- [ ] **Step 3: Add the browser helper, page button, and translated user feedback**

```ts
// packages/plugin-waste-management/src/waste-management.api.operations.ts
import type { StartWasteManagementMainserverSyncInput } from './waste-management.api.types.js';

export const startWasteManagementMainserverSync = async (
  input: StartWasteManagementMainserverSyncInput = {}
) => requestWasteManagementJob('/api/v1/waste-management/tools/mainserver-sync', input);
```

```tsx
// packages/plugin-waste-management/src/waste-management.page.tsx
import { Button } from '@sva/studio-ui-react';
import { startWasteManagementMainserverSync } from './waste-management.api.js';

const [syncRunning, setSyncRunning] = useState(false);

<StudioOverviewPageTemplate
  title={pt('page.title')}
  description={
    <WasteManagementPageDescription
      description={pt('page.description')}
      calendarWebUrl={calendarWebUrl}
      webVersionLead={pt('page.webVersionLead')}
      webVersionLinkLabel={pt('page.webVersionLinkLabel')}
    />
  }
  primaryAction={
    uiAccess.canRunMainserverSync ? (
      <Button
        type="button"
        disabled={syncRunning}
        onClick={async () => {
          setSyncRunning(true);
          try {
            await startWasteManagementMainserverSync({});
          } finally {
            setSyncRunning(false);
          }
        }}
      >
        {pt('tools.sync.actionLabel')}
      </Button>
    ) : null
  }
>
```

```ts
// packages/plugin-waste-management/src/plugin.translations.de.tools.ts
sync: {
  actionLabel: 'Synchronisieren',
  startSuccess: 'Mainserver-Synchronisierung wurde gestartet.',
  startError: 'Mainserver-Synchronisierung konnte nicht gestartet werden.',
}
```

- [ ] **Step 4: Re-run the focused plugin UI test**

Run:

```bash
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.page-shell.test.tsx
```

Expected:
- PASS

- [ ] **Step 5: Commit the UI slice**

```bash
git add packages/plugin-waste-management/src/waste-management.api.operations.ts \
  packages/plugin-waste-management/src/waste-management.page.tsx \
  packages/plugin-waste-management/src/plugin.translations.de.tools.ts \
  packages/plugin-waste-management/src/plugin.translations.en.tools.ts \
  packages/plugin-waste-management/tests/waste-management.page-shell.test.tsx
git commit -m "feat(waste): add mainserver sync header action"
```

### Task 6: Run the safe-system verification, write the report, and execute the smallest relevant gates

**Files:**
- Create: `docs/reports/waste-mainserver-sync-api-verification-2026-06-10.md`

- [ ] **Step 1: Add the verification report template before running the real checks**

```md
# Waste-Mainserver-Sync API-Verifikation 2026-06-10

## Zielsysteme

- Studio: `https://de-musterhausen.studio.localhost:3000`
- Mainserver: `https://de-musterhausen.server.smart-village.app`

## Geprüfte Operationen

- `wasteTours`
- `wasteLocationTypes(tourId)`
- `wasteTourDates(tourId)`
- `wasteAddresses`
- `createWastePickUpTimes`
- `destroyWastePickUpTime`

## Findings

- `wasteTours`: Rückgabe von `id`, `title`, `wasteType` geprüft; Abweichungen zum Snapshot dokumentieren.
- `wasteLocationTypes`: Rückgabe von `id`, `addressId`, `wasteType`, `address`, `pickUpTimes` geprüft; fehlende Felder dokumentieren.
- `wasteTourDates`: Rückgabe von `id`, `pickupDate`, `note`, `wasteLocationTypeId` geprüft; reale Feldnamen und Nullability dokumentieren.
- `destroyWastePickUpTime`: dokumentieren, ob `ids` allein reicht oder ob `pickupDate + wasteLocationType` zwingend erforderlich ist.

## Finalisierte Matching-Entscheidung

- Schlüssel: den final bestätigten Primärschlüssel exakt als Feldliste eintragen.
- Delete-Pfad: den final bestätigten Mainserver-Löschpfad exakt als Regel eintragen.
```

- [ ] **Step 2: Run the real verification flow against the safe `de-musterhausen` systems**

Run:

```bash
pnpm nx run sva-studio-react:serve
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service-internals/waste-operations.test.ts
```

Expected:
- local Studio starts on `https://de-musterhausen.studio.localhost:3000`
- the focused Mainserver adapter tests stay green
- the manual/API-assisted verification produces enough evidence to fill the report

- [ ] **Step 3: Fill the verification report with the real findings and the final matching/delete choice**

```md
## Finalisierte Matching-Entscheidung

- Schlüssel: `pickupDate + wasteType + street + zip + city`
- `destroyWastePickUpTime`: zuerst `ids`, nur bei fehlender Upstream-ID Fallback auf `pickupDate + wasteLocationType`
- `district`, `rhythmRrule`, `rhythmStartDate`, `rhythmExcludes`: nicht Teil des Primärschlüssels der ersten Ausbaustufe
```

- [ ] **Step 4: Run the smallest relevant gates for the touched packages**

Run:

```bash
pnpm nx run core:test:unit --testFiles=src/waste-management-operations-contract.test.ts
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/plugin-operations.test.ts --testFiles=tests/waste-management.ui-access.test.ts --testFiles=tests/waste-management.page-shell.test.tsx
pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core/operations.test.ts --testFiles=src/waste-management/server.test.ts
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service-internals/waste-operations.test.ts
pnpm nx run sva-studio-react:test:unit:server --testFiles=src/lib/waste-management-mainserver-sync.server.test.ts --testFiles=src/lib/waste-management-operations.server.test.ts --testFiles=src/lib/plugin-operation-runtime.server.test.ts
pnpm nx run-many --target=test:types --projects=core,plugin-waste-management,auth-runtime,sva-mainserver,sva-studio-react
pnpm nx run core:check:runtime
pnpm nx run auth-runtime:check:runtime
pnpm nx run sva-mainserver:check:runtime
pnpm check:file-placement
```

Expected:
- PASS on all targeted unit tests
- PASS on type tests for all touched packages
- PASS on the three server-runtime checks
- PASS on file-placement validation

- [ ] **Step 5: Commit the verification/report slice**

```bash
git add docs/reports/waste-mainserver-sync-api-verification-2026-06-10.md
git commit -m "docs(waste): record mainserver sync api verification"
```
