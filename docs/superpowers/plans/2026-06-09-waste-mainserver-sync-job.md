# Waste Mainserver Sync Job Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nach jeder Fraktionsänderung wird das vollständige `wasteTypes`-JSON als dedizierter Waste-Job auf den Mainserver synchronisiert; bei Sync-Fehlern bleibt der lokale Save erfolgreich und im Fraktionskontext erscheint ein Retry.

**Architecture:** Die Exportlogik bleibt framework-agnostisch in `@sva/core`, die Mainserver-Schreiboperation kommt als schlanke dedizierte SVA-Mainserver-Operation hinzu, und die konkrete Job-Runtime sitzt in `apps/sva-studio-react`. Das Waste-Plugin erweitert seinen bestehenden Job-/API-/UI-Pfad um genau einen neuen Jobtyp `waste-management.sync-waste-types` und verwendet für Retry denselben technischen Startpfad.

**Tech Stack:** TypeScript strict mode, Nx, Vitest, React, TanStack Router, Zod, bestehende Plugin-Operations-Infrastruktur, bestehende SVA-Mainserver OAuth-/GraphQL-Integration

---

## File Structure

**Create:**
- `packages/core/src/waste-management-static-content.ts`
- `packages/core/src/waste-management-static-content.test.ts`
- `packages/sva-mainserver/src/generated/static-content.ts`
- `packages/sva-mainserver/src/server/service-internals/static-content-operations.ts`

**Modify:**
- `packages/core/src/waste-management-operations-contract.ts`
- `packages/core/src/waste-management-operations-contract.test.ts`
- `packages/core/src/index.ts`
- `packages/plugin-sdk/src/public-api.ts`
- `packages/plugin-sdk/src/index.ts`
- `packages/plugin-waste-management/src/plugin-operations.ts`
- `packages/plugin-waste-management/src/server.ts`
- `packages/plugin-waste-management/src/waste-management.api.operations.ts`
- `packages/plugin-waste-management/src/waste-management.api.types.operations-inputs.ts`
- `packages/plugin-waste-management/src/waste-management.page.support.tsx`
- `packages/plugin-waste-management/src/waste-management.master-data.state.ts`
- `packages/plugin-waste-management/src/waste-management.master-data.fraction-region-submissions.helpers.ts`
- `packages/plugin-waste-management/src/waste-management.master-data.fraction-region-submissions.ts`
- `packages/plugin-waste-management/src/waste-management.master-data.controller.ts`
- `packages/plugin-waste-management/src/waste-management.master-data-panel.tsx`
- `packages/plugin-waste-management/src/plugin.translations.de.masterData.fractions.ts`
- `packages/plugin-waste-management/src/plugin.translations.en.masterData.fractions.ts`
- `packages/plugin-waste-management/tests/plugin-operations.test.ts`
- `packages/plugin-waste-management/tests/server.test.ts`
- `packages/plugin-waste-management/tests/waste-management.api.test.ts`
- `packages/plugin-waste-management/tests/waste-management.master-data.fraction-submissions.test.ts`
- `packages/plugin-waste-management/tests/waste-management.page.test.tsx`
- `packages/auth-runtime/src/waste-management/core/schemas.ts`
- `packages/auth-runtime/src/waste-management/core/operations.ts`
- `packages/auth-runtime/src/waste-management/core/operations.test.ts`
- `packages/auth-runtime/src/routes.ts`
- `packages/sva-mainserver/src/types.ts`
- `packages/sva-mainserver/src/server/service.ts`
- `packages/sva-mainserver/src/index.server.ts`
- `packages/sva-mainserver/src/server/service.test.ts`
- `apps/sva-studio-react/src/lib/waste-management-operations.types.ts`
- `apps/sva-studio-react/src/lib/waste-management-operations.server.ts`
- `apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts`
- `docs/architecture/05-building-block-view.md`
- `docs/architecture/06-runtime-view.md`

## Constraints And Decisions

