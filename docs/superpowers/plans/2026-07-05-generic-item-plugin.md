# Generic Item Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full editorial `Generic Item` plugin that exposes broad `GenericItem` field coverage, a free-text `genericType`, and a free JSON `payload`, while keeping the GUI as close as practical to the established `POI` and `Events` editor patterns with a deliberately small tab count.

**Architecture:** Add a new host-to-mainserver CRUD path for `GenericItem`, then add a new workspace plugin `@sva/plugin-generic-items` that follows the existing standard content plugin pattern. Keep the plugin self-contained, use canonical `GenericItem` core fields directly, shape the editor around the same card language used by `plugin-poi` and `plugin-events`, compress the main flow into `Basis`, `Inhalt`, and `Einstellungen` with optional `Historie`, and postpone explicit legacy-format handling to a later dedicated change.

**Tech Stack:** TypeScript strict mode, Nx, Vitest, React, TanStack Router, `@sva/plugin-sdk`, `@sva/studio-ui-react`, `@sva/sva-mainserver`, existing host content bindings

---

## Iteration-1 UI Scope

The first editorial cut must keep the `Inhalt` tab broad but still bounded.

### Must-have groups in Iteration 1

- Text: `teaser`, `description`, `contentBlocks`
- Classification: `categories`, `keywords`
- Places: `addresses`, `locations`, optional `pointOfInterest` if the existing linking pattern can be reused without a special-case detour
- Links and media: `webUrls`, `mediaContents`
- Dates: `dates`

### Nice-to-have only if they attach cheaply to existing patterns

- `contacts`
- `companies`
- `openingHours`
- `accessibilityInformations`

### Explicitly de-prioritized for Iteration 1

- `settings`
- `pushNotifications`
- `quota`
- `genericItemMessages`
- `discountType`
- `priceInformations`
- `dataProvider`
- `ancestry`
- nested `genericItems`
- `memberId`
- `likeCount`
- `likedByMe`

The implementation should not over-promise complete first-pass UI parity for every upstream field. Unknown or low-priority fields can remain in `Einstellungen`, read-only, or out of scope for the first slice.

## Iteration-1 Settings Scope

The `Einstellungen` tab must also stay intentionally narrow.

### Editable in Iteration 1

- `payload` as the main free-form extension area
- `settings` only if it can be attached as a lightweight structured/free-json adjunct without creating a second complex editor system

### Visible but read-only in Iteration 1

- `pushNotifications`
- `quota`
- `dataProvider`
- `genericItemMessages`

### Out of first-cut settings scope

- `discountType`
- `priceInformations`
- `ancestry`
- nested `genericItems`
- `memberId`
- `likeCount`
- `likedByMe`

The settings tab should not become the dumping ground for every leftover field. In the first slice it is primarily about free payload editing plus a small amount of controlled technical visibility.

## Iteration-1 Basis Validation Scope

The `Basis` tab should stay deliberately light on required input.

### Required in Iteration 1

- `title`
- `genericType`

### Optional or defaulted in Iteration 1

- `visible`
- `publicationDate`
- `publishedAt`
- `author`
- `externalId`

If `visible` or related publication flags need a value for the write path, prefer a stable default over another mandatory user input.

## File Structure

### New package

- Create: `packages/plugin-generic-items/`
- Create: `packages/plugin-generic-items/src/plugin.tsx`
- Create: `packages/plugin-generic-items/src/generic-items.constants.ts`
- Create: `packages/plugin-generic-items/src/generic-items.types.ts`
- Create: `packages/plugin-generic-items/src/generic-items.api.ts`
- Create: `packages/plugin-generic-items/src/generic-items.validation.ts`
- Create: `packages/plugin-generic-items/src/generic-items.pages.tsx`
- Create: `packages/plugin-generic-items/src/generic-items.detail-page.tsx`
- Create: `packages/plugin-generic-items/src/generic-items.detail-basis-tab.tsx`
- Create: `packages/plugin-generic-items/src/generic-items.detail-content-tab.tsx`
- Create: `packages/plugin-generic-items/src/generic-items.detail-settings-tab.tsx`
- Create: `packages/plugin-generic-items/src/generic-items.detail-card.tsx`
- Create: `packages/plugin-generic-items/src/generic-items.detail-tabs.tsx`
- Create: `packages/plugin-generic-items/src/plugin.translations.ts`
- Create: `packages/plugin-generic-items/src/index.ts`
- Create: `packages/plugin-generic-items/tests/plugin.test.ts`
- Create: `packages/plugin-generic-items/tests/generic-items.api.test.ts`
- Create: `packages/plugin-generic-items/tests/generic-items.validation.test.ts`
- Create: `packages/plugin-generic-items/tests/generic-items.pages.test.tsx`
- Create: `packages/plugin-generic-items/tests/generic-items.detail-page.test.tsx`
- Create: `packages/plugin-generic-items/package.json`
- Create: `packages/plugin-generic-items/project.json`
- Create: `packages/plugin-generic-items/plugin.manifest.json`
- Create: `packages/plugin-generic-items/tsconfig.json`
- Create: `packages/plugin-generic-items/tsconfig.lib.json`
- Create: `packages/plugin-generic-items/vitest.config.ts`
- Create: `packages/plugin-generic-items/README.md`

