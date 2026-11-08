import { describe, expect, it, vi } from 'vitest';
import { executeSearch, type SearchEngineHost } from '../src/search-engine.js';
import {
  parseSearchQuery,
  readSearchQuery,
  searchQueryParams,
  type SearchDocument,
} from '../src/search-contract.js';
const document = (id: string): SearchDocument => ({
  id,
  contentType: 'news.article',
  title: 'Allowed',
  excerpt: '',
  href: '/admin/news/' + id,
  providerId: '1',
  providerName: 'Provider',
  categories: ['Culture'],
});
const query = parseSearchQuery({ q: 'city' });
const host = (overrides: Partial<SearchEngineHost> = {}): SearchEngineHost => ({
  readPage: async () => ({ candidates: [], exhausted: true }),
  resolve: async (candidate) => ({ kind: 'allowed', document: document(candidate.id) }),
  isCurrent: async () => true,
  ...overrides,
});
describe('authorized search', () => {
  it('sorts translated content-type labels before paging in German and English', async () => {
    const testHost = host({
      readPage: async (model) => ({
        candidates:
          model === 'GenericItem'
            ? Array.from({ length: 25 }, (_, i) => ({ model, id: String(i) }))
            : [],
        exhausted: true,
      }),
      resolve: async (candidate) => ({
        kind: 'allowed',
        document: {
          ...document(candidate.id),
          contentType:
            Number(candidate.id) < 20
              ? 'cockpit-cards.cockpit-card'
              : 'construction-sites.construction-site',
        },
      }),
    });
    const sortedQuery = { ...query, sortBy: 'contentType' as const, page: 2 };
    const german = await executeSearch(sortedQuery, testHost, 'de');
    const english = await executeSearch(sortedQuery, testHost, 'en');
    expect(german.items.map((item) => item.contentType)).toEqual(
      Array(5).fill('cockpit-cards.cockpit-card')
    );
    expect(english.items.map((item) => item.contentType)).toEqual(
      Array(5).fill('construction-sites.construction-site')
    );
  });
  it('sorts the authorized result set before paging, including descending order', async () => {
    const testHost = host({
      readPage: async (model) => ({
        candidates:
          model === 'NewsItem'
            ? Array.from({ length: 25 }, (_, i) => ({ model, id: String(25 - i) }))
            : [],
        exhausted: true,
      }),
      resolve: async (candidate) => ({
        kind: 'allowed',
        document: { ...document(candidate.id), title: `Title ${candidate.id}` },
      }),
    });
    const ascending = await executeSearch({ ...query, page: 2 }, testHost);
    expect(ascending.items.map((item) => item.id)).toEqual(['21', '22', '23', '24', '25']);
    const descending = await executeSearch(
      { ...query, sortBy: 'title', sortDirection: 'desc' },
      testHost
    );
    expect(descending.items[0]?.id).toBe('25');
    expect(() => parseSearchQuery({ sortBy: 'private' })).toThrow('invalid_search');
    expect(() => parseSearchQuery({ sortDirection: 'random' })).toThrow('invalid_search');
    const sortedQuery = parseSearchQuery({
      q: 'city',
      types: ['news.article'],
      sortBy: 'providerName',
      sortDirection: 'desc',
      page: 2,
    });
    expect(
      readSearchQuery(new URL(`https://studio.example/search?${searchQueryParams(sortedQuery)}`))
    ).toEqual(sortedQuery);
  });
  it('keeps excluded candidates out of records and filter options and scans later pages', async () => {
    const result = await executeSearch(
      query,
      host({
        readPage: async (model, offset) =>
          model !== 'NewsItem'
            ? { candidates: [], exhausted: true }
            : offset === 0
              ? { candidates: [{ model, id: 'hidden' }], exhausted: false }
              : { candidates: [{ model, id: 'allowed' }], exhausted: true },
        resolve: async (candidate) =>
          candidate.id === 'hidden'
            ? { kind: 'denied' }
            : { kind: 'allowed', document: document(candidate.id) },
      })
    );
    expect(result).toMatchObject({
      allowed: 1,
      denied: 1,
      complete: true,
      items: [{ id: 'allowed' }],
    });
    expect(JSON.stringify(result)).not.toContain('hidden');
  });
  it('never counts unresolved records as permission denials or claims completeness', async () => {
    const result = await executeSearch(
      query,
      host({
        readPage: async (model) => ({ candidates: [{ model, id: '1' }], exhausted: true }),
        resolve: async () => ({ kind: 'unresolved' }),
      })
    );
    expect(result).toMatchObject({ allowed: 0, denied: 0, complete: false });
  });
  it('deduplicates per model and paginates after authorization', async () => {
    const result = await executeSearch(
      { ...query, page: 2 },
      host({
        readPage: async (model) => ({
          candidates: Array.from({ length: 26 }, (_, i) => ({ model, id: String(i % 25) })),
          exhausted: true,
        }),
      })
    );
    expect(result.allowed).toBe(100);
    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
  it('keeps authorized filter options independent of the selected types', async () => {
    const result = await executeSearch(
      { ...query, types: ['news.article'] },
      host({
        readPage: async (model) => ({ candidates: [{ model, id: '1' }], exhausted: true }),
        resolve: async (candidate) => ({
          kind: 'allowed',
          document: {
            ...document(candidate.id),
            contentType: candidate.model === 'EventRecord' ? 'events.event-record' : 'news.article',
          },
        }),
      })
    );
    expect(result.options.types).toEqual(['events.event-record', 'news.article']);
    expect(result.items.every((item) => item.contentType === 'news.article')).toBe(true);
    expect(result).not.toHaveProperty('unresolved');
  });
  it('rejects stale context after results were computed', async () => {
    await expect(executeSearch(query, host({ isCurrent: async () => false }))).rejects.toThrow(
      'search_context_changed'
    );
  });
  it('does not call the upstream for an empty search', async () => {
    const readPage = vi.fn();
    expect((await executeSearch({ ...query, q: '' }, host({ readPage }))).complete).toBe(true);
    expect(readPage).not.toHaveBeenCalled();
  });
  it('marks time limited scans incomplete', async () => {
    let time = 0;
    const result = await executeSearch(
      query,
      host({
        now: () => time,
        readPage: async () => {
          time = 20_000;
          return { candidates: [], exhausted: true };
        },
      })
    );
    expect(result.complete).toBe(false);
  });
  it('stops at the shared candidate budget before any model approaches the index cap', async () => {
    const readPage = vi
      .fn<SearchEngineHost['readPage']>()
      .mockImplementation(async (model, offset) => ({
        candidates: Array.from({ length: 100 }, (_, i) => ({ model, id: String(offset + i) })),
        exhausted: false,
      }));
    const result = await executeSearch(query, host({ readPage, now: () => 0 }));
    expect(result.allowed).toBe(10_000);
    expect(result.complete).toBe(false);
    expect(readPage).toHaveBeenCalledTimes(100);
    expect(readPage.mock.calls.every(([, offset]) => offset < 10_000)).toBe(true);
  });
  it('validates query size, page and arrays', () => {
    expect(() => parseSearchQuery({ q: 'x'.repeat(251) })).toThrow();
    expect(() => parseSearchQuery({ page: 1.2 })).toThrow();
    expect(() => parseSearchQuery({ categories: [null] })).toThrow();
    expect(parseSearchQuery({ types: ['news.article', 'news.article'] }).types).toEqual([
      'news.article',
    ]);
  });
});
