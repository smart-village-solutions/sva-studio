# News Editor Redaktionelle Vereinfachung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die News-Bearbeitung wird auf einen redaktionell vereinfachten, card-basierten Editor mit globalem Speichern, echtem Entwurfsmodus über `changeVisibility` und einer draft-fähigen Studio-Liste umgestellt.

**Architecture:** Der lokale SVA-Mainserver-Adapter bekommt einen getrennten Visibility-Pfad für News sowie einen Studio-Lesemodus, der unsichtbare Datensätze einschließen kann. Das News-Plugin kapselt die neue redaktionelle Form in einem eigenen Editor-Mapping, speichert immer den Gesamtzustand und leitet Veröffentlichung, Push und Sichtbarkeit aus genau einem Save-Plan ab.

**Tech Stack:** TypeScript strict mode, React, TanStack Router, React Hook Form, Zod, Vitest, Nx, bestehende `@sva/plugin-sdk`-CRUD-Clients, bestehende SVA-Mainserver-GraphQL-Integration

---

## File Structure

**Create:**
- `packages/plugin-news/src/news.detail-card.tsx`
- `packages/plugin-news/src/news.editor-model.ts`
- `packages/plugin-news/tests/news.detail-page.test.tsx`
- `packages/plugin-news/tests/news.editor-model.test.ts`
- `packages/sva-mainserver/src/generated/news-visibility.ts`
- `packages/sva-mainserver/src/server/service-internals/news-visibility-operations.ts`

**Delete:**
- `packages/plugin-news/src/news.detail-release-tab.tsx`

**Modify:**
- `apps/sva-studio-react/e2e/news-plugin.spec.ts`
- `apps/sva-studio-react/src/routing/app-route-bindings.test.tsx`
- `apps/sva-studio-react/src/routing/app-route-bindings.tsx`
- `docs/architecture/05-building-block-view.md`
- `docs/architecture/06-runtime-view.md`
- `packages/plugin-news/src/index.ts`
- `packages/plugin-news/src/news.api.ts`
- `packages/plugin-news/src/news.detail-basis-tab.tsx`
- `packages/plugin-news/src/news.detail-content-tab.tsx`
- `packages/plugin-news/src/news.detail-form.ts`
- `packages/plugin-news/src/news.detail-history-tab.tsx`
- `packages/plugin-news/src/news.detail-page.tsx`
- `packages/plugin-news/src/news.detail-settings-tab.tsx`
- `packages/plugin-news/src/news.detail-tabs.tsx`
- `packages/plugin-news/src/news.pages.tsx`
- `packages/plugin-news/src/news.types.ts`
- `packages/plugin-news/src/plugin.translations.ts`
- `packages/plugin-news/tests/news.api.test.ts`
- `packages/plugin-news/tests/news.detail-form.test.ts`
- `packages/plugin-news/tests/news.detail-history-tab.test.tsx`
- `packages/plugin-news/tests/news.pages.test.tsx`
- `packages/plugin-news/tests/plugin.translations.test.ts`
- `packages/sva-mainserver/src/index.server.ts`
- `packages/sva-mainserver/src/server/news-route.test.ts`
- `packages/sva-mainserver/src/server/news-route.ts`
- `packages/sva-mainserver/src/server/service-internals/news-mappers.ts`
- `packages/sva-mainserver/src/server/service-internals/news-operations.ts`
- `packages/sva-mainserver/src/server/service.test.ts`
- `packages/sva-mainserver/src/server/service.ts`
- `packages/sva-mainserver/src/types.ts`

## Constraints And Decisions

- Drafts bleiben ein normaler News-Datensatz mit technischem `publishedAt`; der redaktionelle Zustand `Entwurf` wird ausschließlich über `visible=false` modelliert.
- Für Visibility wird im Studio ein eigener HTTP-Pfad über die lokale News-Route eingeführt: `PATCH /api/v1/mainserver/news/:id/visibility`.
- Der GraphQL-Record-Typ ist fest auf `NewsItem` verdrahtet; der Client darf diesen Wert nicht frei senden.
- Bestehende Legacy-Felder außerhalb der vereinfachten Oberfläche bleiben bei Updates erhalten und werden aus dem geladenen Datensatz zurückgespiegelt.
- Die Studio-Liste lädt Drafts explizit mit; öffentliche oder sichtbarkeitsorientierte Listen filtern unsichtbare News weiterhin heraus.

### Task 1: Add News Visibility Mutation Support To The Local Mainserver Adapter

**Files:**
- Create: `packages/sva-mainserver/src/generated/news-visibility.ts`
- Create: `packages/sva-mainserver/src/server/service-internals/news-visibility-operations.ts`
- Modify: `packages/sva-mainserver/src/types.ts`
- Modify: `packages/sva-mainserver/src/server/service.ts`
- Modify: `packages/sva-mainserver/src/server/news-route.ts`
- Modify: `packages/sva-mainserver/src/server/service-internals/news-operations.ts`
- Modify: `packages/sva-mainserver/src/index.server.ts`
- Test: `packages/sva-mainserver/src/server/service.test.ts`
- Test: `packages/sva-mainserver/src/server/news-route.test.ts`

- [ ] **Step 1: Write the failing adapter and route tests**