### Mainserver integration

- Create: `packages/sva-mainserver/src/generated/generic-items.ts`
- Create: `packages/sva-mainserver/src/server/service-internals/generic-item-mappers.ts`
- Create: `packages/sva-mainserver/src/server/service-internals/generic-item-operations.ts`
- Create: `packages/sva-mainserver/src/server/generic-items-route.ts`
- Create: `packages/sva-mainserver/src/server/generic-items-route.test.ts`
- Modify: `packages/sva-mainserver/src/server/service.ts`
- Modify: `packages/sva-mainserver/src/server/content-route-core.ts` only if shared response helpers are missing
- Modify: `packages/sva-mainserver/src/server/interfaces-contract.ts` only if the route registry contract must list the new endpoint
- Modify: `packages/sva-mainserver/src/server/service.test.ts`

### Host app integration

- Modify: `apps/sva-studio-react/plugin-catalog.json`
- Modify: `apps/sva-studio-react/src/routing/app-route-bindings.tsx`
- Modify: `apps/sva-studio-react/src/hooks/use-unified-content-list.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-content-list-mainserver.ts`
- Modify: `apps/sva-studio-react/src/routes/content/-content-type-picker-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/content/-content-type-picker-page.test.tsx`
- Modify: `apps/sva-studio-react/src/hooks/use-unified-content-list.test.tsx`
- Modify: `apps/sva-studio-react/src/routing/app-route-bindings.test.tsx`

### Docs

- Modify: `docs/superpowers/specs/2026-07-05-generic-item-plugin-pattern-design.md`
- Create: `docs/guides/generic-item-plugin.md` if plugin-specific editorial guidance is needed
- Modify: `docs/architecture/05-building-block-view.md` if the new GenericItem path materially changes the documented host/mainserver integration view

---

### Task 1: Lock down the GenericItem host contract in `@sva/sva-mainserver`

**Files:**
- Create: `packages/sva-mainserver/src/generated/generic-items.ts`
- Create: `packages/sva-mainserver/src/server/service-internals/generic-item-mappers.ts`
- Create: `packages/sva-mainserver/src/server/service-internals/generic-item-operations.ts`
- Modify: `packages/sva-mainserver/src/server/service.ts`
- Test: `packages/sva-mainserver/src/server/service.test.ts`

- [ ] **Step 1: Write the failing service-level tests for list/get/create/update/delete**

```ts
it('lists GenericItems through the typed GraphQL adapter', async () => {
  const service = createSvaMainserverService(testDeps);

  const result = await service.listGenericItems({
    instanceId: 'de-test',
    keycloakSubject: 'user-1',
    page: 1,
    pageSize: 20,
  });

  expect(result.data[0]).toMatchObject({
    id: 'generic-1',
    genericType: 'free-editorial-type',
    title: 'Freier Eintrag',
  });
});

it('preserves free payload JSON on create and update', async () => {
  const service = createSvaMainserverService(testDeps);

  const created = await service.createGenericItem({
    instanceId: 'de-test',
    keycloakSubject: 'user-1',
    genericItem: {
      genericType: 'free-editorial-type',
      title: 'Freier Eintrag',
      payload: { arbitrary: ['value'] },
    },
  });

  expect(created.item?.payload).toEqual({ arbitrary: ['value'] });
});
```

