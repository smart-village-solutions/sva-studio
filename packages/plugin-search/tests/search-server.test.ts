import { describe, expect, it, vi } from 'vitest';
import { readSearchConnection } from '../src/server.js';
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
});
