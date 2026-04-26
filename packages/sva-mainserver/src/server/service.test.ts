import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  loadSvaMainserverInstanceConfig: vi.fn(),
  readSvaMainserverCredentialsWithStatus: vi.fn(),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@opentelemetry/api', () => ({
  SpanStatusCode: {
    OK: 1,
    ERROR: 2,
  },
  metrics: {
    getMeter: () => ({
      createHistogram: () => ({ record: vi.fn() }),
      createCounter: () => ({ add: vi.fn() }),
      createObservableGauge: () => ({ addCallback: vi.fn() }),
    }),
  },
  trace: {
    getTracer: () => ({
      startActiveSpan: async (_name: string, callback: (span: { setAttributes: (attrs: Record<string, unknown>) => void; setStatus: (status: Record<string, unknown>) => void; recordException: (error: unknown) => void; end: () => void; }) => Promise<unknown>) =>
        callback({
          setAttributes: () => undefined,
          setStatus: () => undefined,
          recordException: () => undefined,
          end: () => undefined,
        }),
    }),
  },
}));

vi.mock('@sva/auth-runtime/server', () => ({
  readSvaMainserverCredentialsWithStatus: state.readSvaMainserverCredentialsWithStatus,
}));

vi.mock('./config-store.js', () => ({
  loadSvaMainserverInstanceConfig: state.loadSvaMainserverInstanceConfig,
}));

vi.mock('@sva/server-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/server-runtime')>();

  return {
    ...actual,
    createSdkLogger: () => state.logger,
    getWorkspaceContext: () => ({
      requestId: 'req-mainserver',
      traceId: 'trace-mainserver',
      workspaceId: 'de-musterhausen',
    }),
    initializeOtelSdk: async () => ({ status: 'ready' as const }),
  };
});

import {
  createSvaMainserverNews,
  createSvaMainserverService,
  deleteSvaMainserverNews,
  getSvaMainserverNews,
  listSvaMainserverNews,
  resetSvaMainserverServiceState,
  updateSvaMainserverNews,
} from './service';
import { SvaMainserverError } from './errors';

const baseConfig = {
  instanceId: 'de-musterhausen',
  providerKey: 'sva_mainserver' as const,
  graphqlBaseUrl: 'https://mainserver.example.invalid/graphql',
  oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
  enabled: true,
};

const createJsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const createDeferred = <TValue>() => {
  let resolve: ((value: TValue) => void) | undefined;
  let reject: ((reason?: unknown) => void) | undefined;
  const promise = new Promise<TValue>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve: (value: TValue) => resolve?.(value),
    reject: (reason?: unknown) => reject?.(reason),
  };
};