- [ ] **Step 2: Run the focused failing tests**

Run: `pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service.test.ts -t "GenericItems"`

Expected: FAIL because the GenericItem service methods and operations do not exist yet.

- [ ] **Step 3: Add generated GraphQL documents and mapper skeletons**

```ts
// packages/sva-mainserver/src/generated/generic-items.ts
export const svaMainserverListGenericItemsDocument = /* GraphQL */ `
  query ListGenericItems($page: Int!, $perPage: Int!) {
    genericItems(page: $page, perPage: $perPage) {
      id
      genericType
      title
      teaser
      description
      author
      publicationDate
      publishedAt
      visible
      payload
      createdAt
      updatedAt
    }
  }
`;
```

```ts
// packages/sva-mainserver/src/server/service-internals/generic-item-mappers.ts
export const mapGenericItemSummary = (node: GenericItemNode): SvaMainserverGenericItem => ({
  id: node.id,
  genericType: node.genericType ?? '',
  title: node.title ?? '',
  teaser: node.teaser ?? '',
  description: node.description ?? '',
  author: node.author ?? '',
  publicationDate: node.publicationDate ?? undefined,
  publishedAt: node.publishedAt ?? undefined,
  visible: node.visible ?? undefined,
  payload: node.payload ?? null,
  createdAt: node.createdAt,
  updatedAt: node.updatedAt,
});
```

- [ ] **Step 4: Wire service methods through `service.ts`**

```ts
export const listSvaMainserverGenericItems = (input: SvaMainserverGenericItemListInput) =>
  defaultSvaMainserverService.listGenericItems(input);

export const getSvaMainserverGenericItem = (input: SvaMainserverGenericItemGetInput) =>
  defaultSvaMainserverService.getGenericItem(input);

export const createSvaMainserverGenericItem = (input: SvaMainserverGenericItemCreateInput) =>
  defaultSvaMainserverService.createGenericItem(input);

export const updateSvaMainserverGenericItem = (input: SvaMainserverGenericItemUpdateInput) =>
  defaultSvaMainserverService.updateGenericItem(input);

export const deleteSvaMainserverGenericItem = (input: SvaMainserverGenericItemDeleteInput) =>
  defaultSvaMainserverService.deleteGenericItem(input);
```

- [ ] **Step 5: Run the focused service tests again**

Run: `pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service.test.ts -t "GenericItems"`

Expected: PASS

- [ ] **Step 6: Run the early server-runtime gate**

Run: `pnpm check:server-runtime`

Expected: PASS

- [ ] **Step 7: Commit the mainserver contract slice**

```bash
git add packages/sva-mainserver/src/generated/generic-items.ts \
  packages/sva-mainserver/src/server/service-internals/generic-item-mappers.ts \
  packages/sva-mainserver/src/server/service-internals/generic-item-operations.ts \
  packages/sva-mainserver/src/server/service.ts \
  packages/sva-mainserver/src/server/service.test.ts
git commit -m "feat: add generic item mainserver service contract"
```

### Task 2: Expose `/api/v1/mainserver/generic-items` in the host server route layer

**Files:**
- Create: `packages/sva-mainserver/src/server/generic-items-route.ts`
- Create: `packages/sva-mainserver/src/server/generic-items-route.test.ts`
- Modify: `packages/sva-mainserver/src/server/interfaces-contract.ts`
- Test: `packages/sva-mainserver/src/server/generic-items-route.test.ts`

- [ ] **Step 1: Write the failing route tests for CRUD and authorization**

```ts
it('returns GenericItem list data for authorized readers', async () => {
  const response = await handleGenericItemsRoute(
    new Request('https://studio.test/api/v1/mainserver/generic-items?page=1&pageSize=20'),
    authenticatedContext,
  );

  expect(response.status).toBe(200);
});

it('rejects mutation requests without csrf', async () => {
  const response = await handleGenericItemsRoute(
    new Request('https://studio.test/api/v1/mainserver/generic-items', {
      method: 'POST',
      body: JSON.stringify({ title: 'Freier Eintrag', genericType: 'faq' }),
    }),
    authenticatedContext,
  );

  expect(response.status).toBe(403);
});
```

- [ ] **Step 2: Run the failing route tests**

Run: `pnpm nx run sva-mainserver:test:unit --testFiles=src/server/generic-items-route.test.ts`