- `createOrUpdateStaticContent` ist laut lokalem Mainserver-Snapshot bereits vorhanden; ein vorgelagerter Schema-/Contract-Change ist nicht Teil dieses Plans.
- Der Snapshot enthält **keinen** lesbaren Query-Pfad für `StaticContent`/`AppUserContent`; bestehende `icon`-Werte können deshalb nicht vor dem Überschreiben konserviert werden.
- Konsequenz für diese Iteration: Das generierte `wasteTypes`-Artefakt exportiert nur Felder, die aus dem bestehenden Fraktionsmodell ableitbar sind. `icon` bleibt bewusst außen vor, bis es eine eigene Quelle im Studio oder einen lesbaren Mainserver-Query-Pfad gibt.
- Für den manuellen Retry wird **keine** neue IAM-Permission eingeführt; der technische Startpfad verwendet wie die Fraktionspflege `waste-management.master-data.manage`.

### Task 1: Add The Dedicated Waste Sync Job Contract And Start Endpoint

**Files:**
- Modify: `packages/core/src/waste-management-operations-contract.ts`
- Modify: `packages/core/src/waste-management-operations-contract.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/plugin-sdk/src/public-api.ts`
- Modify: `packages/plugin-sdk/src/index.ts`
- Modify: `packages/plugin-waste-management/src/plugin-operations.ts`
- Modify: `packages/plugin-waste-management/src/server.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.operations.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.types.operations-inputs.ts`
- Modify: `packages/plugin-waste-management/tests/plugin-operations.test.ts`
- Modify: `packages/plugin-waste-management/tests/server.test.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.api.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/schemas.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/operations.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/operations.test.ts`
- Modify: `packages/auth-runtime/src/routes.ts`

- [ ] **Step 1: Write failing contract and API tests**

```ts
// packages/core/src/waste-management-operations-contract.test.ts
expect(wasteManagementOperationsContract.jobTypeIds).toMatchObject({
  syncWasteTypes: 'waste-management.sync-waste-types',
});

// packages/plugin-waste-management/tests/plugin-operations.test.ts
expect(createWasteManagementPluginJobTypes()).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      jobTypeId: 'waste-management.sync-waste-types',
      queue: 'plugin-operations',
    }),
  ])
);

// packages/plugin-waste-management/tests/waste-management.api.test.ts
await startWasteManagementSyncWasteTypes();
expect(fetchMock).toHaveBeenCalledWith(
  '/api/v1/waste-management/tools/sync-waste-types',
  expect.objectContaining({ method: 'POST' })
);

// packages/auth-runtime/src/waste-management/core/operations.test.ts
expect(startPluginOperationJob).toHaveBeenCalledWith(
  expect.objectContaining({
    data: expect.objectContaining({
      jobTypeId: 'waste-management.sync-waste-types',
      input: {
        operation: 'sync-waste-types',
        keycloakSubject: actor.user.id,
        activeOrganizationId: actor.activeOrganizationId,
      },
    }),
  })
);
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run:

```bash
pnpm nx run core:test:unit --testFiles=src/waste-management-operations-contract.test.ts
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/plugin-operations.test.ts --testFiles=tests/server.test.ts --testFiles=tests/waste-management.api.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core/operations.test.ts
```

Expected:

```text
FAIL  ...syncWasteTypes...
FAIL  ...startWasteManagementSyncWasteTypes is not a function...
FAIL  .../tools/sync-waste-types route missing...
```

- [ ] **Step 3: Extend the shared Waste job contract and re-exports**

```ts
// packages/core/src/waste-management-operations-contract.ts
const wasteManagementJobTypeIds = {
  initializeDataSource: 'waste-management.initialize-data-source',
  applyMigrations: 'waste-management.apply-migrations',
  importData: 'waste-management.import-data',
  seedData: 'waste-management.seed-data',
  resetData: 'waste-management.reset-data',
  syncWasteTypes: 'waste-management.sync-waste-types',
} as const;

export type WasteManagementSyncWasteTypesJobInput = {
  readonly operation: 'sync-waste-types';
};

export type WasteManagementJobInput =
  | WasteManagementInitializeJobInput
  | WasteManagementApplyMigrationsJobInput
  | WasteManagementImportJobInput
  | WasteManagementSeedJobInput
  | WasteManagementResetJobInput
  | WasteManagementSyncWasteTypesJobInput;