```ts
// packages/sva-mainserver/src/server/service.test.ts
it('keeps invisible upstream news in studio mode', async () => {
  const service = createSvaMainserverService({ fetchImpl: fetchMock as typeof fetch });

  await expect(
    service.listNews({
      instanceId: 'instance-1',
      keycloakSubject: 'user-1',
      page: 1,
      pageSize: 25,
      includeInvisible: true,
    })
  ).resolves.toMatchObject({
    data: expect.arrayContaining([
      expect.objectContaining({ id: 'news-visible', visible: true }),
      expect.objectContaining({ id: 'news-draft', visible: false }),
    ]),
  });
});

it('calls changeVisibility with recordType NewsItem', async () => {
  const service = createSvaMainserverService({ fetchImpl: fetchMock as typeof fetch });

  await service.changeNewsVisibility({
    instanceId: 'instance-1',
    keycloakSubject: 'user-1',
    newsId: 'news-1',
    visible: false,
  });

  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"recordType":"NewsItem"'),
    })
  );
});

// packages/sva-mainserver/src/server/news-route.test.ts
it('handles PATCH /api/v1/mainserver/news/:id/visibility', async () => {
  const request = new Request('https://studio.test/api/v1/mainserver/news/news-1/visibility', {
    method: 'PATCH',
    body: JSON.stringify({ visible: false }),
    headers: { 'content-type': 'application/json' },
  });

  await dispatchSvaMainserverNewsRequest(request);

  expect(changeSvaMainserverNewsVisibility).toHaveBeenCalledWith(
    expect.objectContaining({ newsId: 'news-1', visible: false })
  );
});
```

- [ ] **Step 2: Run the focused adapter tests and confirm they fail**

Run:

```bash
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service.test.ts --testFiles=src/server/news-route.test.ts
```

Expected:

```text
FAIL  packages/sva-mainserver/src/server/service.test.ts > keeps invisible upstream news in studio mode
FAIL  packages/sva-mainserver/src/server/service.test.ts > calls changeVisibility with recordType NewsItem
FAIL  packages/sva-mainserver/src/server/news-route.test.ts > handles PATCH /api/v1/mainserver/news/:id/visibility
```

- [ ] **Step 3: Add the GraphQL visibility document, service contract, and studio list flag**

```ts
// packages/sva-mainserver/src/types.ts
export type SvaMainserverListQuery = {
  readonly page: number;
  readonly pageSize: number;
  readonly includeInvisible?: boolean;
};

// packages/sva-mainserver/src/generated/news-visibility.ts
export const svaMainserverChangeNewsVisibilityDocument = /* GraphQL */ `
  mutation SvaMainserverChangeNewsVisibility($id: ID!, $recordType: String!, $visible: Boolean!) {
    changeVisibility(id: $id, recordType: $recordType, visible: $visible) {
      statusCode
      success
      message
    }
  }
`;

// packages/sva-mainserver/src/server/service-internals/news-visibility-operations.ts
export const createNewsVisibilityOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  changeNewsVisibilityWithConfig: async (
    input: SvaMainserverConnectionInput & { readonly newsId: string; readonly visible: boolean },
    config: SvaMainserverInstanceConfig
  ) =>
    executeGraphqlWithConfig(
      {
        ...input,
        document: svaMainserverChangeNewsVisibilityDocument,
        operationName: 'SvaMainserverChangeNewsVisibility',
        variables: { id: input.newsId, recordType: 'NewsItem', visible: input.visible },
      },
      config
    ),
});

// packages/sva-mainserver/src/server/service-internals/news-operations.ts
const includeInvisible = input.includeInvisible === true;

return listVisibleRecordsWithConfig({
  input,
  config,
  loadPage,
  isVisible: includeInvisible ? () => true : (item) => item.visible !== false,
});
```

- [ ] **Step 4: Wire the new service method and HTTP route**

```ts
// packages/sva-mainserver/src/server/service.ts
const newsVisibilityOperations = createNewsVisibilityOperations(executeGraphqlWithConfig);

const changeNewsVisibility = async (
  input: SvaMainserverConnectionInput & { readonly newsId: string; readonly visible: boolean }
) => {
  const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
  await newsVisibilityOperations.changeNewsVisibilityWithConfig(input, config);
};

export const changeSvaMainserverNewsVisibility = (
  input: SvaMainserverConnectionInput & { readonly newsId: string; readonly visible: boolean }
) => getDefaultService().changeNewsVisibility(input);

// packages/sva-mainserver/src/server/news-route.ts
type RouteMatch =
  | { readonly kind: 'collection' }
  | { readonly kind: 'categories' }
  | { readonly kind: 'item'; readonly newsId: string }
  | { readonly kind: 'itemVisibility'; readonly newsId: string };

if (pathname.endsWith('/visibility') && pathname.startsWith(NEWS_ITEM_PATH_PREFIX)) {
  return { kind: 'itemVisibility', newsId: decodeURIComponent(pathname.slice(NEWS_ITEM_PATH_PREFIX.length, -'/visibility'.length)) };
}

const includeInvisible = new URL(request.url).searchParams.get('includeInvisible') === 'true';

return listSvaMainserverNews({ ...actor, ...parseMainserverListQuery(request), includeInvisible });
```

- [ ] **Step 5: Re-run the adapter slice and the runtime/type checks**

Run:

```bash
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service.test.ts --testFiles=src/server/news-route.test.ts
pnpm nx run sva-mainserver:test:types
pnpm nx run sva-mainserver:check:runtime
```

Expected:

```text
PASS  packages/sva-mainserver/src/server/service.test.ts
PASS  packages/sva-mainserver/src/server/news-route.test.ts
PASS  sva-mainserver:test:types
PASS  sva-mainserver:check:runtime
```

- [ ] **Step 6: Commit the adapter foundation**