Expected: FAIL because the route file and interface contract are missing.

- [ ] **Step 3: Implement the route using the existing content route pattern**

```ts
const GENERIC_ITEMS_CONTENT_TYPE = 'generic-items.generic-item';

const handleList = async (request: Request, ctx: AuthenticatedRequestContext) => {
  const actor = await authorizeOrResponse(ctx, 'read');
  if (actor instanceof Response) return actor;

  return json(await listSvaMainserverGenericItems({
    ...actor,
    ...parseMainserverListQuery(request),
  }));
};
```

```ts
const handleCreate = async (request: Request, ctx: AuthenticatedRequestContext) => {
  return createGenericItemMutationHandler({
    action: 'create',
    parse: parseGenericItemInput,
    execute: async (actor, genericItem) => {
      const created = await createSvaMainserverGenericItem({ ...actor, genericItem });
      return json({ data: created.item ?? null }, 201);
    },
  })(request, ctx);
};
```

- [ ] **Step 4: Run the focused route tests**

Run: `pnpm nx run sva-mainserver:test:unit --testFiles=src/server/generic-items-route.test.ts`

Expected: PASS

- [ ] **Step 5: Run the package unit scope for `sva-mainserver`**

Run: `pnpm nx run sva-mainserver:test:unit`

Expected: PASS

- [ ] **Step 6: Commit the host route layer**

```bash
git add packages/sva-mainserver/src/server/generic-items-route.ts \
  packages/sva-mainserver/src/server/generic-items-route.test.ts \
  packages/sva-mainserver/src/server/interfaces-contract.ts
git commit -m "feat: add generic items host route"
```

### Task 3: Scaffold the new `@sva/plugin-generic-items` package and plugin contract

**Files:**
- Create: `packages/plugin-generic-items/package.json`
- Create: `packages/plugin-generic-items/project.json`
- Create: `packages/plugin-generic-items/plugin.manifest.json`
- Create: `packages/plugin-generic-items/src/plugin.tsx`
- Create: `packages/plugin-generic-items/src/generic-items.constants.ts`
- Create: `packages/plugin-generic-items/src/plugin.translations.ts`
- Create: `packages/plugin-generic-items/src/index.ts`
- Test: `packages/plugin-generic-items/tests/plugin.test.ts`

- [ ] **Step 1: Write the failing plugin contract test**

```ts
it('registers Generic Items as a standard content plugin', () => {
  expect(pluginGenericItems.navigation).toEqual([
    expect.objectContaining({ to: '/admin/generic-items' }),
  ]);
  expect(pluginGenericItems.contentTypes).toEqual([
    expect.objectContaining({ contentType: 'generic-items.generic-item' }),
  ]);
});
```

- [ ] **Step 2: Run the failing plugin contract test**

Run: `pnpm nx run plugin-generic-items:test:unit --testFiles=tests/plugin.test.ts`

Expected: FAIL because the package does not exist yet.

- [ ] **Step 3: Create the package manifest and plugin definition**

```ts
// packages/plugin-generic-items/src/generic-items.constants.ts
export const GENERIC_ITEMS_CONTENT_TYPE = 'generic-items.generic-item';
```

```ts
// packages/plugin-generic-items/src/plugin.tsx
const standardContribution = createStandardContentPluginContribution({
  pluginId: 'generic-items',
  displayName: 'Generic Items',
  contentType: GENERIC_ITEMS_CONTENT_TYPE,
  titleKey: 'genericItems.navigation.title',
  listBindingKey: 'genericItemsList',
  detailBindingKey: 'genericItemsDetail',
  editorBindingKey: 'genericItemsEditor',
});
```

- [ ] **Step 4: Run the focused plugin contract test**

Run: `pnpm nx run plugin-generic-items:test:unit --testFiles=tests/plugin.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the plugin scaffold**

```bash
git add packages/plugin-generic-items
git commit -m "feat: scaffold generic items plugin package"
```

### Task 4: Build the plugin API, types, validation, and first-pass payload handling

**Files:**
- Create: `packages/plugin-generic-items/src/generic-items.types.ts`
- Create: `packages/plugin-generic-items/src/generic-items.api.ts`
- Create: `packages/plugin-generic-items/src/generic-items.validation.ts`
- Create: `packages/plugin-generic-items/tests/generic-items.api.test.ts`
- Create: `packages/plugin-generic-items/tests/generic-items.validation.test.ts`

- [ ] **Step 1: Write failing tests for free payload roundtrip and legacy normalization**

```ts
it('roundtrips arbitrary payload json without narrowing it', async () => {
  const created = await createGenericItem({
    genericType: 'free-editorial-type',
    title: 'Freier Eintrag',
    payload: { nested: { value: true }, tags: ['a'] },
  });

  expect(created.payload).toEqual({ nested: { value: true }, tags: ['a'] });
});