```

```ts
// packages/core/src/index.ts
export type {
  WasteManagementSyncWasteTypesJobInput,
} from './waste-management-operations-contract.js';
```

- [ ] **Step 4: Add the new job metadata, handler mapping, client API, and host route**

```ts
// packages/plugin-waste-management/src/plugin-operations.ts
{
  jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncWasteTypes,
  queue: wasteManagementOperationsContract.queueName,
  displayName: 'Waste-Typen mit Mainserver synchronisieren',
  progress: {
    phaseKeys: ['waste-management.sync-waste-types', 'waste-management.completed'],
    stepKeys: ['build-static-content', 'push-static-content'],
  },
  result: {
    summaryKeys: ['durationMs'],
    detailKeys: ['staticContentName', 'version', 'fractionCount'],
  },
  errors: {
    detailKeys: ['failed-step'],
  },
}
```

```ts
// packages/plugin-waste-management/src/waste-management.api.operations.ts
export const startWasteManagementSyncWasteTypes = async () =>
  requestWasteManagementJob('/api/v1/waste-management/tools/sync-waste-types', {});
```

```ts
// packages/auth-runtime/src/waste-management/core/operations.ts
startWasteManagementSyncWasteTypesInternal: async (request, ctx, deps = {}) =>
  startToolJob(request, ctx, deps, {
    requiredPermission: 'waste-management.master-data.manage',
    endpoint: 'POST:/api/v1/waste-management/tools/sync-waste-types',
    schema: startSyncWasteTypesSchema,
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncWasteTypes,
    auditActionId: 'waste-management.sync-waste-types.started',
    toPayload: () => ({
      operation: 'sync-waste-types',
      keycloakSubject: ctx.user.id,
      activeOrganizationId: ctx.activeOrganizationId,
    }),
  }),
```

```ts
// packages/auth-runtime/src/routes.ts
| '/api/v1/waste-management/tools/sync-waste-types'
```

- [ ] **Step 5: Re-run the same focused tests and make them pass**

Run:

```bash
pnpm nx run core:test:unit --testFiles=src/waste-management-operations-contract.test.ts
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/plugin-operations.test.ts --testFiles=tests/server.test.ts --testFiles=tests/waste-management.api.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core/operations.test.ts
```

Expected:

```text
PASS  packages/core/src/waste-management-operations-contract.test.ts
PASS  packages/plugin-waste-management/tests/plugin-operations.test.ts
PASS  packages/plugin-waste-management/tests/waste-management.api.test.ts
PASS  packages/auth-runtime/src/waste-management/core/operations.test.ts
```

- [ ] **Step 6: Commit the contract slice**

```bash
git add packages/core packages/plugin-sdk packages/plugin-waste-management packages/auth-runtime
git commit -m "feat: add waste mainserver sync job contract"
```

### Task 2: Add A Typed SVA Mainserver Static Content Write Operation

**Files:**
- Create: `packages/sva-mainserver/src/generated/static-content.ts`
- Create: `packages/sva-mainserver/src/server/service-internals/static-content-operations.ts`
- Modify: `packages/sva-mainserver/src/types.ts`
- Modify: `packages/sva-mainserver/src/server/service.ts`
- Modify: `packages/sva-mainserver/src/index.server.ts`
- Modify: `packages/sva-mainserver/src/server/service.test.ts`

- [ ] **Step 1: Write the failing service test**

```ts
// packages/sva-mainserver/src/server/service.test.ts
await expect(
  service.createOrUpdateStaticContent({
    instanceId: baseConfig.instanceId,
    keycloakSubject: 'subject-1',
    staticContent: {
      name: 'wasteTypes',
      content: '{"bio":{"label":"Biotonne"}}',
      dataType: 'JSON',
      version: 'sha256:abc',
    },
  })
).resolves.toEqual({ id: '77' });

expect(fetchImpl).toHaveBeenLastCalledWith(
  baseConfig.graphqlBaseUrl,
  expect.objectContaining({
    method: 'POST',
    body: expect.stringContaining('createOrUpdateStaticContent'),
  })
);
```

- [ ] **Step 2: Run the SVA Mainserver unit test and confirm it fails**

Run:

```bash
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service.test.ts
```

Expected:

```text
FAIL  ...createOrUpdateStaticContent is not a function...
```

- [ ] **Step 3: Add generated document/types and the dedicated internal operation**

```ts
// packages/sva-mainserver/src/generated/static-content.ts
export type SvaMainserverCreateOrUpdateStaticContentMutation = {
  readonly createOrUpdateStaticContent?: {
    readonly id?: string | number | null;
  } | null;
};

