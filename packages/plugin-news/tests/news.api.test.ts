import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NewsApiError, createNews, deleteNews, getNews, listNews, updateNews } from '../src/news.api.js';
import type { NewsFormInput } from '../src/index.js';
import { NEWS_CONTENT_TYPE } from '../src/plugin.js';

const sampleInput: NewsFormInput = {
  title: 'Neue News',
  author: 'Editor',
  categoryName: 'Allgemein',
  publishedAt: '2026-04-13T09:00:00.000Z',
  contentBlocks: [{ intro: 'Kurztext', body: '<p>Inhalt</p>' }],
  sourceUrl: { url: 'https://example.org/details' },
  pushNotification: true,
};

const sampleResponse = {
  id: 'news-1',
  title: sampleInput.title,
  contentType: NEWS_CONTENT_TYPE,
  payload: {},
  contentBlocks: sampleInput.contentBlocks,
  status: 'published',
  author: 'Editor',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-02',
  publishedAt: sampleInput.publishedAt,
};

const defaultListQuery = {
  page: 1,
  pageSize: 25,
} as const;

describe('news api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'uuid-1'),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads news from the mainserver facade', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'news-1',
            title: 'News',
            contentType: NEWS_CONTENT_TYPE,
            payload: {},
            contentBlocks: sampleInput.contentBlocks,
            status: 'published',
            author: 'Editor',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-02',
            publishedAt: sampleInput.publishedAt,
          },
        ],
        pagination: {
          page: 2,
          pageSize: 50,
          hasNextPage: true,
        },
      }),
    } as Response);

    await expect(listNews({ page: 2, pageSize: 50 })).resolves.toEqual({
      data: [expect.objectContaining({ id: 'news-1' })],
      pagination: { page: 2, pageSize: 50, hasNextPage: true },
    });
    expect(fetch).toHaveBeenCalledWith('/api/v1/mainserver/news?page=2&pageSize=50', expect.any(Object));
  });

  it('falls back to the requested pagination when the mainserver omits it', async () => {
    const requestedQuery = { page: 3, pageSize: 50 } as const;

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'news-1',
            title: 'News',
            contentType: NEWS_CONTENT_TYPE,
            payload: {},
            contentBlocks: sampleInput.contentBlocks,
            status: 'published',
            author: 'Editor',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-02',
            publishedAt: sampleInput.publishedAt,
          },
        ],
      }),
    } as Response);

    await expect(listNews(requestedQuery)).resolves.toEqual({
      data: [expect.objectContaining({ id: 'news-1' })],
      pagination: { page: 3, pageSize: 50, hasNextPage: false },
    });
  });

  it('creates news with idempotency header through the mainserver facade', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: sampleResponse,
      }),
    } as Response);

    await createNews(sampleInput);

    expect(fetch).toHaveBeenCalledWith('/api/v1/mainserver/news', expect.any(Object));

    const requestInit = vi.mocked(fetch).mock.calls[0]?.[1];
    const headers = requestInit?.headers;
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.credentials).toBe('include');
    expect(headers).toBeInstanceOf(Headers);
    expect((headers as Headers).get('Accept')).toBe('application/json');
    expect((headers as Headers).get('Content-Type')).toBe('application/json');
    expect((headers as Headers).get('Idempotency-Key')).toBe('uuid-1');

    expect(JSON.parse(requestInit?.body as string)).toEqual({
      title: sampleInput.title,
      author: sampleInput.author,
      categoryName: sampleInput.categoryName,
      publishedAt: sampleInput.publishedAt,
      contentBlocks: sampleInput.contentBlocks,
      sourceUrl: sampleInput.sourceUrl,
      pushNotification: true,
    });
  });

  it('updates and deletes existing news entries', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: sampleResponse,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'news-1' } }),
      } as Response);

    await expect(updateNews('news-1', sampleInput)).resolves.toEqual(expect.objectContaining({ id: 'news-1' }));
    await expect(deleteNews('news-1')).resolves.toBeUndefined();

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/v1/mainserver/news/news-1',
      expect.objectContaining({ method: 'PATCH' })
    );
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0]?.[1]?.body as string)).not.toHaveProperty('pushNotification');
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/mainserver/news/news-1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('loads a single news item and surfaces non-ok responses as typed errors', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: sampleResponse,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response);

    await expect(getNews('news-1')).resolves.toEqual(expect.objectContaining({ id: 'news-1' }));
    await expect(listNews({ page: 1, pageSize: 25 })).rejects.toThrow('http_503');
  });

  it('uses stable server error envelopes and HTTP fallbacks for failed responses', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'forbidden', message: 'Keine Berechtigung.' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('not json');
        },
      } as Response);

    await expect(getNews('news-1')).rejects.toMatchObject({
      name: 'NewsApiError',
      code: 'forbidden',
      message: 'Keine Berechtigung.',
    } satisfies Partial<NewsApiError>);
    await expect(listNews({ page: 1, pageSize: 25 })).rejects.toMatchObject({
      code: 'http_502',
      message: 'http_502',
    } satisfies Partial<NewsApiError>);
  });
});
