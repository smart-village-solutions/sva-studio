import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
  authorizeContentPrimitiveForUser: vi.fn(),
  completeIdempotency: vi.fn(),
  emitAuthAuditEvent: vi.fn(),
  reserveIdempotency: vi.fn(),
  resolveActorInfo: vi.fn(),
  resolveMutationPrincipalContext: vi.fn(),
  authorizeMainserverDataProviderAccess: vi.fn(),
  recordMainserverDataProviderObservation: vi.fn(),
  beginMainserverMutationJournal: vi.fn(),
  finalizeMainserverMutationJournal: vi.fn(),
  validateCsrf: vi.fn(),
  listSvaMainserverNews: vi.fn(),
  getSvaMainserverNews: vi.fn(),
  createSvaMainserverNews: vi.fn(),
  updateSvaMainserverNews: vi.fn(),
  changeSvaMainserverNewsVisibility: vi.fn(),
  deleteSvaMainserverNews: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  createSdkLogger: vi.fn(() => ({ info: state.loggerInfo, warn: state.loggerWarn })),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-news', traceId: 'trace-news' })),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  authorizeMainserverCreatePrincipal: vi.fn(() => ({
    allowed: true,
    authorizationMode: 'exact',
    resolverMode: 'automatic',
    reason: 'allowed',
  })),
  authorizeMainserverDataProviderAccess: state.authorizeMainserverDataProviderAccess,
  resolveEffectivePermissions: vi.fn(async () => ({ ok: true, permissions: [] })),
  withAuthenticatedUser: state.withAuthenticatedUser,
  authorizeContentPrimitiveForUser: state.authorizeContentPrimitiveForUser,
  completeIdempotency: state.completeIdempotency,
  emitAuthAuditEvent: state.emitAuthAuditEvent,
  reserveIdempotency: state.reserveIdempotency,
  resolveActorInfo: state.resolveActorInfo,
  resolveMutationPrincipalContext: state.resolveMutationPrincipalContext,
  recordMainserverDataProviderObservation: state.recordMainserverDataProviderObservation,
  beginMainserverMutationJournal: state.beginMainserverMutationJournal,
  finalizeMainserverMutationJournal: state.finalizeMainserverMutationJournal,
  validateCsrf: state.validateCsrf,
}));

vi.mock('@sva/server-runtime', async () => {
  const actual = await vi.importActual<typeof import('@sva/server-runtime')>('@sva/server-runtime');
  return {
    ...actual,
    createSdkLogger: state.createSdkLogger,
    getWorkspaceContext: state.getWorkspaceContext,
  };
});

vi.mock('./service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./service.js')>();
  return {
    ...actual,
    listSvaMainserverNews: state.listSvaMainserverNews,
    getSvaMainserverNews: state.getSvaMainserverNews,
    createSvaMainserverNews: state.createSvaMainserverNews,
    updateSvaMainserverNews: state.updateSvaMainserverNews,
    changeSvaMainserverNewsVisibility: state.changeSvaMainserverNewsVisibility,
    deleteSvaMainserverNews: state.deleteSvaMainserverNews,
  };
});

import { SvaMainserverError } from './errors.js';
import { readMainserverMutationFollowUpContext } from './mutation-principal.js';
import { dispatchSvaMainserverNewsRequest } from './news-route';

const ctx = {
  sessionId: 'session-1',
  activeOrganizationId: '11111111-1111-1111-8111-111111111111',
  user: {
    id: 'subject-1',
    email: 'editor@example.invalid',
    displayName: 'Editor',
    roles: ['editor'],
    instanceId: 'de-musterhausen',
  },
};

const newsInput = {
  title: 'Neue News',
  author: 'Editor',
  keywords: 'Rathaus, Termin',
  externalId: 'ext-1',
  fullVersion: true,
  charactersToBeShown: 240,
  newsType: 'press',
  publishedAt: '2026-04-14T09:30:00.000Z',
  publicationDate: '2026-04-14T09:00:00.000Z',
  showPublishDate: true,
  categoryName: 'Allgemein',
  categories: [{ name: 'Allgemein' }],
  sourceUrl: { url: 'https://example.invalid/news', description: 'Quelle' },
  address: {
    street: 'Markt 1',
    zip: '12345',
    city: 'Musterhausen',
    geoLocation: { latitude: 52.1, longitude: 13.1 },
  },
  contentBlocks: [
    {
      title: 'Abschnitt',
      intro: 'Kurztext',
      body: '<p>Body</p>',
      mediaContents: [
        { contentType: 'image', sourceUrl: { url: 'https://example.invalid/image.jpg' } },
      ],
    },
  ],
  pointOfInterestId: 'poi-1',
  pushNotification: true,
};