```bash
git add packages/sva-mainserver/src/types.ts packages/sva-mainserver/src/generated/news-visibility.ts packages/sva-mainserver/src/server/service-internals/news-visibility-operations.ts packages/sva-mainserver/src/server/service-internals/news-operations.ts packages/sva-mainserver/src/server/service.ts packages/sva-mainserver/src/server/news-route.ts packages/sva-mainserver/src/server/service.test.ts packages/sva-mainserver/src/server/news-route.test.ts packages/sva-mainserver/src/index.server.ts
git commit -m "feat: add news visibility support to mainserver adapter"
```

### Task 2: Introduce The Simplified Editorial Form Model

**Files:**
- Create: `packages/plugin-news/src/news.editor-model.ts`
- Create: `packages/plugin-news/tests/news.editor-model.test.ts`
- Modify: `packages/plugin-news/src/news.types.ts`
- Modify: `packages/plugin-news/src/news.detail-form.ts`
- Modify: `packages/plugin-news/tests/news.detail-form.test.ts`

- [ ] **Step 1: Write the failing editor-model and form tests**

```ts
// packages/plugin-news/tests/news.editor-model.test.ts
it('falls back to the first content block headline when the explicit title is empty', () => {
  expect(
    createNewsEditorFormValues({
      ...newsItemFixture,
      title: '',
      contentBlocks: [{ title: 'Block Headline', intro: 'Teaser', body: '<p>Body</p>', mediaContents: [] }],
    }).title
  ).toBe('Block Headline');
});

it('derives draft, scheduled, and published from visible and publishedAt', () => {
  expect(deriveNewsEditorialStatus({ visible: false, publishedAt: '2026-06-09T09:00:00.000Z' }, '2026-06-09T10:00:00.000Z')).toBe('draft');
  expect(deriveNewsEditorialStatus({ visible: true, publishedAt: '2026-06-09T11:00:00.000Z' }, '2026-06-09T10:00:00.000Z')).toBe('scheduled');
  expect(deriveNewsEditorialStatus({ visible: true, publishedAt: '2026-06-09T09:00:00.000Z' }, '2026-06-09T10:00:00.000Z')).toBe('published');
});

it('preserves hidden legacy fields on update payloads', () => {
  const payload = buildNewsSavePayload(editorValuesFixture, newsItemFixture, '2026-06-09T10:00:00.000Z').mutation;
  expect(payload).toMatchObject({
    externalId: 'legacy-external-id',
    newsType: 'legacy-news-type',
    charactersToBeShown: 240,
    fullVersion: true,
    showPublishDate: false,
    pointOfInterestId: 'poi-7',
  });
});

// packages/plugin-news/tests/news.detail-form.test.ts
it('requires a schedule date only for scheduled publication mode', async () => {
  await expect(newsDetailFormSchema.parseAsync({
    ...createDefaultNewsDetailFormValues(),
    title: 'News title',
    author: 'Redaktion',
    contentTeaser: 'Teaser',
    contentBody: '<p>Body</p>',
    publicationMode: 'scheduled',
    scheduledPublicationAt: '',
  })).rejects.toThrow();
});
```

- [ ] **Step 2: Run the focused editor-model tests and confirm they fail**

Run:

```bash
pnpm nx run plugin-news:test:unit --testFiles=tests/news.editor-model.test.ts --testFiles=tests/news.detail-form.test.ts
```

Expected:

```text
FAIL  packages/plugin-news/tests/news.editor-model.test.ts > falls back to the first content block headline when the explicit title is empty
FAIL  packages/plugin-news/tests/news.editor-model.test.ts > derives draft, scheduled, and published from visible and publishedAt
FAIL  packages/plugin-news/tests/news.detail-form.test.ts > requires a schedule date only for scheduled publication mode
```

- [ ] **Step 3: Define the editorial types and payload builder**

