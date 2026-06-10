import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildNewsBasisMutation,
  buildNewsContentMutation,
  buildNewsReleaseMutation,
  buildNewsSettingsMutation,
  NewsApiError,
  createNews,
  deleteNews,
  getNews,
  listNews,
  listNewsCategories,
  saveNewsEditorItem,
  setNewsVisibility,
  updateNews,
  updateNewsPartial,
} from '../src/news.api.js';
import { createDefaultNewsDetailFormValues } from '../src/news.detail-form.js';
import type { NewsFormInput } from '../src/index.js';
import { NEWS_CONTENT_TYPE } from '../src/plugin.js';

const sampleInput: NewsFormInput = {
  title: 'Neue News',
  author: 'Editor',
  categories: [{ name: 'Allgemein' }],
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

const editorValuesFixture = {
  ...createDefaultNewsDetailFormValues('Redaktion'),
  title: 'Neue News',
  author: 'Redaktion',
  categories: ['Allgemein'],
  contentTeaser: 'Kurztext',
  contentBody: '<p>Inhalt</p>',
  sourceUrl: {
    url: 'https://example.org/details',
    description: '',
  },
  publicationMode: 'immediate' as const,
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

  it('loads available categories from the mainserver facade', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: 'cat-1', name: 'Allgemein' },
          { id: 'cat-2', name: 'Rathaus' },
        ],
      }),
    } as Response);

    await expect(listNewsCategories()).resolves.toEqual([
      { id: 'cat-1', name: 'Allgemein' },
      { id: 'cat-2', name: 'Rathaus' },
    ]);
    expect(fetch).toHaveBeenCalledWith('/api/v1/mainserver/categories', expect.any(Object));
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
      categories: sampleInput.categories,
      publishedAt: sampleInput.publishedAt,
      contentBlocks: sampleInput.contentBlocks,
      sourceUrl: sampleInput.sourceUrl,
      pushNotification: true,
    });
  });

  it('creates a draft with visible=false in the initial create request', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: sampleResponse,
      }),
    } as Response);

    await expect(saveNewsEditorItem({ values: { ...editorValuesFixture, publicationMode: 'draft' } })).resolves.toEqual(
      expect.objectContaining({
        id: 'news-1',
        visible: false,
      })
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/mainserver/news',
      expect.objectContaining({ method: 'POST' })
    );
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual(
      expect.objectContaining({
        title: 'Neue News',
        author: 'Redaktion',
        visible: false,
      })
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

  it('updates partial payloads and toggles visibility through the dedicated endpoint', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: sampleResponse,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' }),
      } as Response);

    await expect(updateNewsPartial('news-1', { title: 'Nur Titel' })).resolves.toEqual(
      expect.objectContaining({ id: 'news-1' })
    );
    await expect(setNewsVisibility('news-1/with slash', false)).resolves.toBeUndefined();

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/v1/mainserver/news/news-1',
      expect.objectContaining({ method: 'PATCH' })
    );
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0]?.[1]?.body as string)).toEqual({ title: 'Nur Titel' });
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/mainserver/news/news-1%2Fwith%20slash/visibility',
      expect.objectContaining({ method: 'PATCH' })
    );
    expect(JSON.parse(vi.mocked(fetch).mock.calls[1]?.[1]?.body as string)).toEqual({ visible: false });
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

  it('builds scoped partial mutations from the simplified editor model', () => {
    const values = createDefaultNewsDetailFormValues('Redaktion');
    values.title = 'Neue News';
    values.categories = ['Allgemein'];
    values.contentTeaser = 'Kurztext';
    values.contentBody = '<p>Inhalt</p>';
    values.sourceUrl = {
      url: 'https://example.org/details',
      description: '',
    };
    values.externalId = 'ext-42';
    values.newsType = 'meldung';
    values.charactersToBeShown = '180';
    values.fullVersion = true;
    values.publicationDate = '2026-04-12T08:00:00.000Z';
    values.publishedAt = '2026-04-13T09:00:00.000Z';
    values.showPublishDate = false;
    values.pointOfInterestId = 'poi-1';
    values.address = {
      street: 'Marktplatz 1',
      zip: '12345',
      city: 'Musterstadt',
    };

    expect(buildNewsBasisMutation(values)).toEqual({
      title: 'Neue News',
      author: 'Redaktion',
      categories: [{ name: 'Allgemein' }],
    });
    expect(buildNewsContentMutation(values)).toEqual({
      sourceUrl: { url: 'https://example.org/details' },
      contentBlocks: [{ title: 'Neue News', intro: 'Kurztext', body: '<p>Inhalt</p>', mediaContents: [] }],
      address: {
        street: 'Marktplatz 1',
        zip: '12345',
        city: 'Musterstadt',
      },
      pointOfInterestId: 'poi-1',
    });
    expect(buildNewsReleaseMutation(values)).toEqual({
      publishedAt: expect.any(String),
      publicationDate: expect.any(String),
      showPublishDate: false,
    });
    expect(buildNewsSettingsMutation(values)).toEqual({
      externalId: 'ext-42',
      fullVersion: true,
      charactersToBeShown: 180,
      newsType: 'meldung',
    });
  });

  it('routes editor saves through the injected update operation for existing news items', async () => {
    const updateNewsMock = vi.fn().mockResolvedValue({
      id: 'news-1',
      title: 'Persistierter Titel',
      contentType: NEWS_CONTENT_TYPE,
      payload: {},
      contentBlocks: [{ intro: 'Persistierter Teaser', body: '<p>Persistierter Inhalt</p>' }],
      status: 'draft',
      author: 'Persistierter Autor',
      categories: [{ name: 'Persistiert' }],
      sourceUrl: { url: 'https://persisted.example.org', description: 'Persistiert' },
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
      visible: false,
    });

    const values = createDefaultNewsDetailFormValues();
    values.title = 'Neue News';
    values.contentTeaser = 'Kurztext';
    values.contentBody = '<p>Inhalt</p>';
    values.publicationMode = 'draft';

    await expect(
      saveNewsEditorItem(
        {
          contentId: 'news-1',
          values,
        },
        {
          updateNews: updateNewsMock,
        }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        author: '',
        categories: [],
        sourceUrl: { url: '', description: '' },
        contentBlocks: [{ title: 'Neue News', intro: 'Kurztext', body: '<p>Inhalt</p>', mediaContents: [] }],
        visible: false,
      })
    );
    expect(updateNewsMock).toHaveBeenCalledWith(
      'news-1',
      expect.objectContaining({
        title: 'Neue News',
        visible: false,
      })
    );
  });
});
