import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createNews, deleteNews, getNews, listNews, updateNews, type NewsFormInput } from '../src/news.api.js';
import { NEWS_CONTENT_TYPE } from '../src/plugin.js';

const sampleInput: NewsFormInput = {
  title: 'Neue News',
  status: 'draft',
  publishedAt: '2026-04-13T09:00:00.000Z',
  payload: {
    teaser: 'Kurztext',
    body: '<p>Inhalt</p>',
    category: 'Allgemein',
    imageUrl: 'https://example.org/image.jpg',
    externalUrl: 'https://example.org/details',
  },
};

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

  it('filters non-news items from the list response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'news-1',
            title: 'News',
            contentType: NEWS_CONTENT_TYPE,
            payload: sampleInput.payload,
            status: 'draft',
            author: 'Editor',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-02',
          },
          { id: 'page-1', title: 'Page', contentType: 'generic', payload: sampleInput.payload, status: 'draft', author: 'Editor', createdAt: '2026-01-01', updatedAt: '2026-01-02' },
        ],
      }),
    } as Response);

    await expect(listNews()).resolves.toEqual([
      expect.objectContaining({ id: 'news-1', contentType: NEWS_CONTENT_TYPE }),
    ]);
  });

  it('creates news with idempotency header and the news content type', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { id: 'news-1', title: sampleInput.title, contentType: NEWS_CONTENT_TYPE, payload: sampleInput.payload, status: sampleInput.status, author: 'Editor', createdAt: '2026-01-01', updatedAt: '2026-01-02' },
      }),
    } as Response);

    await createNews(sampleInput);

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/iam/contents',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Idempotency-Key': 'uuid-1',
        }),
      })
    );
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0]?.[1]?.body as string)).toEqual({
      title: sampleInput.title,
      contentType: NEWS_CONTENT_TYPE,
      status: sampleInput.status,
      publishedAt: sampleInput.publishedAt,
      payload: sampleInput.payload,
    });
  });

  it('updates and deletes existing news entries', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 'news-1', title: sampleInput.title, contentType: NEWS_CONTENT_TYPE, payload: sampleInput.payload, status: sampleInput.status, author: 'Editor', createdAt: '2026-01-01', updatedAt: '2026-01-02' },
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
      '/api/v1/iam/contents/news-1',
      expect.objectContaining({ method: 'PATCH' })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/iam/contents/news-1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('loads a single news item and surfaces non-ok responses as typed errors', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 'news-1', title: sampleInput.title, contentType: NEWS_CONTENT_TYPE, payload: sampleInput.payload, status: sampleInput.status, author: 'Editor', createdAt: '2026-01-01', updatedAt: '2026-01-02' },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response);

    await expect(getNews('news-1')).resolves.toEqual(expect.objectContaining({ id: 'news-1' }));
    await expect(listNews()).rejects.toThrow('http_503');
  });
});