```ts
// packages/plugin-news/src/news.types.ts
export type NewsPublicationMode = 'draft' | 'immediate' | 'scheduled';
export type NewsEditorialStatus = 'draft' | 'scheduled' | 'published';

export type NewsDetailFormValues = {
  title: string;
  author: string;
  categories: string[];
  contentTeaser: string;
  contentBody: string;
  contentMedia: NewsMediaContentFormValue[];
  sourceUrl: string;
  sourceUrlDescription: string;
  pushNotificationEnabled: boolean;
  publicationMode: NewsPublicationMode;
  scheduledPublicationAt: string;
};

export type NewsSavePlan = {
  readonly mutation: NewsFormInput;
  readonly visible: boolean;
  readonly editorialStatus: NewsEditorialStatus;
};

// packages/plugin-news/src/news.editor-model.ts
export const deriveNewsEditorialStatus = (
  input: Pick<NewsContentItem, 'visible' | 'publishedAt'>,
  nowIso: string
): NewsEditorialStatus => {
  if (input.visible === false) {
    return 'draft';
  }
  return new Date(input.publishedAt).getTime() > new Date(nowIso).getTime() ? 'scheduled' : 'published';
};

export const createNewsEditorFormValues = (item: NewsContentItem): NewsDetailFormValues => {
  const firstBlock = item.contentBlocks?.[0];
  const editorialStatus = deriveNewsEditorialStatus(item, new Date().toISOString());
  return {
    title: item.title.trim().length > 0 ? item.title : firstBlock?.title ?? '',
    author: item.author,
    categories: item.categories?.map((category) => category.name) ?? [],
    contentTeaser: firstBlock?.intro ?? item.payload.teaser ?? '',
    contentBody: firstBlock?.body ?? item.payload.body ?? '',
    contentMedia:
      firstBlock?.mediaContents?.map((media) => ({
        captionText: media.captionText ?? '',
        copyright: media.copyright ?? '',
        contentType: media.contentType ?? 'image',
        height: media.height !== undefined ? String(media.height) : '',
        width: media.width !== undefined ? String(media.width) : '',
        sourceUrl: {
          url: media.sourceUrl?.url ?? '',
          description: media.sourceUrl?.description ?? '',
        },
      })) ?? [],
    sourceUrl: item.sourceUrl?.url ?? '',
    sourceUrlDescription: item.sourceUrl?.description ?? '',
    pushNotificationEnabled: false,
    publicationMode: editorialStatus === 'draft' ? 'draft' : editorialStatus === 'scheduled' ? 'scheduled' : 'immediate',
    scheduledPublicationAt: editorialStatus === 'scheduled' ? item.publishedAt : '',
  };
};

export const buildNewsSavePayload = (
  values: NewsDetailFormValues,
  existingItem: NewsContentItem | null,
  nowIso: string
): NewsSavePlan => {
  const publishedAt =
    values.publicationMode === 'scheduled'
      ? values.scheduledPublicationAt
      : nowIso;
  const visible = values.publicationMode !== 'draft';

  return {
    visible,
    editorialStatus: deriveNewsEditorialStatus({ visible, publishedAt }, nowIso),
    mutation: {
      externalId: existingItem?.externalId,
      fullVersion: existingItem?.fullVersion,
      charactersToBeShown:
        existingItem?.charactersToBeShown !== undefined ? Number(existingItem.charactersToBeShown) : undefined,
      newsType: existingItem?.newsType,
      showPublishDate: existingItem?.showPublishDate,
      pointOfInterestId: existingItem?.pointOfInterestId,
      title: values.title,
      author: values.author,
      categories: values.categories.map((name) => ({ name })),
      publishedAt: values.publicationMode === 'draft' ? nowIso : publishedAt,
      publicationDate: values.publicationMode === 'draft' ? nowIso : publishedAt,
      sourceUrl: {
        url: values.sourceUrl,
        description: values.sourceUrlDescription,
      },
      contentBlocks: [
        {
          title: values.title,
          intro: values.contentTeaser,
          body: values.contentBody,
          mediaContents: values.contentMedia,
        },
      ],
      ...(existingItem?.pushNotificationsSentAt ? {} : { pushNotification: values.pushNotificationEnabled }),
    },
  };
};
```

- [ ] **Step 4: Replace the old form schema with the simplified redactional one**

```ts
// packages/plugin-news/src/news.detail-form.ts
export const newsDetailFormSchema = z.object({
  title: z.string().trim().min(1, 'title'),
  author: z.string().trim().min(1, 'author'),
  categories: z.array(z.string().trim().min(1, 'categories')),
  contentTeaser: z.string(),
  contentBody: z.string().trim().min(1, 'contentBody'),
  contentMedia: z.array(mediaContentSchema),
  sourceUrl: z.string(),
  sourceUrlDescription: z.string(),
  pushNotificationEnabled: z.boolean(),
  publicationMode: z.enum(['draft', 'immediate', 'scheduled']),
  scheduledPublicationAt: z.string(),
}).superRefine((values, ctx) => {
  if (values.sourceUrl.length > 0 && isHttpsUrl(values.sourceUrl) === false) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceUrl'], message: 'sourceUrl' });
  }

  if (values.publicationMode === 'scheduled' && isValidDateString(values.scheduledPublicationAt) === false) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scheduledPublicationAt'], message: 'scheduledPublicationAt' });
  }

  if (getVisibleTextLength(values.contentBody) === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['contentBody'], message: 'contentBody' });
  }
});

export const createDefaultNewsDetailFormValues = (author = ''): NewsDetailFormValues => ({
  title: '',
  author,
  categories: [],
  contentTeaser: '',
  contentBody: '',
  contentMedia: [],
  sourceUrl: '',
  sourceUrlDescription: '',
  pushNotificationEnabled: false,
  publicationMode: 'draft',
  scheduledPublicationAt: '',
});
```

- [ ] **Step 5: Re-run the plugin-news unit and type checks**

Run:

```bash
pnpm nx run plugin-news:test:unit --testFiles=tests/news.editor-model.test.ts --testFiles=tests/news.detail-form.test.ts
pnpm nx run plugin-news:test:types
```

Expected:

```text
PASS  packages/plugin-news/tests/news.editor-model.test.ts
PASS  packages/plugin-news/tests/news.detail-form.test.ts
PASS  plugin-news:test:types
```

- [ ] **Step 6: Commit the editor model slice**

```bash
git add packages/plugin-news/src/news.types.ts packages/plugin-news/src/news.editor-model.ts packages/plugin-news/src/news.detail-form.ts packages/plugin-news/tests/news.editor-model.test.ts packages/plugin-news/tests/news.detail-form.test.ts
git commit -m "feat: add simplified news editor model"
```

### Task 3: Wire Author Context And One Global Save Flow

**Files:**
- Modify: `apps/sva-studio-react/src/routing/app-route-bindings.tsx`
- Modify: `apps/sva-studio-react/src/routing/app-route-bindings.test.tsx`
- Modify: `packages/plugin-news/src/news.api.ts`
- Modify: `packages/plugin-news/src/news.detail-page.tsx`
- Modify: `packages/plugin-news/src/news.types.ts`
- Modify: `packages/plugin-news/src/index.ts`
- Modify: `packages/plugin-news/tests/news.api.test.ts`
- Create: `packages/plugin-news/tests/news.detail-page.test.tsx`

- [ ] **Step 1: Write the failing author-context and save-flow tests**