it('preserves free payload json for newly created editor data', () => {
  expect(normalizeGenericItemPayload({ free: ['value'] })).toEqual({
    mode: 'json',
    value: { free: ['value'] },
    warning: null,
  });
});
```

- [ ] **Step 2: Run the failing API and validation tests**

Run: `pnpm nx run plugin-generic-items:test:unit --testFiles=tests/generic-items.api.test.ts --testFiles=tests/generic-items.validation.test.ts`

Expected: FAIL because the API and payload helpers do not exist.

- [ ] **Step 3: Implement the broad editor model and free payload API**

```ts
export type GenericItemPayloadValue =
  | null
  | boolean
  | number
  | string
  | readonly GenericItemPayloadValue[]
  | { readonly [key: string]: GenericItemPayloadValue };

export type GenericItemFormInput = Readonly<{
  genericType: string;
  title: string;
  teaser: string;
  description: string;
  author: string;
  publicationDate: string;
  publishedAt: string;
  visible: boolean;
  payloadText: string;
}>;
```

```ts
export const normalizeGenericItemPayload = (payload: unknown) => {
  if (payload === null || typeof payload === 'boolean' || typeof payload === 'number' || typeof payload === 'string') {
    return { mode: 'json', value: payload, warning: null };
  }
  if (Array.isArray(payload) || isPlainObject(payload)) {
    return { mode: 'json', value: payload, warning: null };
  }
  return { mode: 'unsupported', value: null, warning: 'unsupported_legacy_payload' as const };
};
```
Do not add speculative legacy coercions in this first slice. If a payload cannot be represented safely by the first-pass free editor model, fail clearly and defer legacy support to the later dedicated change.

- [ ] **Step 4: Run the plugin unit scope for API and validation**

Run: `pnpm nx run plugin-generic-items:test:unit --testFiles=tests/generic-items.api.test.ts --testFiles=tests/generic-items.validation.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the plugin data contract**

```bash
git add packages/plugin-generic-items/src/generic-items.types.ts \
  packages/plugin-generic-items/src/generic-items.api.ts \
  packages/plugin-generic-items/src/generic-items.validation.ts \
  packages/plugin-generic-items/tests/generic-items.api.test.ts \
  packages/plugin-generic-items/tests/generic-items.validation.test.ts
git commit -m "feat: add generic item plugin data contract"
```

### Task 5: Build the editorial UI and hook it into the Studio host

**Files:**
- Create: `packages/plugin-generic-items/src/generic-items.pages.tsx`
- Create: `packages/plugin-generic-items/src/generic-items.detail-page.tsx`
- Create: `packages/plugin-generic-items/src/generic-items.detail-basis-tab.tsx`
- Create: `packages/plugin-generic-items/src/generic-items.detail-content-tab.tsx`
- Create: `packages/plugin-generic-items/src/generic-items.detail-settings-tab.tsx`
- Create: `packages/plugin-generic-items/src/generic-items.detail-history-tab.tsx`
- Create: `packages/plugin-generic-items/src/generic-items.detail-card.tsx`
- Create: `packages/plugin-generic-items/src/generic-items.detail-tabs.tsx`
- Create: `packages/plugin-generic-items/tests/generic-items.pages.test.tsx`
- Create: `packages/plugin-generic-items/tests/generic-items.detail-page.test.tsx`
- Modify: `apps/sva-studio-react/plugin-catalog.json`
- Modify: `apps/sva-studio-react/src/routing/app-route-bindings.tsx`
- Modify: `apps/sva-studio-react/src/routes/content/-content-type-picker-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/content/-content-type-picker-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routing/app-route-bindings.test.tsx`

- [ ] **Step 1: Write the failing page tests for create/edit, free `genericType`, and the compressed POI/Events-like editor structure**