export const svaMainserverCreateOrUpdateStaticContentDocument = `
mutation SvaMainserverCreateOrUpdateStaticContent(
  $name: String!,
  $content: String!,
  $dataType: String!,
  $version: String!
) {
  createOrUpdateStaticContent(
    name: $name
    content: $content
    dataType: $dataType
    version: $version
  ) {
    id
  }
}
`;
```

```ts
// packages/sva-mainserver/src/server/service-internals/static-content-operations.ts
export const createStaticContentOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  writeStaticContentWithConfig: async (input, config): Promise<{ readonly id: string }> => {
    const response = await executeGraphqlWithConfig<SvaMainserverCreateOrUpdateStaticContentMutation>(
      {
        ...input,
        document: svaMainserverCreateOrUpdateStaticContentDocument,
        operationName: 'SvaMainserverCreateOrUpdateStaticContent',
        variables: input.staticContent,
      },
      config
    );

    const id = response.createOrUpdateStaticContent?.id;
    if (id === null || id === undefined) {
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'SVA-Mainserver konnte den Static-Content-Eintrag nicht schreiben.',
        statusCode: 502,
      });
    }

    return { id: String(id) };
  },
});
```

- [ ] **Step 4: Wire the public service surface**

```ts
// packages/sva-mainserver/src/types.ts
export type SvaMainserverStaticContentInput = {
  readonly name: string;
  readonly content: string;
  readonly dataType: 'JSON';
  readonly version: string;
};
```

```ts
// packages/sva-mainserver/src/server/service.ts
const staticContentOperations = createStaticContentOperations(executeGraphqlWithConfig);

const createOrUpdateStaticContent = async (
  input: SvaMainserverConnectionInput & { readonly staticContent: SvaMainserverStaticContentInput }
) => {
  const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
  return staticContentOperations.writeStaticContentWithConfig(input, config);
};

return {
  createOrUpdateStaticContent,
  createEvent,
  createNews,
  createPoi,
  deleteEvent,
  deleteNews,
  deletePoi,
  getConnectionStatus,
  getEvent,
  getMutationRootTypename,
  getNews,
  getPoi,
  getQueryRootTypename,
  listCategories,
  listEvents,
  listNews,
  listPoi,
  updateEvent,
  updateNews,
  updatePoi,
};

export const createOrUpdateSvaMainserverStaticContent = (
  input: SvaMainserverConnectionInput & { readonly staticContent: SvaMainserverStaticContentInput }
) => getDefaultService().createOrUpdateStaticContent(input);
```

- [ ] **Step 5: Re-run the service test and make it pass**

Run:

```bash
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service.test.ts
```

Expected:

```text
PASS  packages/sva-mainserver/src/server/service.test.ts
```

- [ ] **Step 6: Commit the SVA Mainserver integration slice**

```bash
git add packages/sva-mainserver
git commit -m "feat: add mainserver static content write operation"
```

### Task 3: Build The `wasteTypes` Export And Execute The Sync Job Runtime

**Files:**
- Create: `packages/core/src/waste-management-static-content.ts`
- Create: `packages/core/src/waste-management-static-content.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/plugin-waste-management/src/server.ts`
- Modify: `packages/plugin-waste-management/tests/server.test.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.types.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.server.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts`

- [ ] **Step 1: Write the failing export-builder and runtime tests**

```ts
// packages/core/src/waste-management-static-content.test.ts
expect(
  buildWasteTypesStaticContent([
    {
      id: 'fraction-bio',
      name: 'Biotonne auf Abruf',
      pdfShortLabel: 'BIO',
      color: '#8B4513',
      description: 'Nur auf Abruf',
      containerSize: undefined,
      translations: { de: 'Biotonne auf Abruf' },
      active: true,
      reminderCount: 'none',
      reminderChannelPushEnabled: false,
      reminderChannelEmailEnabled: false,
      reminderChannelCalendarEnabled: false,
    },
  ])
).toEqual({
  name: 'wasteTypes',
  version: expect.stringMatching(/^sha256:/),
  content: expect.stringContaining('"bio"'),
});

// apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts
expect(createOrUpdateSvaMainserverStaticContentMock).toHaveBeenCalledWith(
  expect.objectContaining({
    staticContent: expect.objectContaining({
      name: 'wasteTypes',
      dataType: 'JSON',
    }),
  })
);
```

- [ ] **Step 2: Run the focused export/runtime tests and confirm they fail**

Run:

```bash
pnpm nx run core:test:unit --testFiles=src/waste-management-static-content.test.ts
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/server.test.ts
pnpm nx run sva-studio-react:test:unit --testFiles=src/lib/waste-management-operations.server.test.ts
```

Expected:

```text
FAIL  ...buildWasteTypesStaticContent is not defined...
FAIL  ...syncWasteTypes handler missing...
FAIL  ...createOrUpdateSvaMainserverStaticContent not called...
```

- [ ] **Step 3: Implement the pure export builder in `@sva/core`**

```ts
// packages/core/src/waste-management-static-content.ts
import { createHash } from 'node:crypto';
import type { WasteFractionRecord } from './waste-management-master-data.js';

const normalizeWasteTypeKey = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export const buildWasteTypesStaticContent = (fractions: readonly WasteFractionRecord[]) => {
  const payload = Object.fromEntries(
    fractions
      .filter((fraction) => fraction.active)
      .map((fraction) => {
        const key = normalizeWasteTypeKey(fraction.pdfShortLabel ?? fraction.id);
        return [
          key,
          {
            label: fraction.name,
            color: fraction.color,
            selected_color: fraction.color,
            id: fraction.id,
            short_label: fraction.pdfShortLabel ?? null,
            active: fraction.active,
            description: fraction.description ?? null,
            container_size: fraction.containerSize ?? null,
            translations: fraction.translations ?? {},
          },
        ];
      })
  );

  const content = JSON.stringify(payload, null, 2);
  const version = `sha256:${createHash('sha256').update(content).digest('hex')}`;

  return {
    name: 'wasteTypes' as const,
    dataType: 'JSON' as const,
    version,
    content,
    fractionCount: Object.keys(payload).length,
  };
};
```

- [ ] **Step 4: Add the runtime method and plugin job execution branch**

```ts
// apps/sva-studio-react/src/lib/waste-management-operations.types.ts
export type WasteManagementOperationRuntime = {
  initializeDataSource: (instanceId: string, input: WasteManagementInitializeJobInput) => Promise<OperationSummary>;
  applyMigrations: (instanceId: string, input: WasteManagementApplyMigrationsJobInput) => Promise<OperationSummary>;
  importData: (
    instanceId: string,
    input: WasteManagementImportJobInput,
    progressReporter?: WasteImportProgressReporter
  ) => Promise<OperationSummary>;
  seedData: (instanceId: string, input: WasteManagementSeedJobInput) => Promise<OperationSummary>;
  resetData: (instanceId: string, input: WasteManagementResetJobInput) => Promise<OperationSummary>;
  syncWasteTypes: (instanceId: string, input: WasteManagementSyncWasteTypesJobInput) => Promise<OperationSummary>;
};
```

```ts
// apps/sva-studio-react/src/lib/waste-management-operations.server.ts
async syncWasteTypes(instanceId, _input) {
  const startedAt = Date.now();
  const details = await withWasteClient(deps, instanceId, async ({ repository }) => {
    const fractions = await repository.listWasteFractions();
    const artifact = buildWasteTypesStaticContent(fractions);
    const writeResult = await createOrUpdateSvaMainserverStaticContent({
      instanceId,
      keycloakSubject: 'plugin-operation-runtime',
      staticContent: {
        name: artifact.name,
        content: artifact.content,
        dataType: artifact.dataType,
        version: artifact.version,
      },
    });

    return {
      operation: 'sync-waste-types',
      mode: 'executed',
      staticContentName: artifact.name,
      version: artifact.version,
      fractionCount: artifact.fractionCount,
      staticContentId: writeResult.id,
    };
  });

  return buildOperationSummary(startedAt, details);
}
```

```ts
// packages/plugin-waste-management/src/server.ts
[wasteManagementOperationsContract.jobTypeIds.syncWasteTypes]:
  createOperationHandler<WasteManagementSyncWasteTypesJobInput>({
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncWasteTypes,
    expectedOperation: 'sync-waste-types',
    phaseKey: 'waste-management.sync-waste-types',
    execute: (runtimeArg, instanceId, payload) => runtimeArg.syncWasteTypes(instanceId, payload),
  })(runtime),