```ts
// apps/sva-studio-react/src/routing/app-route-bindings.test.tsx
it('offers organization or personal author choice when contentAuthorPolicy is org_or_personal', async () => {
  render(<NewsCreateRoutePage />);

  await expect(screen.findByLabelText('Autor')).resolves.toHaveValue('Organisation Musterstadt');
  expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
    'Organisation Musterstadt',
    'Max Mustermann',
  ]);
});

// packages/plugin-news/tests/news.api.test.ts
it('creates a draft with a second visibility request', async () => {
  await saveNewsEditorItem({ values: { ...editorValuesFixture, publicationMode: 'draft' } });

  expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/mainserver/news', expect.objectContaining({ method: 'POST' }));
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    '/api/v1/mainserver/news/news-1/visibility',
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ visible: false }) })
  );
});

// packages/plugin-news/tests/news.detail-page.test.tsx
it('renders exactly one save button in the page header', () => {
  render(<NewsDetailPage mode="create" initialAuthor="Redaktion" />);
  expect(screen.getAllByRole('button', { name: 'Speichern' })).toHaveLength(1);
});
```

- [ ] **Step 2: Run the focused route, API, and page tests and confirm they fail**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/routing/app-route-bindings.test.tsx
pnpm nx run plugin-news:test:unit --testFiles=tests/news.api.test.ts --testFiles=tests/news.detail-page.test.tsx
```

Expected:

```text
FAIL  apps/sva-studio-react/src/routing/app-route-bindings.test.tsx > offers organization or personal author choice when contentAuthorPolicy is org_or_personal
FAIL  packages/plugin-news/tests/news.api.test.ts > creates a draft with a second visibility request
FAIL  packages/plugin-news/tests/news.detail-page.test.tsx > renders exactly one save button in the page header
```

- [ ] **Step 3: Replace the single initial-author string with an author control model**

```ts
// packages/plugin-news/src/news.types.ts
export type NewsAuthorControl =
  | { readonly kind: 'fixed'; readonly value: string }
  | {
      readonly kind: 'selectable';
      readonly value: string;
      readonly options: readonly { readonly value: string; readonly label: string }[];
    };

// apps/sva-studio-react/src/routing/app-route-bindings.tsx
const resolveNewsAuthorControl = (input: {
  readonly organizations: readonly IamOrganizationContextOption[];
  readonly organizationDetails: ReadonlyMap<string, IamOrganizationDetail>;
  readonly userDisplayName?: string;
}): NewsAuthorControl => {
  const activeOrganization = input.organizations.find((organization) => organization.isActive);
  const userDisplayName = input.userDisplayName?.trim() || 'Benutzer';
  const policy = activeOrganization
    ? input.organizationDetails.get(activeOrganization.organizationId)?.contentAuthorPolicy
    : undefined;

  if (policy === 'org_only' && activeOrganization?.displayName.trim()) {
    return { kind: 'fixed', value: activeOrganization.displayName.trim() };
  }

  if (policy === 'org_or_personal' && activeOrganization?.displayName.trim()) {
    return {
      kind: 'selectable',
      value: activeOrganization.displayName.trim(),
      options: [
        { value: activeOrganization.displayName.trim(), label: activeOrganization.displayName.trim() },
        { value: userDisplayName, label: userDisplayName },
      ],
    };
  }

  return { kind: 'fixed', value: userDisplayName };
};

return <NewsCreatePage authorControl={authorControl} />;
```

- [ ] **Step 4: Implement the single save orchestration in the page and API client**

```ts
// packages/plugin-news/src/news.api.ts
export const setNewsVisibility = async (contentId: string, visible: boolean): Promise<void> => {
  await requestMainserverJson<{ readonly status: string }, NewsApiError>({
    url: `/api/v1/mainserver/news/${encodeURIComponent(contentId)}/visibility`,
    method: 'PATCH',
    body: JSON.stringify({ visible }),
    headers: createMainserverJsonRequestHeaders(),
    errorFactory: (code, message) => new NewsApiError(code, message),
  });
};

export const saveNewsEditorItem = async (input: {
  readonly contentId?: string;
  readonly values: NewsDetailFormValues;
  readonly existingItem?: NewsContentItem | null;
  readonly now?: () => string;
}): Promise<NewsContentItem> => {
  const nowIso = input.now?.() ?? new Date().toISOString();
  const plan = buildNewsSavePayload(input.values, input.existingItem ?? null, nowIso);
  const saved = input.contentId
    ? await updateNews(input.contentId, plan.mutation)
    : await createNews(plan.mutation);

  await setNewsVisibility(saved.id, plan.visible);
  return getNews(saved.id);
};

// packages/plugin-news/src/news.detail-page.tsx
const onSubmit = form.handleSubmit(async (values) => {
  const saved = await saveNewsEditorItem({ contentId, values, existingItem: item ?? null });
  navigateToSavedItem(saved.id);
});

<StudioOverviewPageTemplate
  title={pageTitle}
  primaryAction={<Button type="submit" form={formId}>{pt('actions.save')}</Button>}
>
```

- [ ] **Step 5: Re-run the author/save slice and type checks**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/routing/app-route-bindings.test.tsx
pnpm nx run plugin-news:test:unit --testFiles=tests/news.api.test.ts --testFiles=tests/news.detail-page.test.tsx
pnpm nx run plugin-news:test:types
pnpm nx run sva-studio-react:test:types
```

Expected:

```text
PASS  apps/sva-studio-react/src/routing/app-route-bindings.test.tsx
PASS  packages/plugin-news/tests/news.api.test.ts
PASS  packages/plugin-news/tests/news.detail-page.test.tsx
PASS  plugin-news:test:types
PASS  sva-studio-react:test:types
```

