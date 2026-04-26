import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
  authorizeContentPrimitiveForUser: vi.fn(),
  completeIdempotency: vi.fn(),
  reserveIdempotency: vi.fn(),
  resolveActorInfo: vi.fn(),
  validateCsrf: vi.fn(),
  listSvaMainserverNews: vi.fn(),
  getSvaMainserverNews: vi.fn(),
  createSvaMainserverNews: vi.fn(),
  updateSvaMainserverNews: vi.fn(),
  deleteSvaMainserverNews: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
  authorizeContentPrimitiveForUser: state.authorizeContentPrimitiveForUser,
  completeIdempotency: state.completeIdempotency,
  reserveIdempotency: state.reserveIdempotency,
  resolveActorInfo: state.resolveActorInfo,
  validateCsrf: state.validateCsrf,
}));

vi.mock('@sva/sva-mainserver/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/sva-mainserver/server')>();
  return {
    ...actual,
    listSvaMainserverNews: state.listSvaMainserverNews,
    getSvaMainserverNews: state.getSvaMainserverNews,
    createSvaMainserverNews: state.createSvaMainserverNews,
    updateSvaMainserverNews: state.updateSvaMainserverNews,
    deleteSvaMainserverNews: state.deleteSvaMainserverNews,
  };
});

import { dispatchMainserverNewsRequest } from './mainserver-news-api.server';
import { SvaMainserverError } from '@sva/sva-mainserver/server';

const ctx = {
  sessionId: 'session-1',
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
      mediaContents: [{ contentType: 'image', sourceUrl: { url: 'https://example.invalid/image.jpg' } }],
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
      ...(init?.headers ?? {}),
    },
  });