const updateNewsInput = {
  ...newsInput,
  pushNotification: undefined,
};

const createRequest = (url: string, init?: RequestInit): Request =>
  new Request(url, {
    ...init,
    headers: {
      Origin: 'https://studio.test',
      'X-Requested-With': 'XMLHttpRequest',
      ...(init?.method && init.method !== 'GET'
        ? { 'X-SVA-Acting-Principal-Type': 'organization' }
        : {}),
      ...(init?.headers ?? {}),
    },
  });

describe('dispatchSvaMainserverNewsRequest', () => {
  beforeEach(() => {
    state.authorizeMainserverDataProviderAccess.mockResolvedValue({
      allowed: true,
      authorizationMode: 'exact',
      resolverMode: 'automatic',
      reason: 'allowed',
    });
    state.resolveActorInfo.mockResolvedValue({
      actor: {
        instanceId: 'de-musterhausen',
        actorAccountId: '00000000-0000-4000-8000-000000000001',
      },
    });
    state.resolveMutationPrincipalContext.mockResolvedValue({
      ok: true,
      context: {
        version: 1,
        instanceId: 'de-musterhausen',
        actorAccountId: '00000000-0000-4000-8000-000000000001',
        keycloakSubject: 'subject-1',
        activeOrganizationId: '11111111-1111-1111-8111-111111111111',
        actingPrincipalType: 'organization',
        actingPrincipalId: '11111111-1111-1111-8111-111111111111',
        credentialSource: 'organization',
        credentialFingerprint: 'a'.repeat(64),
      },
    });
    state.recordMainserverDataProviderObservation.mockResolvedValue({
      outcome: 'created',
      binding: { status: 'verified' },
    });
    state.getSvaMainserverNews.mockResolvedValue({
      id: 'news-1',
      visible: true,
      dataProvider: { id: 'dp-org-1', name: 'Redaktion' },
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('ignores unrelated routes', async () => {
    await expect(
      dispatchSvaMainserverNewsRequest(new Request('https://studio.test/api/v1/iam/contents'))
    ).resolves.toBeNull();
  });

  it('lists news after content read authorization', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
        organizationId: '11111111-1111-1111-8111-111111111111',
      },
      permissions: [],
    });
    state.listSvaMainserverNews.mockResolvedValue({
      data: [{ id: 'news-1' }],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    const response = await dispatchSvaMainserverNewsRequest(
      new Request('https://studio.test/api/v1/mainserver/news')
    );

    expect(state.authorizeContentPrimitiveForUser).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'news.read' })
    );
    expect(state.listSvaMainserverNews).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      activeOrganizationId: '11111111-1111-1111-8111-111111111111',
      includeInvisible: false,
      visibilityFilter: 'all',
      editorialStatusFilter: 'all',
      page: 1,
      pageSize: 25,
    });
    await expect(response?.json()).resolves.toEqual({
      data: [{ id: 'news-1' }],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
  });

  it('passes includeInvisible=true through the studio news list route', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
        organizationId: '11111111-1111-1111-8111-111111111111',
      },
      permissions: [],
    });
    state.listSvaMainserverNews.mockResolvedValue({
      data: [{ id: 'news-visible' }, { id: 'news-draft' }],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    const response = await dispatchSvaMainserverNewsRequest(
      new Request('https://studio.test/api/v1/mainserver/news?includeInvisible=true')
    );

    expect(state.listSvaMainserverNews).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      activeOrganizationId: '11111111-1111-1111-8111-111111111111',
      includeInvisible: true,
      visibilityFilter: 'all',
      editorialStatusFilter: 'all',
      page: 1,
      pageSize: 25,
    });
    await expect(response?.json()).resolves.toEqual({
      data: [{ id: 'news-visible' }, { id: 'news-draft' }],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
  });
  it('normalizes invalid pagination query parameters for news lists', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.listSvaMainserverNews.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    await dispatchSvaMainserverNewsRequest(
      new Request('https://studio.test/api/v1/mainserver/news?page=0&pageSize=999')
    );

    expect(state.listSvaMainserverNews).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      activeOrganizationId: '11111111-1111-1111-8111-111111111111',
      includeInvisible: false,
      visibilityFilter: 'all',
      editorialStatusFilter: 'all',
      page: 1,
      pageSize: 25,
    });
  });

  it('passes visibility and editorial status filters through the studio news list route', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.listSvaMainserverNews.mockResolvedValue({
      data: [{ id: 'news-draft' }],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    await dispatchSvaMainserverNewsRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/news?includeInvisible=true&visibilityFilter=hidden&editorialStatusFilter=draft'
      )
    );

    expect(state.listSvaMainserverNews).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      activeOrganizationId: '11111111-1111-1111-8111-111111111111',
      includeInvisible: true,
      visibilityFilter: 'hidden',
      editorialStatusFilter: 'draft',
      page: 1,
      pageSize: 25,
    });
  });

  it('creates news and applies draft visibility in the same route flow', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(null);
    state.resolveActorInfo.mockResolvedValue({
      actor: {
        instanceId: 'de-musterhausen',
        actorAccountId: '00000000-0000-4000-8000-000000000001',
      },
    });
    state.reserveIdempotency.mockResolvedValue({ status: 'reserved' });
    state.completeIdempotency.mockResolvedValue(undefined);
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.createSvaMainserverNews.mockResolvedValue({ id: 'news-1' });

    const ok = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'idem-1' },
        body: JSON.stringify(newsInput),
      })
    );
    await expect(ok?.json()).resolves.toEqual({ data: { id: 'news-1' } });
    expect(ok?.status).toBe(201);
    expect(state.reserveIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAccountId: '00000000-0000-4000-8000-000000000001',
        endpoint: 'POST:/api/v1/mainserver/news',
        idempotencyKey: 'idem-1',
      })
    );
    expect(state.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({ responseStatus: 201 })
    );
    expect(state.finalizeMainserverMutationJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        contentId: 'news-1',
        observedDataProviderId: 'dp-org-1',
      })
    );
    expect(state.emitAuthAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'plugin_action_authorized',
        pluginAction: expect.objectContaining({
          actionId: 'news.create',
          actionNamespace: 'news',
          actionOwner: 'sva-mainserver',
          resourceType: 'news',
          resourceId: 'news-1',
          result: 'success',
        }),
      })
    );
    const createCall = state.createSvaMainserverNews.mock.calls[0]?.[0] as
      { news?: Record<string, unknown> } | undefined;
    expect(createCall?.news).toEqual(
      expect.objectContaining({ contentBlocks: newsInput.contentBlocks, pushNotification: true })
    );
    expect(createCall?.news).not.toHaveProperty('author');
    expect(createCall?.news).not.toHaveProperty('payload');
    expect(state.changeSvaMainserverNewsVisibility).not.toHaveBeenCalled();

    state.createSvaMainserverNews.mockResolvedValueOnce({ id: 'news-2' });

    const draft = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'idem-draft' },
        body: JSON.stringify({ ...newsInput, visible: false }),
      })
    );
    await expect(draft?.json()).resolves.toEqual({ data: { id: 'news-2', visible: false } });
    expect(state.changeSvaMainserverNewsVisibility).toHaveBeenCalledWith(
      expect.objectContaining({ newsId: 'news-2', visible: false })
    );

    const rejected = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'idem-2' },
        body: JSON.stringify({ ...newsInput, publishedAt: '' }),
      })
    );
    expect(rejected?.status).toBe(400);
    expect(state.createSvaMainserverNews).toHaveBeenCalledTimes(2);
  });

  it('requires the news update permission before updating news', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(null);
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.updateSvaMainserverNews.mockResolvedValue({ id: 'news-1' });

    const response = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news/news-1', {
        method: 'PATCH',
        body: JSON.stringify(updateNewsInput),
      })
    );

    expect(state.authorizeContentPrimitiveForUser).toHaveBeenCalledTimes(1);
    expect(state.authorizeContentPrimitiveForUser).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'news.update' })
    );
    await expect(response?.json()).resolves.toEqual({ data: { id: 'news-1' } });
    expect(state.emitAuthAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'plugin_action_authorized',
        pluginAction: expect.objectContaining({
          actionId: 'news.update',
          resourceId: 'news-1',
          result: 'success',
        }),
      })
    );
  });

  it('updates news and applies visibility changes without a second route authorization', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(null);
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.updateSvaMainserverNews.mockResolvedValue({ id: 'news-1' });
    state.getSvaMainserverNews.mockResolvedValue({
      id: 'news-1',
      author: 'Persistierter Autor',
      dataProvider: { id: 'dp-org-1', name: 'Redaktion' },
    });

    const response = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news/news-1', {
        method: 'PATCH',
        body: JSON.stringify({ ...updateNewsInput, visible: false }),
      })
    );

    await expect(response?.json()).resolves.toEqual({ data: { id: 'news-1', visible: false } });
    expect(state.changeSvaMainserverNewsVisibility).toHaveBeenCalledWith(
      expect.objectContaining({ newsId: 'news-1', visible: false })
    );
    expect(state.updateSvaMainserverNews).toHaveBeenCalledWith(
      expect.objectContaining({
        news: expect.objectContaining({ author: 'Persistierter Autor' }),
      })
    );
    expect(state.authorizeContentPrimitiveForUser).toHaveBeenCalledTimes(1);
  });

  it('logs workflow-mapped update failures with request context', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(null);
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.updateSvaMainserverNews.mockRejectedValue(
      new SvaMainserverError({
        code: 'graphql_error',
        message: 'GraphQL fehlgeschlagen.',
        statusCode: 502,
      })
    );

    const response = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news/news-1', {
        method: 'PATCH',
        body: JSON.stringify(updateNewsInput),
      })
    );

    expect(response?.status).toBe(502);
    await expect(response?.json()).resolves.toEqual({
      error: 'graphql_error',
      message: 'GraphQL fehlgeschlagen.',
    });
    expect(state.loggerWarn).toHaveBeenCalledWith(
      'Mainserver News route failed',
      expect.objectContaining({
        operation: 'mainserver_news_update',
        request_id: 'req-news',
        trace_id: 'trace-news',
        content_id: 'news-1',
        method: 'PATCH',
        error_code: 'graphql_error',
      })
    );
  });

  it('normalizes nested optional news input before updating', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(null);
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.updateSvaMainserverNews.mockResolvedValue({ id: 'news-1' });

    const response = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news/news-1', {
        method: 'PATCH',
        body: JSON.stringify({
          title: ' Verschachtelte News ',
          publishedAt: '2026-04-14T09:30:00.000Z',
          charactersToBeShown: '120',
          showPublishDate: false,
          sourceUrl: null,
          categories: [
            {
              name: ' Verwaltung ',
              payload: { color: 'blue' },
              children: [{ name: ' Rathaus ' }],
            },
          ],
          address: {
            id: '42',
            addition: ' Eingang B ',
            street: ' Markt 1 ',
            zip: ' 12345 ',
            city: ' Musterhausen ',
            kind: ' venue ',
            geoLocation: { latitude: '52.1', longitude: '13.1' },
          },
          contentBlocks: [
            {
              title: ' Block ',
              intro: ' Intro ',
              body: ' Inhalt ',
              mediaContents: [
                {
                  captionText: ' Bild ',
                  copyright: ' Redaktion ',
                  contentType: ' image ',
                  height: '720',
                  width: '1280',
                  sourceUrl: null,
                },
              ],
            },
          ],
        }),
      })
    );

    expect(response?.status).toBe(200);
    expect(state.updateSvaMainserverNews).toHaveBeenCalledWith(
      expect.objectContaining({
        news: expect.objectContaining({
          title: 'Verschachtelte News',
          charactersToBeShown: 120,
          showPublishDate: false,
          categories: [
            { name: 'Verwaltung', payload: { color: 'blue' }, children: [{ name: 'Rathaus' }] },
          ],
          address: expect.objectContaining({
            id: 42,
            addition: 'Eingang B',
            street: 'Markt 1',
            zip: '12345',
            city: 'Musterhausen',
            kind: 'venue',
            geoLocation: { latitude: 52.1, longitude: 13.1 },
          }),
          contentBlocks: [
            expect.objectContaining({
              title: 'Block',
              intro: 'Intro',
              body: 'Inhalt',
              mediaContents: [
                {
                  captionText: 'Bild',
                  copyright: 'Redaktion',
                  contentType: 'image',
                  height: 720,
                  width: 1280,
                },
              ],
            }),
          ],
        }),
      })
    );
  });

  it('rejects invalid full-model shapes before GraphQL', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(null);
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });

    const invalidBodies: readonly unknown[] = [
      [],
      { ...updateNewsInput, publicationDate: 'invalid-date' },
      { ...updateNewsInput, charactersToBeShown: 'not-a-number' },
      { ...updateNewsInput, charactersToBeShown: 1.5 },
      { ...updateNewsInput, sourceUrl: 'https://example.invalid/news' },
      { ...updateNewsInput, sourceUrl: { url: 'http://example.invalid/news' } },
      { ...updateNewsInput, categories: 'Allgemein' },
      { ...updateNewsInput, categories: [null] },
      { ...updateNewsInput, categories: [{ name: '' }] },
      { ...updateNewsInput, categories: [{ name: 'Allgemein', children: 'Rathaus' }] },
      { ...updateNewsInput, address: 'Markt 1' },
      { ...updateNewsInput, address: { geoLocation: '52,13' } },
      { ...updateNewsInput, address: { geoLocation: { latitude: 100, longitude: 13 } } },
      { ...updateNewsInput, contentBlocks: undefined },
      { ...updateNewsInput, contentBlocks: 'Body' },
      { ...updateNewsInput, contentBlocks: [] },
      { ...updateNewsInput, contentBlocks: [null] },
      { ...updateNewsInput, contentBlocks: [{ body: '<p><br></p>' }] },
      { ...updateNewsInput, contentBlocks: [{ body: 'x'.repeat(50_001) }] },
      { ...updateNewsInput, contentBlocks: [{ mediaContents: 'Bild' }] },
      { ...updateNewsInput, contentBlocks: [{ mediaContents: [null] }] },
      {
        ...updateNewsInput,
        contentBlocks: [
          { mediaContents: [{ sourceUrl: { url: 'ftp://example.invalid/image.jpg' } }] },
        ],
      },
    ];

    for (const body of invalidBodies) {
      const response = await dispatchSvaMainserverNewsRequest(
        createRequest('https://studio.test/api/v1/mainserver/news/news-1', {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      );

      expect(response?.status).toBe(400);
      await expect(response?.json()).resolves.toEqual(
        expect.objectContaining({ error: 'invalid_request' })
      );
    }

    expect(state.updateSvaMainserverNews).not.toHaveBeenCalled();
  });

  it('rejects legacy payload, invalid visibility and read-only fields before GraphQL', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(null);
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });

    const legacyPayload = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news/news-1', {
        method: 'PATCH',
        body: JSON.stringify({ ...updateNewsInput, payload: { teaser: 'Alt', body: 'Alt' } }),
      })
    );
    expect(legacyPayload?.status).toBe(400);

    const readOnly = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news/news-1', {
        method: 'PATCH',
        body: JSON.stringify({ ...updateNewsInput, likeCount: 1 }),
      })
    );
    expect(readOnly?.status).toBe(400);

    const invalidVisibility = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news/news-1', {
        method: 'PATCH',
        body: JSON.stringify({ ...updateNewsInput, visible: 'nope' }),
      })
    );
    expect(invalidVisibility?.status).toBe(400);

    state.updateSvaMainserverNews.mockResolvedValue({ id: 'news-1' });

    const pushOnUpdate = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news/news-1', {
        method: 'PATCH',
        body: JSON.stringify(newsInput),
      })
    );
    expect(pushOnUpdate?.status).toBe(200);
    expect(state.updateSvaMainserverNews).toHaveBeenCalledWith(
      expect.objectContaining({
        newsId: 'news-1',
        news: expect.objectContaining({
          title: newsInput.title,
          contentBlocks: newsInput.contentBlocks,
          pushNotification: true,
        }),
      })
    );
    expect(state.updateSvaMainserverNews.mock.calls[0]?.[0]?.news).not.toHaveProperty('author');
  });

  it('deletes news via mainserver hard delete', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(null);
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.deleteSvaMainserverNews.mockResolvedValue({ id: 'news-1' });
    state.finalizeMainserverMutationJournal.mockResolvedValue({
      id: 'journal-delete-1',
      operationExternalId: 'req-news',
      actionId: 'news.delete',
      contentType: 'news.article',
      contentId: 'news-1',
      observedDataProviderId: 'dp-org-1',
      authorizationMode: 'exact',
      resolverMode: 'shadow',
      candidateAuthorizationMode: 'exact',
      candidateAllowed: true,
      shadowDifference: true,
      providerOutcome: 'succeeded',
      reconciliationStatus: 'complete',
      attemptCount: 1,
      completedSteps: ['authorized', 'provider_write', 'tombstone'],
    });

    const response = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news/news-1', { method: 'DELETE' })
    );

    expect(state.authorizeContentPrimitiveForUser).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'news.delete' })
    );
    expect(state.deleteSvaMainserverNews).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
        activeOrganizationId: '11111111-1111-1111-8111-111111111111',
        actingPrincipalType: 'organization',
        credentialFingerprint: 'a'.repeat(64),
        newsId: 'news-1',
      })
    );
    expect(state.beginMainserverMutationJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'news.delete',
        contentType: 'news.article',
        contentId: 'news-1',
        preimage: expect.objectContaining({ id: 'news-1' }),
      })
    );
    expect(state.finalizeMainserverMutationJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOutcome: 'succeeded',
        reconciliationStatus: 'complete',
        completedSteps: expect.arrayContaining(['provider_write', 'tombstone']),
        contentId: 'news-1',
      })
    );
    await expect(response?.json()).resolves.toEqual({ data: { id: 'news-1' } });
    expect(state.emitAuthAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'plugin_action_authorized',
        pluginAction: expect.objectContaining({
          actionId: 'news.delete',
          resourceId: 'news-1',
          result: 'success',
          reasonCode: 'mainserver_provider_succeeded',
          mainserverMutation: expect.objectContaining({
            dataProviderId: 'dp-org-1',
            resolverMode: 'shadow',
            candidateAuthorizationMode: 'exact',
            candidateAllowed: true,
            shadowDifference: true,
            operationExternalId: expect.any(String),
            providerOutcome: 'succeeded',
            reconciliationStatus: 'complete',
          }),
        }),
      })
    );
  });

  it('handles PATCH /api/v1/mainserver/news/:id/visibility', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(null);
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.changeSvaMainserverNewsVisibility.mockResolvedValue(undefined);
    state.getSvaMainserverNews.mockResolvedValue({
      id: 'news-1',
      visible: false,
      dataProvider: { id: 'dp-org-1', name: 'Redaktion' },
    });

    const request = createRequest('https://studio.test/api/v1/mainserver/news/news-1/visibility', {
      method: 'PATCH',
      body: JSON.stringify({ visible: true }),
      headers: { 'content-type': 'application/json' },
    });

    await dispatchSvaMainserverNewsRequest(request);

    expect(readMainserverMutationFollowUpContext(request)).toEqual({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      actorAccountId: '00000000-0000-4000-8000-000000000001',
      actorDisplayName: 'Editor',
      activeOrganizationId: '11111111-1111-1111-8111-111111111111',
      actingPrincipalType: 'organization',
      credentialSource: 'organization',
      credentialFingerprint: 'a'.repeat(64),
      operationExternalId: expect.any(String),
    });

    expect(state.changeSvaMainserverNewsVisibility).toHaveBeenCalledWith(
      expect.objectContaining({ newsId: 'news-1', visible: true })
    );
    expect(state.authorizeMainserverDataProviderAccess).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ action: 'news.update', dataProviderId: 'dp-org-1' })
    );
    expect(state.authorizeMainserverDataProviderAccess).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ action: 'content.publish', dataProviderId: 'dp-org-1' })
    );
    expect(state.beginMainserverMutationJournal).toHaveBeenCalledWith(
      expect.objectContaining({ actionId: 'content.publish' })
    );
    expect(state.emitAuthAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'plugin_action_authorized',
        outcome: 'success',
        pluginAction: expect.objectContaining({
          actionId: 'content.publish',
          resourceId: 'news-1',
          mainserverMutation: expect.objectContaining({
            actingPrincipalType: 'organization',
            credentialSource: 'organization',
            credentialFingerprint: 'a'.repeat(64),
            dataProviderId: 'dp-org-1',
            authorizationMode: 'exact',
          }),
        }),
      })
    );
    expect(state.emitAuthAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'plugin_action_authorized',
        pluginAction: expect.objectContaining({
          actionId: 'news.visibility.update',
          resourceId: 'news-1',
          result: 'success',
        }),
      })
    );
  });

  it('rejects publication when the separate publish permission is missing', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(null);
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.getSvaMainserverNews.mockResolvedValue({
      id: 'news-1',
      visible: false,
      dataProvider: { id: 'dp-org-1', name: 'Redaktion' },
    });
    state.authorizeMainserverDataProviderAccess
      .mockResolvedValueOnce({ allowed: true, authorizationMode: 'exact', reason: 'allowed' })
      .mockResolvedValueOnce({
        allowed: false,
        authorizationMode: 'exact',
        reason: 'forbidden',
      });

    const response = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news/news-1/visibility', {
        method: 'PATCH',
        body: JSON.stringify({ visible: true }),
        headers: { 'content-type': 'application/json' },
      })
    );

    expect(response?.status).toBe(403);
    expect(state.changeSvaMainserverNewsVisibility).not.toHaveBeenCalled();
    expect(state.beginMainserverMutationJournal).not.toHaveBeenCalled();
  });

  it('rejects mutating requests without CSRF and idempotency safeguards', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf
      .mockReturnValueOnce(new Response('csrf', { status: 403 }))
      .mockReturnValue(null);
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });

    const csrf = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news/news-1', { method: 'DELETE' })
    );
    expect(csrf?.status).toBe(403);
    await expect(csrf?.json()).resolves.toEqual({
      error: 'csrf_validation_failed',
      message: 'Sicherheitsprüfung fehlgeschlagen.',
    });

    const missingIdempotency = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news', {
        method: 'POST',
        body: JSON.stringify(newsInput),
      })
    );
    expect(missingIdempotency?.status).toBe(400);
    await expect(missingIdempotency?.json()).resolves.toEqual({
      error: 'idempotency_key_required',
      message: 'Header Idempotency-Key ist erforderlich.',
    });
  });

  it('replays and rejects idempotent news create requests before GraphQL', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(null);
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.resolveActorInfo.mockResolvedValue({
      actor: {
        instanceId: 'de-musterhausen',
        actorAccountId: '00000000-0000-4000-8000-000000000001',
      },
    });
    state.reserveIdempotency
      .mockResolvedValueOnce({
        status: 'replay',
        responseStatus: 201,
        responseBody: { data: { id: 'news-replay' } },
      })
      .mockResolvedValueOnce({
        status: 'conflict',
        message: 'Idempotency-Key wurde bereits verwendet.',
      });

    const replay = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'idem-replay' },
        body: JSON.stringify(newsInput),
      })
    );
    expect(replay?.status).toBe(201);
    await expect(replay?.json()).resolves.toEqual({ data: { id: 'news-replay' } });

    const conflict = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'idem-conflict' },
        body: JSON.stringify(newsInput),
      })
    );
    expect(conflict?.status).toBe(409);
    await expect(conflict?.json()).resolves.toEqual({
      error: 'idempotency_key_reuse',
      message: 'Idempotency-Key wurde bereits verwendet.',
    });
    expect(state.createSvaMainserverNews).not.toHaveBeenCalled();
  });

  it('completes failed create requests for idempotent replay', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(null);
    state.resolveActorInfo.mockResolvedValue({
      actor: {
        instanceId: 'de-musterhausen',
        actorAccountId: '00000000-0000-4000-8000-000000000001',
      },
    });
    state.reserveIdempotency.mockResolvedValue({ status: 'reserved' });
    state.completeIdempotency.mockResolvedValue(undefined);
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.createSvaMainserverNews.mockRejectedValue(
      new SvaMainserverError({
        code: 'graphql_error',
        message: 'GraphQL fehlgeschlagen.',
        statusCode: 502,
      })
    );
    state.finalizeMainserverMutationJournal.mockResolvedValue({
      id: 'journal-create-failed',
      operationExternalId: 'idem-failed',
      actionId: 'news.create',
      contentType: 'news.article',
      authorizationMode: 'exact',
      providerOutcome: 'failed',
      reconciliationStatus: 'reconciliation_required',
      attemptCount: 1,
      completedSteps: ['authorized'],
    });

    const response = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'idem-failed' },
        body: JSON.stringify(newsInput),
      })
    );

    expect(response?.status).toBe(502);
    await expect(response?.json()).resolves.toEqual({
      error: 'graphql_error',
      message: 'GraphQL fehlgeschlagen.',
    });
    expect(state.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'idem-failed',
        responseStatus: 502,
        status: 'FAILED',
      })
    );
    expect(state.loggerWarn).toHaveBeenCalledWith(
      'Mainserver News create failed',
      expect.objectContaining({
        operation: 'mainserver_news_create',
        request_id: 'req-news',
        trace_id: 'trace-news',
        error_code: 'graphql_error',
      })
    );
    expect(state.emitAuthAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'plugin_action_failed',
        pluginAction: expect.objectContaining({
          actionId: 'news.create',
          reasonCode: 'graphql_error',
          result: 'failure',
          mainserverMutation: expect.objectContaining({
            authorizationMode: 'exact',
            operationExternalId: expect.any(String),
            providerOutcome: 'failed',
            reconciliationStatus: 'reconciliation_required',
          }),
        }),
      })
    );
  });

  it('maps local authorization and upstream errors to stable error responses', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Keine Berechtigung.',
    });

    const denied = await dispatchSvaMainserverNewsRequest(
      new Request('https://studio.test/api/v1/mainserver/news')
    );
    expect(denied?.status).toBe(403);
    await expect(denied?.json()).resolves.toEqual({
      error: 'forbidden',
      message: 'Keine Berechtigung.',
    });

    state.authorizeContentPrimitiveForUser.mockResolvedValueOnce({
      ok: true,
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
        organizationId: '11111111-1111-1111-8111-111111111111',
      },
      permissions: [],
    });
    state.listSvaMainserverNews.mockRejectedValueOnce(
      new SvaMainserverError({
        code: 'organization_mainserver_credentials_missing',
        message: 'Für die aktive Organisation fehlen Mainserver-Credentials.',
        statusCode: 409,
      })
    );

    const upstream = await dispatchSvaMainserverNewsRequest(
      new Request('https://studio.test/api/v1/mainserver/news')
    );
    expect(upstream?.status).toBe(409);
    await expect(upstream?.json()).resolves.toEqual({
      error: 'organization_mainserver_credentials_missing',
      message: 'Für die aktive Organisation fehlen Mainserver-Credentials.',
    });
  });

  it('rejects unauthorized news creates before actor resolution and idempotency work', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Keine Berechtigung für diese Inhaltsoperation.',
    });

    const response = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'idem-denied' },
        body: JSON.stringify(newsInput),
      })
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      error: 'forbidden',
      message: 'Keine Berechtigung für diese Inhaltsoperation.',
    });
    expect(state.resolveActorInfo).not.toHaveBeenCalled();
    expect(state.reserveIdempotency).not.toHaveBeenCalled();
    expect(state.completeIdempotency).not.toHaveBeenCalled();
  });

  it('logs and maps early create workflow failures before execute runs', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(null);
    state.authorizeContentPrimitiveForUser.mockResolvedValueOnce({
      ok: true,
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
        organizationId: '11111111-1111-1111-8111-111111111111',
      },
      permissions: [],
    });
    state.resolveActorInfo.mockResolvedValue({
      actor: {
        instanceId: 'de-musterhausen',
        actorAccountId: '00000000-0000-4000-8000-000000000001',
      },
    });
    state.reserveIdempotency.mockRejectedValue(new Error('db down'));

    const response = await dispatchSvaMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'idem-early-fail' },
        body: JSON.stringify(newsInput),
      })
    );

    expect(response?.status).toBe(500);
    await expect(response?.json()).resolves.toEqual({
      error: 'internal_error',
      message: 'Mainserver-News-Anfrage ist fehlgeschlagen.',
    });
    expect(state.loggerWarn).toHaveBeenCalledWith(
      'Mainserver News route failed',
      expect.objectContaining({
        operation: 'mainserver_news_create',
        request_id: 'req-news',
        trace_id: 'trace-news',
        method: 'POST',
        error_code: 'internal_error',
      })
    );
    expect(state.completeIdempotency).not.toHaveBeenCalled();
  });

  it('returns stable errors for missing instance context and unsupported methods', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValueOnce({
      ok: false,
      status: 400,
      error: 'missing_instance',
      message: 'Kein Instanzkontext.',
    });

    const missingInstance = await dispatchSvaMainserverNewsRequest(
      new Request('https://studio.test/api/v1/mainserver/news')
    );
    expect(missingInstance?.status).toBe(400);
    await expect(missingInstance?.json()).resolves.toEqual({
      error: 'missing_instance',
      message: 'Kein Instanzkontext.',
    });

    const unsupported = await dispatchSvaMainserverNewsRequest(
      new Request('https://studio.test/api/v1/mainserver/news', { method: 'PUT' })
    );
    expect(unsupported?.status).toBe(405);
    await expect(unsupported?.json()).resolves.toEqual({
      error: 'method_not_allowed',
      message: 'Methode wird für Mainserver-News nicht unterstützt.',
    });
  });
});