- [ ] **Step 6: Commit the author/save orchestration**

```bash
git add apps/sva-studio-react/src/routing/app-route-bindings.tsx apps/sva-studio-react/src/routing/app-route-bindings.test.tsx packages/plugin-news/src/news.api.ts packages/plugin-news/src/news.detail-page.tsx packages/plugin-news/src/news.types.ts packages/plugin-news/src/index.ts packages/plugin-news/tests/news.api.test.ts packages/plugin-news/tests/news.detail-page.test.tsx
git commit -m "feat: wire global save flow for news editor"
```

### Task 4: Rebuild The Tabs Into Card-Based Editorial Panels

**Files:**
- Create: `packages/plugin-news/src/news.detail-card.tsx`
- Modify: `packages/plugin-news/src/news.detail-basis-tab.tsx`
- Modify: `packages/plugin-news/src/news.detail-content-tab.tsx`
- Modify: `packages/plugin-news/src/news.detail-history-tab.tsx`
- Modify: `packages/plugin-news/src/news.detail-settings-tab.tsx`
- Modify: `packages/plugin-news/src/news.detail-tabs.tsx`
- Modify: `packages/plugin-news/src/plugin.translations.ts`
- Modify: `packages/plugin-news/tests/news.detail-history-tab.test.tsx`
- Modify: `packages/plugin-news/tests/plugin.translations.test.ts`
- Delete: `packages/plugin-news/src/news.detail-release-tab.tsx`
- Test: `packages/plugin-news/tests/news.detail-page.test.tsx`

- [ ] **Step 1: Write the failing UI-structure and translation tests**

```ts
// packages/plugin-news/tests/news.detail-page.test.tsx
it('renders the tabs basis, content, settings, and history only', () => {
  render(<NewsDetailPage mode="edit" item={newsItemFixture} authorControl={{ kind: 'fixed', value: 'Redaktion' }} />);
  expect(screen.queryByRole('tab', { name: 'Veröffentlichung' })).not.toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Basis' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Inhalte' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Einstellungen' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Historie' })).toBeInTheDocument();
});

it('shows the publication mode radios and only reveals the schedule field when scheduled is selected', async () => {
  render(<NewsDetailPage mode="create" authorControl={{ kind: 'fixed', value: 'Redaktion' }} />);
  await user.click(screen.getByRole('tab', { name: 'Einstellungen' }));
  expect(screen.getByLabelText('Entwurfsmodus')).toBeChecked();
  expect(screen.queryByLabelText('Veröffentlichungszeitpunkt')).not.toBeInTheDocument();
});

// packages/plugin-news/tests/news.detail-history-tab.test.tsx
it('shows a history empty state when there are no entries', () => {
  render(<NewsDetailHistoryTab entries={[]} />);
  expect(screen.getByText('Noch keine Historie vorhanden.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused component and translation tests and confirm they fail**

Run:

```bash
pnpm nx run plugin-news:test:unit --testFiles=tests/news.detail-page.test.tsx --testFiles=tests/news.detail-history-tab.test.tsx --testFiles=tests/plugin.translations.test.ts
```

Expected:

```text
FAIL  packages/plugin-news/tests/news.detail-page.test.tsx > renders the tabs basis, content, settings, and history only
FAIL  packages/plugin-news/tests/news.detail-page.test.tsx > shows the publication mode radios and only reveals the schedule field when scheduled is selected
FAIL  packages/plugin-news/tests/news.detail-history-tab.test.tsx > shows a history empty state when there are no entries
```

- [ ] **Step 3: Add the reusable card shell and rebuild the tabs around editorial tasks**

```tsx
// packages/plugin-news/src/news.detail-card.tsx
export const NewsDetailCard = ({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
}) => (
  <section className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm">
    <header className="mb-4 space-y-1">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </header>
    <div className="space-y-4">{children}</div>
  </section>
);

// packages/plugin-news/src/news.detail-tabs.tsx
export type NewsDetailTabId = 'basis' | 'content' | 'settings' | 'history';

export const NEWS_DETAIL_TABS: readonly NewsDetailTabId[] = ['basis', 'content', 'settings', 'history'];

// packages/plugin-news/src/news.detail-settings-tab.tsx
<NewsDetailCard title={pt('cards.push.title')} description={pt('cards.push.description')}>
  {item?.pushNotificationsSentAt ? (
    <p>{formatDate(item.pushNotificationsSentAt) ?? '--.--.-- --:--'}</p>
  ) : (
    <SwitchField name="pushNotificationEnabled" label={pt('fields.pushNotificationEnabled')} />
  )}
</NewsDetailCard>

<NewsDetailCard title={pt('cards.publication.title')} description={pt('cards.publication.description')}>
  <RadioGroupField name="publicationMode" options={[
    { value: 'draft', label: pt('publicationModes.draft') },
    { value: 'immediate', label: pt('publicationModes.immediate') },
    { value: 'scheduled', label: pt('publicationModes.scheduled') },
  ]} />
  {watchPublicationMode === 'scheduled' ? (
    <DateTimeField name="scheduledPublicationAt" label={pt('fields.scheduledPublicationAt')} />
  ) : null}
</NewsDetailCard>
```

- [ ] **Step 4: Update the Basis-, Inhalte-, and Historie-tabs plus the translations**

```tsx
// packages/plugin-news/src/news.detail-basis-tab.tsx
<NewsDetailCard title={pt('cards.titleCategories.title')} description={pt('cards.titleCategories.description')}>
  <InputField name="title" label={pt('fields.title')} />
  <CategoryRepeaterField name="categories" addLabel={pt('actions.addCategory')} />
</NewsDetailCard>