```tsx
it('renders a free-text generic type field in the editor', async () => {
  render(<GenericItemsCreatePage />);
  expect(screen.getByLabelText('Typ')).toBeInTheDocument();
});

it('requires only title and generic type in the basis tab', async () => {
  render(<GenericItemsCreatePage />);
  await user.click(screen.getByRole('button', { name: 'Speichern' }));
  expect(screen.getByText('Titel ist erforderlich.')).toBeInTheDocument();
  expect(screen.getByText('Typ ist erforderlich.')).toBeInTheDocument();
  expect(screen.queryByText('Autor ist erforderlich.')).toBeNull();
});

it('shows payload warnings for unsupported legacy payloads', async () => {
  render(<GenericItemsEditPage initialItem={itemWithUnsupportedPayload} />);
  expect(screen.getByText('Dieses Altformat kann nicht vollständig bearbeitet werden.')).toBeInTheDocument();
});

it('reuses the familiar detail tab structure instead of a raw json editor layout', async () => {
  render(<GenericItemsCreatePage />);
  expect(screen.getByRole('tab', { name: 'Basis' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Inhalt' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Einstellungen' })).toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'Struktur' })).toBeNull();
});

it('ships the must-have content groups in the first Inhalt tab cut', async () => {
  render(<GenericItemsCreatePage />);
  expect(screen.getByText('Texte')).toBeInTheDocument();
  expect(screen.getByText('Adressen und Orte')).toBeInTheDocument();
  expect(screen.getByText('Links und Medien')).toBeInTheDocument();
  expect(screen.getByText('Termine')).toBeInTheDocument();
});

it('keeps settings focused on payload and controlled technical visibility', async () => {
  render(<GenericItemsCreatePage />);
  await user.click(screen.getByRole('tab', { name: 'Einstellungen' }));
  expect(screen.getByLabelText('Payload')).toBeInTheDocument();
  expect(screen.queryByLabelText('Like Count')).toBeNull();
});
```

- [ ] **Step 2: Run the failing page tests**

Run: `pnpm nx run plugin-generic-items:test:unit --testFiles=tests/generic-items.pages.test.tsx`

Expected: FAIL because the pages and host bindings do not exist.

- [ ] **Step 3: Implement the pages with the same editor composition style used by `POI` and `Events` and register them in the host**

```tsx
export const GenericItemsCreatePage = () => <GenericItemDetailPage mode="create" />;
export const GenericItemsEditPage = () => <GenericItemDetailPage mode="edit" />;
```

```tsx
export const GenericItemDetailTabs = ({ includeHistory, ...props }: GenericItemDetailTabsProps) => (
  <StudioDetailTabs
    tabs={[
      { id: 'basis', label: t('genericItems.tabs.basis') },
      { id: 'content', label: t('genericItems.tabs.content') },
      { id: 'settings', label: t('genericItems.tabs.settings') },
      ...(includeHistory ? [{ id: 'history', label: t('genericItems.tabs.history') }] : []),
    ]}
    {...props}
  />
);
```

```tsx
export const GenericItemsDetailBasisTab = () => (
  <GenericItemsDetailCard title={t('genericItems.cards.identity.title')}>
    <TextField name="title" />
    <TextField name="genericType" />
    <TextareaField name="teaser" />
    <TextField name="author" />
    <TextField name="externalId" />
  </GenericItemsDetailCard>
);
```

```tsx
export const GenericItemsDetailContentTab = () => (
  <>
    <GenericItemsDetailCard title={t('genericItems.cards.content.text.title')}>
      <TextareaField name="teaser" />
      <RichTextField name="description" />
      <ContentBlocksField name="contentBlocks" />
    </GenericItemsDetailCard>
    <GenericItemsDetailCard title={t('genericItems.cards.content.classification.title')}>
      <CategoriesField name="categories" />
      <KeywordsField name="keywords" />
    </GenericItemsDetailCard>
    <GenericItemsDetailCard title={t('genericItems.cards.content.places.title')}>
      <AddressesField name="addresses" />
      <LocationsField name="locations" />
      <PointOfInterestField name="pointOfInterest" />
    </GenericItemsDetailCard>
    <GenericItemsDetailCard title={t('genericItems.cards.content.linksMedia.title')}>
      <LinksField name="webUrls" />
      <MediaContentsField name="mediaContents" />
    </GenericItemsDetailCard>
    <GenericItemsDetailCard title={t('genericItems.cards.content.dates.title')}>
      <DatesField name="dates" />
    </GenericItemsDetailCard>
    <GenericItemsDetailCard title={t('genericItems.cards.content.optional.title')}>
      <ContactsField name="contacts" />
      <OpeningHoursField name="openingHours" />
      <AccessibilityField name="accessibilityInformations" />
      <CompaniesField name="companies" />
    </GenericItemsDetailCard>
  </>
);
```