```

- [ ] **Step 5: Re-run the focused tests and make them pass**

Run:

```bash
pnpm nx run core:test:unit --testFiles=src/waste-management-static-content.test.ts
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/server.test.ts
pnpm nx run sva-studio-react:test:unit --testFiles=src/lib/waste-management-operations.server.test.ts
```

Expected:

```text
PASS  packages/core/src/waste-management-static-content.test.ts
PASS  packages/plugin-waste-management/tests/server.test.ts
PASS  apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts
```

- [ ] **Step 6: Commit the export/runtime slice**

```bash
git add packages/core packages/plugin-waste-management apps/sva-studio-react
git commit -m "feat: sync waste types to mainserver"
```

### Task 4: Trigger Sync After Fraction Changes And Surface Retry In The Fractions Context

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.page.support.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data.state.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data.fraction-region-submissions.helpers.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data.fraction-region-submissions.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data.controller.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-panel.tsx`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.masterData.fractions.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.masterData.fractions.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.master-data.fraction-submissions.test.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.page.test.tsx`

- [ ] **Step 1: Write failing UI/submission tests**

```ts
// packages/plugin-waste-management/tests/waste-management.master-data.fraction-submissions.test.ts
expect(startWasteManagementSyncWasteTypesMock).toHaveBeenCalledTimes(1);
expect(ctx.state.setMessage).toHaveBeenCalledWith({
  kind: 'warning',
  text: 'masterData.fractions.messages.syncWarning',
  retryAction: 'sync-waste-types',
});

// packages/plugin-waste-management/tests/waste-management.page.test.tsx
expect(screen.getByRole('button', { name: /erneut synchronisieren/i })).toBeInTheDocument();
```

- [ ] **Step 2: Run the fractions/UI tests and confirm they fail**

Run:

```bash
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.master-data.fraction-submissions.test.ts --testFiles=tests/waste-management.page.test.tsx
```

Expected:

```text
FAIL  ...warning...
FAIL  ...retryAction...
FAIL  ...Erneut synchronisieren button missing...
```

- [ ] **Step 3: Extend the message model with a single dedicated retry action**

```ts
// packages/plugin-waste-management/src/waste-management.page.support.tsx
export type StatusMessage = {
  readonly kind: 'success' | 'error' | 'warning';
  readonly text: string;
  readonly retryAction?: 'sync-waste-types';
};
```

```tsx
// packages/plugin-waste-management/src/waste-management.page.support.tsx
export const StatusNotice = ({
  message,
  onRetry,
}: {
  readonly message: StatusMessage | null;
  readonly onRetry?: (action: StatusMessage['retryAction']) => void;
}) =>
  message ? (
    <Alert>
      <AlertTitle>
        {message.kind === 'success'
          ? pt('common.statusSuccessTitle')
          : message.kind === 'warning'
            ? pt('common.statusWarningTitle')
            : pt('common.statusErrorTitle')}
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{message.text}</p>
        {message.retryAction ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onRetry?.(message.retryAction)}
          >
            {pt('masterData.fractions.actions.retrySync')}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  ) : null;
```

- [ ] **Step 4: Start the sync job after successful fraction mutations and downgrade sync failures to warnings**

```ts
// packages/plugin-waste-management/src/waste-management.master-data.fraction-region-submissions.helpers.ts
const startFractionSyncWithWarning = async (ctx: FractionRegionSubmissionHelperContext) => {
  try {
    await startWasteManagementSyncWasteTypes();
  } catch {
    ctx.state.setMessage({
      kind: 'warning',
      text: ctx.pt('masterData.fractions.messages.syncWarning'),
      retryAction: 'sync-waste-types',
    });
  }
};
```

```ts
// in createSubmitFractionHandler / createDeleteFractionHandler / createDeleteFractionsHandler / createSetFractionActiveHandler
await ctx.loadOverview(true);
applySuccess(
  () => ctx.state.setDialogOpen(false),
  ctx.state.setMessage,
  mode === 'create'
    ? ctx.pt('masterData.fractions.messages.createSuccess')
    : ctx.pt('masterData.fractions.messages.updateSuccess'),
  () => ctx.state.setLastOutcome(mode === 'create' ? 'fraction-create-success' : 'fraction-update-success')
);
await startFractionSyncWithWarning(ctx);
```

```ts
// packages/plugin-waste-management/src/waste-management.master-data.controller.ts
const retrySyncWasteTypes = async () => {
  state.setMessage(null);
  try {
    await startWasteManagementSyncWasteTypes();
    state.setMessage({ kind: 'success', text: pt('masterData.fractions.messages.syncRetryStarted') });
  } catch {
    state.setMessage({
      kind: 'warning',
      text: pt('masterData.fractions.messages.syncWarning'),
      retryAction: 'sync-waste-types',
    });
  }
};
```

- [ ] **Step 5: Wire the retry button in the panel and add translations**

```tsx
// packages/plugin-waste-management/src/waste-management.master-data-panel.tsx
<StatusNotice
  message={controller.message}
  onRetry={(action) => {
    if (action === 'sync-waste-types') {
      void controller.retrySyncWasteTypes();
    }
  }}