describe('createSvaMainserverService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    state.loadSvaMainserverInstanceConfig.mockReset();
    state.readSvaMainserverCredentialsWithStatus.mockReset();
    state.logger.debug.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.logger.error.mockReset();
    resetSvaMainserverServiceState();
  });

  it('caches credentials for sixty seconds by default', async () => {
    let nowMs = 0;
    const readCredentials = vi
      .fn()
      .mockResolvedValue({
        apiKey: 'key-1',
        apiSecret: 'secret-1',
      });

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockImplementation(async () => createJsonResponse(200, { data: { __typename: 'Query' } }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials,
      fetchImpl,
      now: () => nowMs,
    });

    await service.getQueryRootTypename({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' });
    nowMs += 30_000;
    await service.getQueryRootTypename({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' });

    expect(readCredentials).toHaveBeenCalledTimes(1);
  });

  it('caches access tokens until the skew window is reached', async () => {
    let nowMs = 0;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockImplementation(async () => createJsonResponse(200, { data: { __typename: 'Query' } }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
      now: () => nowMs,
    });

    await service.getQueryRootTypename({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' });
    nowMs += 10_000;
    await service.getQueryRootTypename({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('renews access tokens once the skew window is reached', async () => {
    let nowMs = 0;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { __typename: 'Query' } }))
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-2', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { __typename: 'Query' } }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
      now: () => nowMs,
    });

    await service.getQueryRootTypename({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' });
    nowMs += 70_000;
    await service.getQueryRootTypename({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' });

    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('executes query and mutation diagnostics with typed responses', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { __typename: 'Query' } }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { __typename: 'Mutation' } }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'connected',
      queryRootTypename: 'Query',
      mutationRootTypename: 'Mutation',
    });
  });

  it('lists, creates, updates and deletes news with typed GraphQL variables', async () => {
    const item = {
      id: 'news-1',
      title: 'News',
      author: 'Editor',
      payload: { teaser: 'Kurztext', body: '<p>Body</p>', category: 'Allgemein' },
      publishedAt: '2026-04-14T09:30:00.000Z',
      createdAt: '2026-04-14T09:00:00.000Z',
      updatedAt: '2026-04-14T09:30:00.000Z',
      visible: true,
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { newsItems: [item] } }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { createNewsItem: item } }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { createNewsItem: item } }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { destroyRecord: { id: 1, status: 'ok', statusCode: 200 } } }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
    });
    const connection = { instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' };
    const news = {
      title: item.title,
      publishedAt: item.publishedAt,
      categoryName: 'Allgemein',
      contentBlocks: [{ intro: 'Kurztext', body: '<p>Body</p>' }],
    };

    await expect(service.listNews(connection)).resolves.toEqual([
      expect.objectContaining({ id: 'news-1', status: 'published', contentType: 'news.article' }),
    ]);
    await expect(service.createNews({ ...connection, news })).resolves.toEqual(expect.objectContaining({ id: 'news-1' }));
    await expect(service.updateNews({ ...connection, newsId: 'news-1', news })).resolves.toEqual(
      expect.objectContaining({ id: 'news-1' })
    );
    await expect(service.deleteNews({ ...connection, newsId: 'news-1' })).resolves.toEqual({ id: 'news-1' });

    const requestBodies = fetchImpl.mock.calls
      .slice(1)
      .map(([, init]) => JSON.parse(init?.body as string) as { operationName: string; variables?: Record<string, unknown> });
    expect(requestBodies[0]).toMatchObject({
      operationName: 'SvaMainserverNewsList',
      variables: { limit: 100, skip: 0, order: 'publishedAt_DESC' },
    });
    expect(requestBodies[2]).toMatchObject({
      operationName: 'SvaMainserverCreateNews',
      variables: { id: 'news-1', forceCreate: false, categoryName: 'Allgemein' },
    });
    expect(requestBodies[3]).toMatchObject({
      operationName: 'SvaMainserverDestroyNews',
      variables: { id: 'news-1', recordType: 'NewsItem' },
    });
  });

  it('routes default news helpers through the default service', async () => {
    const item = {
      id: 'news-1',
      title: 'News',
      payload: { teaser: 'Kurztext', body: '<p>Body</p>' },
      publishedAt: '2026-04-14T09:30:00.000Z',
    };
    state.loadSvaMainserverInstanceConfig.mockResolvedValue(baseConfig);
    state.readSvaMainserverCredentialsWithStatus.mockResolvedValue({
      status: 'ok',
      credentials: { apiKey: 'key-1', apiSecret: 'secret-1' },
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { newsItems: [item] } }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { newsItem: item } }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { createNewsItem: item } }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { createNewsItem: item } }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { destroyRecord: { id: 1, statusCode: 200 } } }));
    vi.stubGlobal('fetch', fetchImpl);
    const connection = { instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' };
    const news = {
      title: item.title,
      publishedAt: item.publishedAt,
      payload: item.payload,
    };

    await expect(listSvaMainserverNews(connection)).resolves.toHaveLength(1);
    await expect(getSvaMainserverNews({ ...connection, newsId: 'news-1' })).resolves.toMatchObject({ id: 'news-1' });
    await expect(createSvaMainserverNews({ ...connection, news })).resolves.toMatchObject({ id: 'news-1' });
    await expect(updateSvaMainserverNews({ ...connection, newsId: 'news-1', news })).resolves.toMatchObject({
      id: 'news-1',
    });
    await expect(deleteSvaMainserverNews({ ...connection, newsId: 'news-1' })).resolves.toEqual({ id: 'news-1' });
  });

  it('maps news payload strings and hides invisible upstream news', async () => {
    const publishedAt = '2026-04-14T09:30:00.000Z';
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          data: {
            newsItems: [
              {
                id: 'news-1',
                title: null,
                payload: JSON.stringify({ teaser: 'Kurztext', body: '<p>Body</p>', externalUrl: 'https://example.test' }),
                publicationDate: publishedAt,
              },
              {
                id: 'news-2',
                title: 'Hidden',
                payload: '{invalid',
                publishedAt,
                visible: false,
              },
            ],
          },
        })
      );

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
    });

    await expect(
      service.listNews({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'news-1',
        title: '',
        payload: expect.objectContaining({
          teaser: 'Kurztext',
          body: '<p>Body</p>',
          externalUrl: 'https://example.test',
        }),
        createdAt: publishedAt,
        updatedAt: publishedAt,
        publishedAt,
      }),
    ]);
  });

  it('maps invalid news payloads to an empty payload fallback', async () => {
    const publishedAt = '2026-04-14T09:30:00.000Z';
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          data: {
            newsItem: {
              id: 'news-1',
              title: 'Broken payload',
              payload: '{invalid',
              publishedAt,
            },
          },
        })
      );

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
    });

    await expect(
      service.getNews({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1', newsId: 'news-1' })
    ).resolves.toMatchObject({
      id: 'news-1',
      payload: { teaser: '', body: '' },
    });
  });

  it('maps full nested news fields and writes full mutation variables without payload', async () => {
    const publishedAt = '2026-04-14T09:30:00.000Z';
    const fullItem = {
      id: 'news-full',
      title: 'Volle News',
      author: 'Redaktion',
      keywords: 'Rathaus',
      externalId: 'ext-1',
      fullVersion: true,
      charactersToBeShown: '240',
      newsType: 'press',
      publicationDate: '2026-04-14T08:00:00.000Z',
      publishedAt,
      showPublishDate: true,
      payload: {},
      sourceUrl: { url: 'https://example.test/news', description: 'Quelle' },
      address: {
        id: '7',
        addition: '2. OG',
        street: 'Markt 1',
        zip: '12345',
        city: 'Musterhausen',
        kind: 'venue',
        geoLocation: { latitude: '52.1', longitude: '13.1' },
      },
      categories: [{ name: 'Allgemein', children: [{ name: 'Rathaus' }] }],
      contentBlocks: [
        {
          title: 'Abschnitt',
          intro: 'Kurztext',
          body: '<p>Body</p>',
          mediaContents: [
            {
              captionText: 'Bild',
              copyright: 'SVA',
              contentType: 'image',
              height: 100,
              width: 200,
              sourceUrl: { url: 'https://example.test/image.jpg' },
            },
          ],
        },
      ],
      dataProvider: { id: 'provider-1', name: 'Provider' },
      settings: { alwaysRecreateOnImport: 'false', displayOnlySummary: 'true', onlySummaryLinkText: 'Mehr' },
      announcements: [{ id: 'shout-1', title: 'Hinweis' }],
      likeCount: 5,
      likedByMe: false,
      pushNotificationsSentAt: '2026-04-14T10:00:00.000Z',
      visible: true,
      createdAt: publishedAt,
      updatedAt: publishedAt,
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { newsItem: fullItem } }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { createNewsItem: fullItem } }));
    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
    });
    const connection = { instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' };

    await expect(service.getNews({ ...connection, newsId: 'news-full' })).resolves.toMatchObject({
      id: 'news-full',
      keywords: 'Rathaus',
      charactersToBeShown: 240,
      sourceUrl: { url: 'https://example.test/news', description: 'Quelle' },
      address: expect.objectContaining({ city: 'Musterhausen', geoLocation: { latitude: 52.1, longitude: 13.1 } }),
      categories: [{ name: 'Allgemein', children: [{ name: 'Rathaus' }] }],
      contentBlocks: [
        expect.objectContaining({
          mediaContents: [expect.objectContaining({ height: 100, width: 200 })],
        }),
      ],
      dataProvider: { id: 'provider-1', name: 'Provider' },
      settings: { alwaysRecreateOnImport: 'false', displayOnlySummary: 'true', onlySummaryLinkText: 'Mehr' },
      announcements: [{ id: 'shout-1', title: 'Hinweis' }],
      likeCount: 5,
      likedByMe: false,
      pushNotificationsSentAt: '2026-04-14T10:00:00.000Z',
    });

    await expect(
      service.createNews({
        ...connection,
        news: {
          title: fullItem.title,
          author: fullItem.author,
          keywords: fullItem.keywords,
          externalId: fullItem.externalId,
          fullVersion: fullItem.fullVersion,
          charactersToBeShown: 240,
          newsType: fullItem.newsType,
          publicationDate: fullItem.publicationDate,
          publishedAt,
          showPublishDate: true,
          categoryName: 'Allgemein',
      categories: [{ name: 'Allgemein', children: [{ name: 'Rathaus' }] }],
          sourceUrl: { url: 'https://example.test/news', description: 'Quelle' },
          address: {
            street: 'Markt 1',
            zip: '12345',
            city: 'Musterhausen',
            geoLocation: { latitude: 52.1, longitude: 13.1 },
          },
          contentBlocks: [{ body: '<p>Body</p>', mediaContents: [{ sourceUrl: { url: 'https://example.test/image.jpg' } }] }],
          pointOfInterestId: 'poi-1',
          pushNotification: true,
        },
      })
    ).resolves.toMatchObject({ id: 'news-full' });

    const createBody = JSON.parse(fetchImpl.mock.calls[2]?.[1]?.body as string) as { variables: Record<string, unknown> };
    expect(createBody.variables).toMatchObject({
      title: 'Volle News',
      author: 'Redaktion',
      keywords: 'Rathaus',
      categoryName: 'Allgemein',
      pushNotification: true,
      pointOfInterestId: 'poi-1',
    });
    expect(createBody.variables).not.toHaveProperty('payload');
  });

  it('normalizes sparse nested news fields without rejecting optional data', async () => {
    const publishedAt = '2026-04-14T09:30:00.000Z';
    const sparseItem = {
      id: 'news-sparse',
      title: 'Sparse',
      author: null,
      keywords: null,
      externalId: null,
      fullVersion: null,
      charactersToBeShown: 'abc',
      newsType: null,
      publicationDate: null,
      publishedAt,
      showPublishDate: null,
      payload: JSON.stringify({ teaser: 'Alt', body: '<p>Alt</p>', imageUrl: 'https://example.test/legacy.jpg' }),
      sourceUrl: { url: null, description: 'Ohne URL' },
      address: {
        geoLocation: { latitude: Number.POSITIVE_INFINITY, longitude: 'bad' },
      },
      categories: [{ name: null }, { name: 'Allgemein', iconName: null, position: null, children: [{ name: null }] }],
      contentBlocks: [],
      dataProvider: { id: null, name: null, logo: { url: null }, address: {} },
      settings: { alwaysRecreateOnImport: null, displayOnlySummary: null, onlySummaryLinkText: null },
      announcements: [{ id: null, title: null, description: null }],
      likeCount: null,
      likedByMe: null,
      visible: true,
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { newsItem: sparseItem } }));
    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
    });

    await expect(
      service.getNews({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1', newsId: 'news-sparse' })
    ).resolves.toMatchObject({
      id: 'news-sparse',
      categories: [{ name: 'Allgemein', children: [] }],
      contentBlocks: [
        expect.objectContaining({
          intro: 'Alt',
          body: '<p>Alt</p>',
          mediaContents: [expect.objectContaining({ sourceUrl: { url: 'https://example.test/legacy.jpg' } })],
        }),
      ],
      announcements: [{}],
      likeCount: 0,
      likedByMe: false,
    });
  });

  it('rejects invalid news responses and missing update publication dates', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { newsItem: null } }));
    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
    });
    const connection = { instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' };

    await expect(service.getNews({ ...connection, newsId: 'news-missing' })).rejects.toMatchObject({
      code: 'not_found',
      statusCode: 404,
    });
    await expect(
      service.createNews({
        ...connection,
        news: {
          title: 'No date',
          publishedAt: '  ',
          payload: { teaser: 'Kurztext', body: '<p>Body</p>' },
        },
      })
    ).rejects.toMatchObject({
      code: 'invalid_response',
      statusCode: 400,
    });
  });

  it('rejects news items without publication dates and failed destroy responses', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          data: {
            newsItems: [
              {
                id: 'news-1',
                title: 'No date',
                payload: { teaser: 'Kurztext', body: '<p>Body</p>' },
              },
            ],
          },
        })
      )
      .mockResolvedValueOnce(createJsonResponse(200, { data: { destroyRecord: { id: 1, statusCode: 500 } } }));
    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
    });
    const connection = { instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' };

    await expect(service.listNews(connection)).rejects.toMatchObject({
      code: 'invalid_response',
      statusCode: 502,
    });
    await expect(service.deleteNews({ ...connection, newsId: 'news-1' })).rejects.toMatchObject({
      code: 'invalid_response',
      statusCode: 502,
    });
  });

  it('maps missing credentials to a stable error response', async () => {
    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => null,
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'missing_credentials',
    });
  });

  it('maps identity provider failures to identity_provider_unavailable', async () => {
    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => {
        throw new Error('keycloak unavailable');
      },
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'identity_provider_unavailable',
    });
  });

  it('passes the tenant instance id into credential loading', async () => {
    const readCredentials = vi.fn().mockResolvedValue({
      apiKey: 'key-1',
      apiSecret: 'secret-1',
    });

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials,
      fetchImpl: vi
        .fn()
        .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
        .mockResolvedValueOnce(createJsonResponse(200, { data: { __typename: 'Query' } }))
        .mockResolvedValueOnce(createJsonResponse(200, { data: { __typename: 'Mutation' } })),
    });

    await service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' });

    expect(readCredentials).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
    });
  });

  it('uses the default credential reader with keycloak subject and instance id', async () => {
    state.readSvaMainserverCredentialsWithStatus.mockResolvedValue({
      status: 'ok',
      credentials: {
        apiKey: 'key-1',
        apiSecret: 'secret-1',
      },
    });

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      fetchImpl: vi
        .fn()
        .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
        .mockResolvedValueOnce(createJsonResponse(200, { data: { __typename: 'Query' } }))
        .mockResolvedValueOnce(createJsonResponse(200, { data: { __typename: 'Mutation' } })),
    });

    await service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' });

    expect(state.readSvaMainserverCredentialsWithStatus).toHaveBeenCalledWith('subject-1', 'de-musterhausen');
  });

  it('preserves typed identity provider errors from credential loading', async () => {
    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => {
        throw new SvaMainserverError({
          code: 'identity_provider_unavailable',
          message: 'idp down',
          statusCode: 503,
        });
      },
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'identity_provider_unavailable',
      errorMessage: 'idp down',
    });
  });

  it('maps graphql errors from the upstream endpoint', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { errors: [{ message: 'boom' }] }))
      .mockResolvedValueOnce(createJsonResponse(200, { errors: [{ message: 'boom' }] }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'graphql_error',
    });
  });

  it('maps 401 and 403 responses from the upstream endpoint', async () => {
    const createServiceForStatus = (status: number) =>
      createSvaMainserverService({
        loadInstanceConfig: async () => baseConfig,
        readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
        fetchImpl: vi
          .fn()
          .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
          .mockResolvedValueOnce(new Response('forbidden', { status }))
          .mockResolvedValueOnce(new Response('forbidden', { status })),
      });

    await expect(
      createServiceForStatus(401).getConnectionStatus({
        instanceId: baseConfig.instanceId,
        keycloakSubject: 'subject-1',
      })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'unauthorized',
    });

    await expect(
      createServiceForStatus(403).getConnectionStatus({
        instanceId: baseConfig.instanceId,
        keycloakSubject: 'subject-1',
      })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'forbidden',
    });
  });

  it('maps non-auth token endpoint status codes to token_request_failed', async () => {
    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl: vi.fn().mockResolvedValueOnce(new Response('upstream down', { status: 500 })),
      retryBaseDelayMs: 0,
      randomIntImpl: () => 0,
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'token_request_failed',
    });
  });

  it('maps non-auth graphql status codes to network_error', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(new Response('bad gateway', { status: 502 }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
      retryBaseDelayMs: 0,
      randomIntImpl: () => 0,
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'network_error',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      baseConfig.graphqlBaseUrl,
      expect.objectContaining({
        redirect: 'manual',
      })
    );
  });

  it('retries once for transient 503 responses before succeeding', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('temporarily unavailable', { status: 503 }))
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { __typename: 'Query' } }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
      retryBaseDelayMs: 0,
      randomIntImpl: () => 0,
    });

    await expect(
      service.getQueryRootTypename({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({ __typename: 'Query' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('cancels the first response body before retrying after transient 503', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const transientResponse = {
      status: 503,
      body: {
        cancel,
      },
    } as unknown as Response;

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(transientResponse)
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { __typename: 'Query' } }));

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
      retryBaseDelayMs: 0,
      randomIntImpl: () => 0,
    });

    await expect(
      service.getQueryRootTypename({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({ __typename: 'Query' });

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('maps timeout failures to a stable network error', async () => {
    const timeoutError = new Error('timeout');
    timeoutError.name = 'TimeoutError';

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl: vi.fn().mockRejectedValue(timeoutError),
      retryBaseDelayMs: 0,
      randomIntImpl: () => 0,
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'network_error',
    });
  });

  it('does not retry non-retryable errors after a transient first failure', async () => {
    const retryable = new TypeError('socket closed');
    const nonRetryable = new Error('fatal downstream error');

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl: vi.fn().mockRejectedValueOnce(retryable).mockRejectedValueOnce(nonRetryable),
      retryBaseDelayMs: 0,
      randomIntImpl: () => 0,
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'network_error',
      errorMessage: 'fatal downstream error',
    });
  });

  it('maps non-json GraphQL responses to invalid_response', async () => {
    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl: vi
        .fn()
        .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
        .mockResolvedValueOnce(new Response('not-json', { status: 200, headers: { 'Content-Type': 'text/plain' } })),
      retryBaseDelayMs: 0,
      randomIntImpl: () => 0,
    });

    await expect(
      service.getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
    ).resolves.toMatchObject({
      status: 'error',
      errorCode: 'invalid_response',
    });
  });

  it('waits for the parallel diagnostic request to settle before returning an error status', async () => {
    const delayedGraphql = createDeferred<Response>();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { errors: [{ message: 'boom' }] }))
      .mockImplementationOnce(async () => delayedGraphql.promise);

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => baseConfig,
      readCredentials: async () => ({ apiKey: 'key-1', apiSecret: 'secret-1' }),
      fetchImpl,
      retryBaseDelayMs: 0,
      randomIntImpl: () => 0,
    });

    let settled = false;
    const statusPromise = service
      .getConnectionStatus({ instanceId: baseConfig.instanceId, keycloakSubject: 'subject-1' })
      .then((status) => {
        settled = true;
        return status;
      });

    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);

    delayedGraphql.resolve(createJsonResponse(200, { data: { __typename: 'Mutation' } }));

    await expect(statusPromise).resolves.toMatchObject({
      status: 'error',
      errorCode: 'graphql_error',
    });
  });
});