```tsx
export const GenericItemsDetailSettingsTab = () => (
  <>
    <GenericItemsDetailCard title={t('genericItems.cards.settings.payload.title')}>
      <PayloadEditorField name="payloadText" />
    </GenericItemsDetailCard>
    <GenericItemsDetailCard title={t('genericItems.cards.settings.runtime.title')}>
      <ReadOnlyField name="pushNotifications" />
      <ReadOnlyField name="quota" />
      <ReadOnlyField name="dataProvider" />
      <ReadOnlyField name="genericItemMessages" />
    </GenericItemsDetailCard>
  </>
);
```

```json
// apps/sva-studio-react/plugin-catalog.json
{
  "pluginId": "generic-items",
  "sourceType": "workspace",
  "enabled": true,
  "sourceRef": "packages/plugin-generic-items"
}
```

```tsx
// apps/sva-studio-react/src/routing/app-route-bindings.tsx
import { GenericItemsCreatePage, GenericItemsEditPage } from '@sva/plugin-generic-items';
```

- [ ] **Step 4: Run the plugin UI tests and host route-binding tests**

Run: `pnpm nx run plugin-generic-items:test:unit --testFiles=tests/generic-items.pages.test.tsx`

Run: `pnpm nx run plugin-generic-items:test:unit --testFiles=tests/generic-items.detail-page.test.tsx`

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/routing/app-route-bindings.test.tsx --testFiles=src/routes/content/-content-type-picker-page.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the UI and host bindings**

```bash
git add packages/plugin-generic-items/src/generic-items.pages.tsx \
  packages/plugin-generic-items/src/generic-items.detail-page.tsx \
  packages/plugin-generic-items/src/generic-items.detail-basis-tab.tsx \
  packages/plugin-generic-items/src/generic-items.detail-content-tab.tsx \
  packages/plugin-generic-items/src/generic-items.detail-settings-tab.tsx \
  packages/plugin-generic-items/src/generic-items.detail-card.tsx \
  packages/plugin-generic-items/src/generic-items.detail-tabs.tsx \
  packages/plugin-generic-items/tests/generic-items.pages.test.tsx \
  packages/plugin-generic-items/tests/generic-items.detail-page.test.tsx \
  apps/sva-studio-react/plugin-catalog.json \
  apps/sva-studio-react/src/routing/app-route-bindings.tsx \
  apps/sva-studio-react/src/routes/content/-content-type-picker-page.tsx \
  apps/sva-studio-react/src/routes/content/-content-type-picker-page.test.tsx \
  apps/sva-studio-react/src/routing/app-route-bindings.test.tsx
git commit -m "feat: add generic item editorial pages"
```

### Task 6: Add unified content list support, docs, and final verification

**Files:**
- Modify: `apps/sva-studio-react/src/hooks/use-unified-content-list.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-content-list-mainserver.ts`
- Modify: `apps/sva-studio-react/src/hooks/use-unified-content-list.test.tsx`
- Modify: `docs/superpowers/specs/2026-07-05-generic-item-plugin-pattern-design.md`
- Create or Modify: `docs/guides/generic-item-plugin.md`

- [ ] **Step 1: Write the failing unified list test**

```ts
it('includes Generic Items in the mixed content list', async () => {
  const { result } = renderHook(() =>
    useUnifiedContentList(baseQuery, ['generic-items.generic-item'], 'de-test', ['generic-items.read']),
  );

  await waitFor(() => expect(result.current.contents[0]?.contentType).toBe('generic-items.generic-item'));
});
```

