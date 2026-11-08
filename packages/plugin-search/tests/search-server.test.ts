import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPluginServerHandlers,
  readSearchConnection,
  type SearchHost,
  type SearchUserContext,
} from '../src/server.js';
import { readCandidatePage } from '../src/search-meili.server.js';
import { parseSearchQuery } from '../src/search-contract.js';
const source = {
  graphqlBaseUrl: 'https://town.example/graphql',
  environment: 'production',
  municipalityIds: [12],
};
const env = {
  MEILI_URL: 'https://search.example',
  MEILI_SEARCH_KEY: 'restricted-test-key',
  MEILI_SOURCES: JSON.stringify({ town: source }),
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const context = (search = '?q=city'): SearchUserContext => ({
  request: new Request(`https://studio.example/api/v1/plugins/search/query${search}`),
  sessionId: 'test-session',
  pluginId: 'search',
  handlerId: 'search.query',
  scope: 'tenant',
  pathParams: {},
  activeOrganizationId: 'organization',
  actor: { id: 'user', roles: [], instanceId: 'town' },
});
const host = (patch: Partial<SearchHost> = {}): SearchHost => ({
  loadGraphqlUrl: async () => source.graphqlBaseUrl,
  contextStamp: async () => 'current',
  resolve: async () => ({ kind: 'denied' }),
  ...patch,
});
const run = async (input = context(), patch: Partial<SearchHost> = {}) => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const handler = createPluginServerHandlers(host(patch))['search.query'];
  if (!handler) throw new Error('missing handler');
  return handler(input);
};
describe('search HTTP boundary', () => {
  it.each([
    ['de', ['news.article', 'events.event-record']],
    ['en', ['events.event-record', 'news.article']],
  ])(
    'uses the existing request language %s for content-type ordering',
    async (locale, expected) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockImplementation(async () =>
            Response.json({ hits: [{ id: '42' }], estimatedTotalHits: 1 })
          )
      );
      const input = context('?q=city&sortBy=contentType');
      const response = await run(
        {
          ...input,
          request: new Request(input.request, { headers: { 'Accept-Language': String(locale) } }),
        },
        {
          resolve: async (_context, _query, candidate) => {
            const contentType =
              candidate.model === 'NewsItem'
                ? 'news.article'
                : candidate.model === 'EventRecord'
                  ? 'events.event-record'
                  : '';
            return contentType
              ? {
                  kind: 'allowed',
                  document: {
                    id: candidate.id,
                    contentType,
                    title: 'Allowed',
                    excerpt: '',
                    href: '/allowed',
                    providerId: '',
                    providerName: '',
                    categories: [],
                  },
                }
              : { kind: 'excluded' };
          },
        }
      );
      const payload = await response.json();
      expect(payload.data.items.map((item: { contentType: string }) => item.contentType)).toEqual(
        expected
      );
    }
  );
  it('returns only authorized data with private cache headers', async () => {
    const fetcher = vi.fn().mockImplementation(async () => Response.json({ hits: [{ id: 1 }] }));
    vi.stubGlobal('fetch', fetcher);
    const resolve = vi.fn<SearchHost['resolve']>().mockResolvedValue({ kind: 'denied' });
    const response = await run(context(), { resolve });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Cookie');
    expect(await response.json()).toMatchObject({
      data: { items: [], allowed: 0, denied: 4, complete: true },
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(resolve).toHaveBeenCalledTimes(4);
  });
  it('rejects invalid queries and non-tenant contexts before contacting upstreams', async () => {
    const loadGraphqlUrl = vi.fn();
    expect((await run({ ...context(), scope: 'platform' }, { loadGraphqlUrl })).status).toBe(403);
    expect(
      (await run({ ...context(), actor: { id: 'user', roles: [] } }, { loadGraphqlUrl })).status
    ).toBe(403);
    expect((await run(context('?page=0'), { loadGraphqlUrl })).status).toBe(400);
    expect(loadGraphqlUrl).not.toHaveBeenCalled();
  });
  it('fails closed for missing or changed source and credentials', async () => {
    expect((await run(context(), { loadGraphqlUrl: async () => null })).status).toBe(503);
    expect(
      await (
        await run(context(), { loadGraphqlUrl: async () => 'https://foreign.example/graphql' })
      ).json()
    ).toEqual({ error: 'search_not_configured' });
    expect((await run(context(), { contextStamp: async () => null })).status).toBe(409);
    const stamp = vi.fn().mockResolvedValueOnce('initial').mockResolvedValue('changed');
    expect((await run(context('?q='), { contextStamp: stamp })).status).toBe(409);
    const url = vi
      .fn()
      .mockResolvedValueOnce(source.graphqlBaseUrl)
      .mockResolvedValue('https://changed.example/graphql');
    expect((await run(context('?q='), { loadGraphqlUrl: url })).status).toBe(409);
  });
  it('does not return raw upstream errors or configuration values', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private upstream failure')));
    const response = await run();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'search_unavailable' });
  });
});
describe('search source boundary', () => {
  it('requires an explicit instance and exact configured Mainserver binding', () => {
    expect(readSearchConnection('town', source.graphqlBaseUrl, env)).toMatchObject({
      municipalityIds: [12],
      environment: 'production',
    });
    expect(() => readSearchConnection('foreign', source.graphqlBaseUrl, env)).toThrow(
      'search_not_configured'
    );
    expect(() => readSearchConnection('town', 'https://other.example/graphql', env)).toThrow(
      'search_not_configured'
    );
  });
  it('never falls back to the master key', () => {
    expect(() =>
      readSearchConnection('town', source.graphqlBaseUrl, {
        ...env,
        MEILI_SEARCH_KEY: '',
        MEILI_MASTER_KEY: 'never-use',
      })
    ).toThrow('search_not_configured');
  });
  it('rejects ambiguous source values and insecure endpoints', () => {
    for (const municipalityIds of [[], [0], [-1], ['12']])
      expect(() =>
        readSearchConnection('town', source.graphqlBaseUrl, {
          ...env,
          MEILI_SOURCES: JSON.stringify({ town: { ...source, municipalityIds } }),
        })
      ).toThrow();
    for (const MEILI_URL of [
      'http://search.example',
      'https://user:pass@search.example',
      'https://search.example?token=bad',
    ])
      expect(() =>
        readSearchConnection('town', source.graphqlBaseUrl, { ...env, MEILI_URL })
      ).toThrow();
  });
  it('fixes the source boundary while collecting independent filter candidates', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ hits: [{ id: 42 }] }));
    const connection = readSearchConnection('town', source.graphqlBaseUrl, env);
    const category = 'x" OR municipality_id = 99';
    const page = await readCandidatePage(
      connection,
      parseSearchQuery({ q: 'city', categories: [category], provider: '5' }),
      'NewsItem',
      0,
      fetcher
    );
    expect(page).toEqual({ candidates: [{ model: 'NewsItem', id: '42' }], exhausted: true });
    const [url, options] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://search.example/indexes/NewsItem_production/search');
    const body = JSON.parse(String(options?.body));
    expect(body.filter[0]).toBe('(municipality_id = 12)');
    expect(body.filter).toEqual(['(municipality_id = 12)']);
    expect(body.attributesToRetrieve).toEqual(['id', 'data_provider_id', 'categories']);
    expect(options?.redirect).toBe('error');
  });
  it('rejects malformed candidate IDs and upstream errors', async () => {
    const connection = readSearchConnection('town', source.graphqlBaseUrl, env);
    for (const response of [
      Response.json({ hits: [{ id: '../private' }] }),
      Response.json({ hits: null }),
      new Response('', { status: 401 }),
    ]) {
      await expect(
        readCandidatePage(
          connection,
          parseSearchQuery({ q: 'city' }),
          'NewsItem',
          0,
          vi.fn().mockResolvedValue(response)
        )
      ).rejects.toThrow();
    }
  });
  it('keeps provider and category metadata server-side and detects a full source page', async () => {
    const candidates = Array.from({ length: 100 }, (_, id) => ({
      id,
      data_provider_id: 8,
      categories: ['Culture'],
    }));
    const result = await readCandidatePage(
      readSearchConnection('town', source.graphqlBaseUrl, env),
      parseSearchQuery({ q: 'city' }),
      'NewsItem',
      0,
      vi.fn().mockResolvedValue(Response.json({ hits: candidates }))
    );
    expect(result.exhausted).toBe(false);
    expect(result.candidates[0]).toEqual({
      model: 'NewsItem',
      id: '0',
      providerId: '8',
      categories: ['Culture'],
    });
    expect(() =>
      readSearchConnection('town', source.graphqlBaseUrl, { ...env, MEILI_SOURCES: '{' })
    ).toThrow('search_not_configured');
  });
});