<NewsDetailCard title={pt('cards.authorMeta.title')} description={pt('cards.authorMeta.description')}>
  {authorControl.kind === 'selectable' ? (
    <SelectField name="author" label={pt('fields.author')} options={authorControl.options} />
  ) : (
    <ReadOnlyField label={pt('fields.author')} value={authorControl.value} />
  )}
  <MetadataGrid values={{
    createdAt: item?.createdAt ?? '--.--.-- --:--',
    publishedAt: item?.publishedAt ?? '--.--.-- --:--',
    updatedAt: item?.updatedAt ?? '--.--.-- --:--',
  }} />
</NewsDetailCard>

// packages/plugin-news/src/news.detail-content-tab.tsx
<NewsDetailCard title={pt('cards.content.title')} description={pt('cards.content.description')}>
  <ReadOnlyField label={pt('fields.headline')} value={form.watch('title')} />
  <TextareaField name="contentTeaser" label={pt('fields.contentTeaser')} />
  <RichTextEditorField name="contentBody" label={pt('fields.contentBody')} />
</NewsDetailCard>

<NewsDetailCard title={pt('cards.media.title')} description={pt('cards.media.description')}>
  <MediaRepeaterField name="contentMedia" />
</NewsDetailCard>

<NewsDetailCard title={pt('cards.history.title')} description={pt('cards.history.description')}>
  <StudioDataTable
    columns={historyColumns}
    data={entries}
    emptyState={<StudioEmptyState>{pt('history.empty')}</StudioEmptyState>}
  />
</NewsDetailCard>
```

- [ ] **Step 5: Re-run the UI slice, translations, and i18n check**

Run:

```bash
pnpm nx run plugin-news:test:unit --testFiles=tests/news.detail-page.test.tsx --testFiles=tests/news.detail-history-tab.test.tsx --testFiles=tests/plugin.translations.test.ts
pnpm nx run sva-studio-react:check:i18n
pnpm nx run plugin-news:test:types
```

Expected:

```text
PASS  packages/plugin-news/tests/news.detail-page.test.tsx
PASS  packages/plugin-news/tests/news.detail-history-tab.test.tsx
PASS  packages/plugin-news/tests/plugin.translations.test.ts
PASS  sva-studio-react:check:i18n
PASS  plugin-news:test:types
```

- [ ] **Step 6: Commit the UI rebuild**

```bash
git add packages/plugin-news/src/news.detail-card.tsx packages/plugin-news/src/news.detail-basis-tab.tsx packages/plugin-news/src/news.detail-content-tab.tsx packages/plugin-news/src/news.detail-history-tab.tsx packages/plugin-news/src/news.detail-settings-tab.tsx packages/plugin-news/src/news.detail-tabs.tsx packages/plugin-news/src/plugin.translations.ts packages/plugin-news/tests/news.detail-page.test.tsx packages/plugin-news/tests/news.detail-history-tab.test.tsx packages/plugin-news/tests/plugin.translations.test.ts
git rm packages/plugin-news/src/news.detail-release-tab.tsx
git commit -m "feat: rebuild news editor tabs as editorial cards"
```

### Task 5: Update The Studio List, Filters, E2E Flow, And Architecture Docs

**Files:**
- Modify: `packages/plugin-news/src/news.api.ts`
- Modify: `packages/plugin-news/src/news.pages.tsx`
- Modify: `packages/plugin-news/src/news.types.ts`
- Modify: `packages/plugin-news/tests/news.pages.test.tsx`
- Modify: `packages/sva-mainserver/src/types.ts`
- Modify: `packages/sva-mainserver/src/server/news-route.ts`
- Modify: `packages/sva-mainserver/src/server/service-internals/news-operations.ts`
- Modify: `packages/sva-mainserver/src/server/service.test.ts`
- Modify: `apps/sva-studio-react/e2e/news-plugin.spec.ts`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`

- [ ] **Step 1: Write the failing list-page, adapter-filter, and E2E tests**

```ts
// packages/plugin-news/tests/news.pages.test.tsx
it('loads the studio list with drafts included and shows the editorial status badge', async () => {
  render(<NewsListPage />);
  await waitFor(() =>
    expect(listNews).toHaveBeenCalledWith({
      page: 1,
      pageSize: 25,
      includeInvisible: true,
      visibilityFilter: 'all',
      editorialStatusFilter: 'all',
    })
  );
  expect(screen.getByText('Entwurf')).toBeInTheDocument();
});

it('toggles visibility directly from the list row', async () => {
  render(<NewsListPage />);
  await user.click(await screen.findByRole('switch', { name: 'Sichtbar' }));
  expect(setNewsVisibility).toHaveBeenCalledWith('news-1', false);
});

// packages/sva-mainserver/src/server/service.test.ts
it('filters studio news by editorial status after including invisible items', async () => {
  await expect(
    service.listNews({
      instanceId: 'instance-1',
      keycloakSubject: 'user-1',
      page: 1,
      pageSize: 25,
      includeInvisible: true,
      visibilityFilter: 'all',
      editorialStatusFilter: 'draft',
    })
  ).resolves.toMatchObject({
    data: [expect.objectContaining({ id: 'news-draft', visible: false })],
  });
});
```

```ts
// apps/sva-studio-react/e2e/news-plugin.spec.ts
test('draft, publish, schedule, and push-once flow', async ({ page }) => {
  await page.goto('/admin/news/new');
  await page.getByLabel('Titel').fill('Wichtige Nachricht');
  await page.getByLabel('Teaser').fill('Kurzfassung');
  await page.getByRole('tab', { name: 'Einstellungen' }).click();
  await page.getByLabel('Entwurfsmodus').check();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Entwurf')).toBeVisible();
});
```