- [ ] **Step 2: Run the failing unified list test**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/hooks/use-unified-content-list.test.tsx`

Expected: FAIL because the Generic Item mapper path is not registered.

- [ ] **Step 3: Register Generic Items in list aggregation and document the editorial contract**

```ts
const studioContentTypeIds = [
  'news.article',
  'events.event-record',
  'poi.point-of-interest',
  'surveys.survey',
  'generic-items.generic-item',
] as const;
```

```ts
export const mapGenericItem = (
  item: MainserverGenericItem,
  instanceId: string,
  permissions: readonly PermissionView[],
): IamContentListItem => ({
  id: item.id,
  instanceId,
  contentType: item.contentType,
  title: normalizeTitle(item.title, item.id),
  createdAt: item.createdAt,
  createdBy: item.author || 'mainserver',
  updatedAt: item.updatedAt,
  updatedBy: item.author || 'mainserver',
  authorDisplayMode: 'organization',
  author: item.author || 'mainserver',
  payload: toContentJsonValue(item.payload),
  status: item.visible === false ? 'draft' : 'published',
  validationState: 'valid',
  historyRef: `mainserver:generic-items:${item.id}`,
  access: createMainserverItemAccess(item.contentType, permissions),
});
```

- [ ] **Step 4: Run the smallest relevant gates**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=src/hooks/use-unified-content-list.test.tsx`

Run: `pnpm nx run plugin-generic-items:test:unit`

Run: `pnpm nx run sva-mainserver:test:unit --testFiles=src/server/generic-items-route.test.ts`

Run: `pnpm nx run-many --target=test:types --projects=plugin-generic-items,sva-mainserver,sva-studio-react`

Expected: PASS

- [ ] **Step 5: Run the final broader gate for this change**

Run: `pnpm test:pr`

Expected: PASS if the local scope is tractable; if the branch scope is too broad, document the skipped breadth and run the smallest still-relevant substitutes:

```bash
pnpm nx run plugin-generic-items:test:unit
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/generic-items-route.test.ts
pnpm nx run sva-studio-react:test:unit --testFiles=src/hooks/use-unified-content-list.test.tsx --testFiles=src/routing/app-route-bindings.test.tsx
pnpm nx run-many --target=test:types --projects=plugin-generic-items,sva-mainserver,sva-studio-react
```

- [ ] **Step 6: Commit the final integration slice**

```bash
git add apps/sva-studio-react/src/hooks/use-unified-content-list.ts \
  apps/sva-studio-react/src/lib/iam-content-list-mainserver.ts \
  apps/sva-studio-react/src/hooks/use-unified-content-list.test.tsx \
  docs/superpowers/specs/2026-07-05-generic-item-plugin-pattern-design.md \
  docs/guides/generic-item-plugin.md
git commit -m "feat: integrate generic items into studio content flows"
```

## Self-Review

- Spec coverage: covered for the open first plugin, free `genericType`, free `payload`, broad field coverage, small legacy path, host route, plugin contract, and content-list integration.
- Spec coverage: covered for the open first plugin, free `genericType`, free `payload`, broad field coverage, small legacy path, host route, plugin contract, content-list integration, and the explicit UI alignment with `POI`/`Events`.
- Spec coverage: covered for the open first plugin, free `genericType`, free `payload`, broad field coverage, small legacy path, host route, plugin contract, content-list integration, the explicit UI alignment with `POI`/`Events`, and the Iteration-1 must-vs-optional field grouping inside `Inhalt`.
- Spec coverage: covered for the open first plugin, free `genericType`, free `payload`, broad field coverage, small legacy path, host route, plugin contract, content-list integration, the explicit UI alignment with `POI`/`Events`, the Iteration-1 must-vs-optional field grouping inside `Inhalt`, and the edit-vs-read-only boundary inside `Einstellungen`.
- Spec coverage: covered for the open first plugin, free `genericType`, free `payload`, broad field coverage, postponed legacy handling, host route, plugin contract, content-list integration, the explicit UI alignment with `POI`/`Events`, the Iteration-1 must-vs-optional field grouping inside `Inhalt`, the edit-vs-read-only boundary inside `Einstellungen`, and the minimal required-field policy in `Basis`.
- Placeholder scan: no `TODO`/`TBD`; every task includes paths, commands, and target code shape.
- Type consistency: the plan consistently uses `genericType` for the upstream field, `generic-items.generic-item` for the Studio content type, and `@sva/plugin-generic-items` for the new package.