/>;
```

```ts
// packages/plugin-waste-management/src/plugin.translations.de.masterData.fractions.ts
syncWarning: 'Die Fraktion wurde gespeichert, aber wasteTypes konnte nicht mit dem Mainserver synchronisiert werden.',
syncRetryStarted: 'Die Synchronisation von wasteTypes wurde erneut gestartet.',
retrySync: 'Erneut synchronisieren',
```

- [ ] **Step 6: Re-run the fractions/UI tests and make them pass**

Run:

```bash
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.master-data.fraction-submissions.test.ts --testFiles=tests/waste-management.page.test.tsx
```

Expected:

```text
PASS  packages/plugin-waste-management/tests/waste-management.master-data.fraction-submissions.test.ts
PASS  packages/plugin-waste-management/tests/waste-management.page.test.tsx
```

- [ ] **Step 7: Commit the trigger/retry slice**

```bash
git add packages/plugin-waste-management
git commit -m "feat: retry failed waste mainserver sync from fractions"
```

### Task 5: Final Verification And Documentation

**Files:**
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`

- [ ] **Step 1: Document the new building block and runtime flow**

```md
<!-- docs/architecture/05-building-block-view.md -->
- `@sva/core` enthält die framework-agnostische Erzeugung des `wasteTypes`-Static-Content-Artefakts.
- `@sva/sva-mainserver` kapselt die dedizierte GraphQL-Mutation `createOrUpdateStaticContent`.
- `apps/sva-studio-react` stellt die konkrete Waste-Job-Runtime bereit und führt den Mainserver-Sync aus.
```

```md
<!-- docs/architecture/06-runtime-view.md -->
1. Fraktion lokal in Waste speichern
2. Fraktionsübersicht neu laden
3. Plugin-Operation `waste-management.sync-waste-types` enqueuen
4. Runtime lädt aktive Fraktionen, erzeugt `wasteTypes`, berechnet `sha256`-Version
5. Runtime schreibt `createOrUpdateStaticContent(name: "wasteTypes", ...)` auf den Mainserver
6. Bei Enqueue-Fehler zeigt das Studio eine Warnung mit Retry im Fraktionskontext
```

- [ ] **Step 2: Run the smallest real multi-package verification path**

Run:

```bash
pnpm nx run core:test:unit --testFiles=src/waste-management-operations-contract.test.ts --testFiles=src/waste-management-static-content.test.ts
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core/operations.test.ts
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/plugin-operations.test.ts --testFiles=tests/server.test.ts --testFiles=tests/waste-management.api.test.ts --testFiles=tests/waste-management.master-data.fraction-submissions.test.ts --testFiles=tests/waste-management.page.test.tsx
pnpm nx run sva-studio-react:test:unit --testFiles=src/lib/waste-management-operations.server.test.ts --testFiles=src/lib/plugin-operation-runtime.server.test.ts
pnpm check:server-runtime
pnpm nx affected --target=test:types --base=origin/main
```

Expected:

```text
PASS  all targeted Vitest runs
PASS  check:server-runtime
PASS  affected type checks
```

- [ ] **Step 3: Create the final integration commit**

```bash
git add packages apps docs/architecture
git commit -m "feat: sync waste types to mainserver after fraction changes"
```

- [ ] **Step 4: Sanity-check the working tree**

Run:

```bash
git status --short
```

Expected:

```text
No unexpected modified files outside the planned scope.
```