- [ ] **Step 2: Run the focused list and adapter tests and confirm they fail**

Run:

```bash
pnpm nx run plugin-news:test:unit --testFiles=tests/news.pages.test.tsx
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service.test.ts --testFiles=src/server/news-route.test.ts
```

Expected:

```text
FAIL  packages/plugin-news/tests/news.pages.test.tsx > loads the studio list with drafts included and shows the editorial status badge
FAIL  packages/plugin-news/tests/news.pages.test.tsx > toggles visibility directly from the list row
FAIL  packages/sva-mainserver/src/server/service.test.ts > filters studio news by editorial status after including invisible items
```

- [ ] **Step 3: Add studio list filters and direct visibility toggles**

```ts
// packages/plugin-news/src/news.types.ts
export type NewsListQuery = {
  readonly page: number;
  readonly pageSize: number;
  readonly includeInvisible?: boolean;
  readonly visibilityFilter?: 'all' | 'visible' | 'hidden';
  readonly editorialStatusFilter?: 'all' | 'draft' | 'scheduled' | 'published';
};

// packages/sva-mainserver/src/types.ts
export type SvaMainserverListQuery = {
  readonly page: number;
  readonly pageSize: number;
  readonly includeInvisible?: boolean;
  readonly visibilityFilter?: 'all' | 'visible' | 'hidden';
  readonly editorialStatusFilter?: 'all' | 'draft' | 'scheduled' | 'published';
};

// packages/sva-mainserver/src/server/service-internals/news-operations.ts
const filteredItems = mappedItems.filter((item) => {
  const matchesVisibility =
    input.visibilityFilter === 'hidden' ? item.visible === false :
    input.visibilityFilter === 'visible' ? item.visible !== false :
    true;

  const status = deriveEditorialStatusForList(item, new Date().toISOString());
  const matchesStatus = input.editorialStatusFilter && input.editorialStatusFilter !== 'all'
    ? status === input.editorialStatusFilter
    : true;

  return matchesVisibility && matchesStatus;
});
```

- [ ] **Step 4: Rebuild the News list UI, E2E journey, and arc42 notes**

```tsx
// packages/plugin-news/src/news.pages.tsx
const query: NewsListQuery = {
  page,
  pageSize,
  includeInvisible: true,
  visibilityFilter,
  editorialStatusFilter,
};

<Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
  <SelectItem value="all">{pt('filters.visibility.all')}</SelectItem>
  <SelectItem value="visible">{pt('filters.visibility.visible')}</SelectItem>
  <SelectItem value="hidden">{pt('filters.visibility.hidden')}</SelectItem>
</Select>

<Badge variant={status === 'draft' ? 'secondary' : status === 'scheduled' ? 'outline' : 'default'}>
  {pt(`statuses.${status}`)}
</Badge>

<Switch
  checked={item.visible !== false}
  aria-label={pt('fields.visible')}
  onCheckedChange={(checked) => void handleVisibilityChange(item.id, checked)}
/>
```

```md
<!-- docs/architecture/05-building-block-view.md -->
- Das News-Plugin besitzt nun ein eigenes redaktionelles Editor-Mapping (`news.editor-model.ts`), das UI-Felder auf `contentBlocks[0]`, Veröffentlichungsmodus und Visibility-Schritt abbildet.

<!-- docs/architecture/06-runtime-view.md -->
- Speichern einer News läuft in zwei technischen Schritten: erst `createNews`/`updateNews`, danach `changeVisibility(recordType: "NewsItem")`.
- Die Studio-Newsliste nutzt den Mainserver-Lesepfad mit `includeInvisible=true`, um Entwürfe im Backoffice sichtbar zu halten.
```

- [ ] **Step 5: Run the relevant verification path including E2E**

Run:

```bash
pnpm nx run plugin-news:test:unit --testFiles=tests/news.pages.test.tsx --testFiles=tests/news.api.test.ts --testFiles=tests/news.detail-page.test.tsx
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service.test.ts --testFiles=src/server/news-route.test.ts
pnpm nx run plugin-news:test:types
pnpm nx run sva-mainserver:test:types
pnpm nx run sva-mainserver:check:runtime
pnpm nx run sva-studio-react:test:types
pnpm nx run sva-studio-react:test:e2e
```

Expected:

```text
PASS  packages/plugin-news/tests/news.pages.test.tsx
PASS  packages/plugin-news/tests/news.api.test.ts
PASS  packages/plugin-news/tests/news.detail-page.test.tsx
PASS  packages/sva-mainserver/src/server/service.test.ts
PASS  packages/sva-mainserver/src/server/news-route.test.ts
PASS  plugin-news:test:types
PASS  sva-mainserver:test:types
PASS  sva-mainserver:check:runtime
PASS  sva-studio-react:test:types
PASS  sva-studio-react:test:e2e
```

- [ ] **Step 6: Commit the list, E2E, and documentation slice**

```bash
git add packages/plugin-news/src/news.api.ts packages/plugin-news/src/news.pages.tsx packages/plugin-news/src/news.types.ts packages/plugin-news/tests/news.pages.test.tsx packages/sva-mainserver/src/types.ts packages/sva-mainserver/src/server/news-route.ts packages/sva-mainserver/src/server/service-internals/news-operations.ts packages/sva-mainserver/src/server/service.test.ts apps/sva-studio-react/e2e/news-plugin.spec.ts docs/architecture/05-building-block-view.md docs/architecture/06-runtime-view.md
git commit -m "feat: support draft-aware studio news list"
```