describe('dispatchMainserverNewsRequest', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('ignores unrelated routes', async () => {
    await expect(dispatchMainserverNewsRequest(new Request('https://studio.test/api/v1/iam/contents'))).resolves.toBeNull();
  });

  it('lists news after content read authorization', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.listSvaMainserverNews.mockResolvedValue([{ id: 'news-1' }]);

    const response = await dispatchMainserverNewsRequest(new Request('https://studio.test/api/v1/mainserver/news'));

    expect(state.authorizeContentPrimitiveForUser).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'content.read' })
    );
    expect(state.listSvaMainserverNews).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
    });
    await expect(response?.json()).resolves.toEqual({ data: [{ id: 'news-1' }] });
  });

  it('creates published news and rejects missing publishedAt before GraphQL', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(null);
    state.resolveActorInfo.mockResolvedValue({
      actor: { instanceId: 'de-musterhausen', actorAccountId: '00000000-0000-4000-8000-000000000001' },
    });
    state.reserveIdempotency.mockResolvedValue({ status: 'reserved' });
    state.completeIdempotency.mockResolvedValue(undefined);
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.createSvaMainserverNews.mockResolvedValue({ id: 'news-1' });

    const ok = await dispatchMainserverNewsRequest(
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
    expect(state.completeIdempotency).toHaveBeenCalledWith(expect.objectContaining({ responseStatus: 201 }));
    const createCall = state.createSvaMainserverNews.mock.calls[0]?.[0] as { news?: Record<string, unknown> } | undefined;
    expect(createCall?.news).toEqual(expect.objectContaining({ contentBlocks: newsInput.contentBlocks, pushNotification: true }));
    expect(createCall?.news).not.toHaveProperty('payload');

    const rejected = await dispatchMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'idem-2' },
        body: JSON.stringify({ ...newsInput, publishedAt: '' }),
      })
    );
    expect(rejected?.status).toBe(400);
    expect(state.createSvaMainserverNews).toHaveBeenCalledTimes(1);
  });

  it('requires metadata and payload permissions before updating news', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(null);
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.updateSvaMainserverNews.mockResolvedValue({ id: 'news-1' });

    const response = await dispatchMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news/news-1', {
        method: 'PATCH',
        body: JSON.stringify(updateNewsInput),
      })
    );

    expect(state.authorizeContentPrimitiveForUser).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ action: 'content.updateMetadata' })
    );
    expect(state.authorizeContentPrimitiveForUser).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ action: 'content.updatePayload' })
    );
    await expect(response?.json()).resolves.toEqual({ data: { id: 'news-1' } });
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

    const response = await dispatchMainserverNewsRequest(
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
          categories: [{ name: 'Verwaltung', payload: { color: 'blue' }, children: [{ name: 'Rathaus' }] }],
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
      { ...updateNewsInput, contentBlocks: 'Body' },
      { ...updateNewsInput, contentBlocks: [null] },
      { ...updateNewsInput, contentBlocks: [{ mediaContents: 'Bild' }] },
      { ...updateNewsInput, contentBlocks: [{ mediaContents: [null] }] },
      { ...updateNewsInput, contentBlocks: [{ mediaContents: [{ sourceUrl: { url: 'ftp://example.invalid/image.jpg' } }] }] },
    ];

    for (const body of invalidBodies) {
      const response = await dispatchMainserverNewsRequest(
        createRequest('https://studio.test/api/v1/mainserver/news/news-1', {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      );

      expect(response?.status).toBe(400);
      await expect(response?.json()).resolves.toEqual(expect.objectContaining({ error: 'invalid_request' }));
    }

    expect(state.updateSvaMainserverNews).not.toHaveBeenCalled();
  });

  it('rejects legacy payload, read-only fields and update push notifications before GraphQL', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(null);

    const legacyPayload = await dispatchMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news/news-1', {
        method: 'PATCH',
        body: JSON.stringify({ ...updateNewsInput, payload: { teaser: 'Alt', body: 'Alt' } }),
      })
    );
    expect(legacyPayload?.status).toBe(400);

    const readOnly = await dispatchMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news/news-1', {
        method: 'PATCH',
        body: JSON.stringify({ ...updateNewsInput, likeCount: 1 }),
      })
    );
    expect(readOnly?.status).toBe(400);

    const pushOnUpdate = await dispatchMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news/news-1', {
        method: 'PATCH',
        body: JSON.stringify(newsInput),
      })
    );
    expect(pushOnUpdate?.status).toBe(400);
    expect(state.updateSvaMainserverNews).not.toHaveBeenCalled();
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

    const response = await dispatchMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news/news-1', { method: 'DELETE' })
    );

    expect(state.authorizeContentPrimitiveForUser).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'content.delete' })
    );
    expect(state.deleteSvaMainserverNews).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      newsId: 'news-1',
    });
    await expect(response?.json()).resolves.toEqual({ data: { id: 'news-1' } });
  });

  it('rejects mutating requests without CSRF and idempotency safeguards', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValueOnce(new Response('csrf', { status: 403 })).mockReturnValue(null);

    const csrf = await dispatchMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news/news-1', { method: 'DELETE' })
    );
    expect(csrf?.status).toBe(403);
    await expect(csrf?.json()).resolves.toEqual({
      error: 'csrf_validation_failed',
      message: 'Sicherheitsprüfung fehlgeschlagen.',
    });

    const missingIdempotency = await dispatchMainserverNewsRequest(
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
    state.resolveActorInfo.mockResolvedValue({
      actor: { instanceId: 'de-musterhausen', actorAccountId: '00000000-0000-4000-8000-000000000001' },
    });
    state.reserveIdempotency
      .mockResolvedValueOnce({ status: 'replay', responseStatus: 201, responseBody: { data: { id: 'news-replay' } } })
      .mockResolvedValueOnce({ status: 'conflict', message: 'Idempotency-Key wurde bereits verwendet.' });

    const replay = await dispatchMainserverNewsRequest(
      createRequest('https://studio.test/api/v1/mainserver/news', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'idem-replay' },
        body: JSON.stringify(newsInput),
      })
    );
    expect(replay?.status).toBe(201);
    await expect(replay?.json()).resolves.toEqual({ data: { id: 'news-replay' } });

    const conflict = await dispatchMainserverNewsRequest(
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
      actor: { instanceId: 'de-musterhausen', actorAccountId: '00000000-0000-4000-8000-000000000001' },
    });
    state.reserveIdempotency.mockResolvedValue({ status: 'reserved' });
    state.completeIdempotency.mockResolvedValue(undefined);
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.createSvaMainserverNews.mockRejectedValue(
      new SvaMainserverError({ code: 'graphql_error', message: 'GraphQL fehlgeschlagen.', statusCode: 502 })
    );

    const response = await dispatchMainserverNewsRequest(
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
  });

  it('maps local authorization and upstream errors to stable error responses', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Keine Berechtigung.',
    });

    const denied = await dispatchMainserverNewsRequest(new Request('https://studio.test/api/v1/mainserver/news'));
    expect(denied?.status).toBe(403);
    await expect(denied?.json()).resolves.toEqual({ error: 'forbidden', message: 'Keine Berechtigung.' });

    state.authorizeContentPrimitiveForUser.mockResolvedValueOnce({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.listSvaMainserverNews.mockRejectedValueOnce(
      new SvaMainserverError({ code: 'missing_credentials', message: 'Credentials fehlen.', statusCode: 400 })
    );

    const upstream = await dispatchMainserverNewsRequest(new Request('https://studio.test/api/v1/mainserver/news'));
    expect(upstream?.status).toBe(400);
    await expect(upstream?.json()).resolves.toEqual({ error: 'missing_credentials', message: 'Credentials fehlen.' });
  });

  it('returns stable errors for missing instance context and unsupported methods', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValueOnce({
      ok: false,
      status: 400,
      error: 'missing_instance',
      message: 'Kein Instanzkontext.',
    });

    const missingInstance = await dispatchMainserverNewsRequest(new Request('https://studio.test/api/v1/mainserver/news'));
    expect(missingInstance?.status).toBe(400);
    await expect(missingInstance?.json()).resolves.toEqual({
      error: 'missing_instance',
      message: 'Kein Instanzkontext.',
    });

    const unsupported = await dispatchMainserverNewsRequest(
      new Request('https://studio.test/api/v1/mainserver/news', { method: 'PUT' })
    );
    expect(unsupported?.status).toBe(405);
    await expect(unsupported?.json()).resolves.toEqual({
      error: 'method_not_allowed',
      message: 'Methode wird für Mainserver-News nicht unterstützt.',
    });
  });
});
