import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IamContentListQuery } from '@sva/core';

import { useUnifiedContentList } from './use-unified-content-list';

const listNewsMock = vi.fn();
const listEventsMock = vi.fn();
const listPoiMock = vi.fn();
const listSurveysMock = vi.fn();

vi.mock('@sva/plugin-news', () => ({
  listNews: (...args: unknown[]) => listNewsMock(...args),
}));

vi.mock('@sva/plugin-events', () => ({
  listEvents: (...args: unknown[]) => listEventsMock(...args),
}));

vi.mock('@sva/plugin-poi', () => ({
  listPoi: (...args: unknown[]) => listPoiMock(...args),
}));

vi.mock('@sva/plugin-surveys', () => ({
  listSurveys: (...args: unknown[]) => listSurveysMock(...args),
}));

describe('useUnifiedContentList', () => {
  beforeEach(() => {
    listNewsMock.mockReset();
    listEventsMock.mockReset();
    listPoiMock.mockReset();
    listSurveysMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads mainserver-backed content items, filters them and paginates the merged result', async () => {
    const permissionActions: readonly string[] = [];

    listNewsMock.mockResolvedValue({
      data: [
        {
          id: 'news-2',
          title: 'Zoo',
          contentType: 'news.article',
          status: 'published',
          payload: {},
          author: 'Redaktion',
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-03T10:00:00.000Z',
          publishedAt: '2026-05-03T10:00:00.000Z',
        },
        {
          id: 'news-1',
          title: 'Alpha',
          contentType: 'news.article',
          status: 'published',
          payload: {},
          author: 'Redaktion',
          createdAt: '2026-05-01T09:00:00.000Z',
          updatedAt: '2026-05-02T10:00:00.000Z',
          publishedAt: '2026-05-02T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    listEventsMock.mockResolvedValue({
      data: [
        {
          id: 'event-1',
          title: 'Beta Event',
          contentType: 'events.event-record',
          status: 'published',
          createdAt: '2026-05-01T08:00:00.000Z',
          updatedAt: '2026-05-04T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    listPoiMock.mockResolvedValue({
      data: [
        {
          id: 'poi-1',
          name: 'Gamma POI',
          contentType: 'poi.point-of-interest',
          status: 'published',
          createdAt: '2026-05-01T07:00:00.000Z',
          updatedAt: '2026-05-01T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    listSurveysMock.mockResolvedValue({
      data: [
        {
          id: 'survey-1',
          title: { de: 'Delta Survey' },
          contentType: 'surveys.survey',
          status: 'ACTIVE',
          resultVisibility: 'AFTER_SURVEY_END',
          targetAreaIds: [],
          showResultsInApp: true,
          isAnonymous: true,
          questionCount: 3,
          participationCount: 15,
          submissionCount: 16,
          createdAt: '2026-05-01T06:00:00.000Z',
          updatedAt: '2026-05-05T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    type HookProps = {
      readonly query: IamContentListQuery;
      readonly visibleTypes: readonly string[];
      readonly instanceId: string;
    };

    const initialProps: HookProps = {
      query: {
        page: 1,
        pageSize: 2,
        q: 'a',
        sortBy: 'title',
        sortDirection: 'asc',
        visibleTypes: ['news.article', 'events.event-record', 'poi.point-of-interest', 'surveys.survey'],
      },
      visibleTypes: ['news.article', 'events.event-record', 'poi.point-of-interest', 'surveys.survey'],
      instanceId: 'de-musterhausen',
    };

    const { result, rerender } = renderHook(
      ({ query, visibleTypes, instanceId }) => useUnifiedContentList(query, visibleTypes, instanceId, permissionActions),
      {
        initialProps,
      }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.contents.map((item) => item.id)).toEqual(['news-1', 'event-1']);
    expect(result.current.pagination).toEqual({ page: 1, pageSize: 2, total: 5 });

    const updatedProps: HookProps = {
      query: {
        page: 2,
        pageSize: 2,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        visibleTypes: ['news.article', 'events.event-record', 'poi.point-of-interest', 'surveys.survey'],
      },
      visibleTypes: ['news.article', 'events.event-record', 'poi.point-of-interest', 'surveys.survey'],
      instanceId: 'de-musterhausen',
    };

    rerender(updatedProps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.contents.map((item) => item.id)).toEqual(['news-2', 'news-1']);
    expect(listNewsMock).toHaveBeenCalledTimes(1);
    expect(listEventsMock).toHaveBeenCalledTimes(1);
    expect(listPoiMock).toHaveBeenCalledTimes(1);
    expect(listSurveysMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the first news content block headline when the news title is missing', async () => {
    const visibleTypes = ['news.article'] as const;
    const permissionActions: readonly string[] = [];
    const query = {
      page: 1,
      pageSize: 25,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
      visibleTypes,
    } as const;

    listNewsMock.mockResolvedValue({
      data: [
        {
          id: 'news-untitled',
          title: '',
          contentType: 'news.article',
          status: 'published',
          payload: {},
          author: 'Redaktion',
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-03T10:00:00.000Z',
          publishedAt: '2026-05-03T10:00:00.000Z',
          contentBlocks: [
            {
              title: 'Headline aus Block 1',
              body: 'Body',
            },
          ],
        },
      ],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    listEventsMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    listPoiMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    listSurveysMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    const { result } = renderHook(() => useUnifiedContentList(query, visibleTypes, 'de-musterhausen', permissionActions));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.contents[0]?.title).toBe('Headline aus Block 1');
  });

  it('derives per-item edit access from granted update permissions', async () => {
    const visibleTypes = ['news.article', 'events.event-record'] as const;
    const query = {
      page: 1,
      pageSize: 25,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
      visibleTypes,
    } as const;
    const permissionActions = ['news.read', 'news.update', 'events.read'] as const;

    listNewsMock.mockResolvedValue({
      data: [
        {
          id: 'news-1',
          title: 'News',
          contentType: 'news.article',
          status: 'published',
          payload: {},
          author: 'Redaktion',
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-03T10:00:00.000Z',
          publishedAt: '2026-05-03T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    listEventsMock.mockResolvedValue({
      data: [
        {
          id: 'event-1',
          title: 'Event',
          contentType: 'events.event-record',
          status: 'published',
          createdAt: '2026-05-01T08:00:00.000Z',
          updatedAt: '2026-05-04T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    listPoiMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    listSurveysMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    const { result } = renderHook(() => useUnifiedContentList(query, visibleTypes, 'de-musterhausen', permissionActions));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const eventItem = result.current.contents.find((item) => item.id === 'event-1');
    const newsItem = result.current.contents.find((item) => item.id === 'news-1');

    expect(newsItem?.access).toMatchObject({
      state: 'editable',
      canRead: true,
      canCreate: false,
      canUpdate: true,
    });
    expect(eventItem?.access).toMatchObject({
      state: 'read_only',
      canRead: true,
      canCreate: false,
      canUpdate: false,
      reasonCode: 'content_update_missing',
    });
  });

  it('short-circuits unsupported status filters without calling mainserver sources', async () => {
    const visibleTypes = ['news.article', 'events.event-record', 'poi.point-of-interest'] as const;
    const query = {
      page: 2,
      pageSize: 10,
      status: 'draft',
      sortBy: 'updatedAt',
      sortDirection: 'desc',
      visibleTypes,
    } as const;
    const permissionActions = ['news.read', 'news.create'] as const;

    const { result } = renderHook(() => useUnifiedContentList(query, visibleTypes, 'de-musterhausen', permissionActions));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.contents).toEqual([]);
    expect(result.current.pagination).toEqual({ page: 2, pageSize: 10, total: 0 });
    expect(listNewsMock).not.toHaveBeenCalled();
    expect(listEventsMock).not.toHaveBeenCalled();
    expect(listPoiMock).not.toHaveBeenCalled();
  });

  it('fetches multiple pages, narrows the requested type and preserves create access without update access', async () => {
    const visibleTypes = ['news.article', 'events.event-record'] as const;
    const query = {
      page: 1,
      pageSize: 25,
      type: 'news.article',
      sortBy: 'title',
      sortDirection: 'asc',
      visibleTypes,
    } as const;
    const permissionActions = ['news.read', 'news.create'] as const;

    listNewsMock
      .mockResolvedValueOnce({
        data: [
          {
            id: 'news-b',
            title: 'Beta',
            contentType: 'news.article',
            status: 'published',
            payload: { blocks: [1] },
            author: 'Redaktion',
            createdAt: '2026-05-01T10:00:00.000Z',
            updatedAt: '2026-05-03T10:00:00.000Z',
            publishedAt: '2026-05-03T10:00:00.000Z',
          },
        ],
        pagination: { page: 1, pageSize: 100, hasNextPage: true },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'news-a',
            title: 'Alpha',
            contentType: 'news.article',
            status: 'published',
            payload: { blocks: [2] },
            author: 'Redaktion',
            createdAt: '2026-05-01T09:00:00.000Z',
            updatedAt: '2026-05-02T10:00:00.000Z',
            publishedAt: '2026-05-02T10:00:00.000Z',
          },
        ],
        pagination: { page: 2, pageSize: 100, hasNextPage: false },
      });
    listEventsMock.mockResolvedValue({
      data: [
        {
          id: 'event-1',
          title: 'Event',
          contentType: 'events.event-record',
          status: 'published',
          createdAt: '2026-05-01T08:00:00.000Z',
          updatedAt: '2026-05-04T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    listPoiMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    const { result } = renderHook(() => useUnifiedContentList(query, visibleTypes, 'de-musterhausen', permissionActions));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(listNewsMock).toHaveBeenCalledTimes(2);
    expect(listNewsMock).toHaveBeenNthCalledWith(1, { page: 1, pageSize: 100 });
    expect(listNewsMock).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 100 });
    expect(listEventsMock).not.toHaveBeenCalled();
    expect(result.current.contents.map((item) => item.id)).toEqual(['news-a', 'news-b']);
    expect(result.current.pagination).toEqual({ page: 1, pageSize: 25, total: 2 });
    expect(result.current.contents[0]?.access).toMatchObject({
      state: 'read_only',
      canRead: true,
      canCreate: true,
      canUpdate: false,
      reasonCode: 'content_update_missing',
    });
  });

  it('loads poi-only queries without touching unrelated mainserver sources', async () => {
    const visibleTypes = ['news.article', 'events.event-record', 'poi.point-of-interest'] as const;
    const query = {
      page: 1,
      pageSize: 25,
      type: 'poi.point-of-interest',
      sortBy: 'title',
      sortDirection: 'asc',
      visibleTypes,
    } as const;

    listNewsMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });
    listEventsMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });
    listPoiMock.mockResolvedValue({
      data: [
        {
          id: 'poi-2',
          name: 'Bergwerk',
          contentType: 'poi.point-of-interest',
          status: 'published',
          createdAt: '2026-05-01T07:00:00.000Z',
          updatedAt: '2026-05-03T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const { result } = renderHook(() => useUnifiedContentList(query, visibleTypes, 'de-musterhausen'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(listNewsMock).not.toHaveBeenCalled();
    expect(listEventsMock).not.toHaveBeenCalled();
    expect(listPoiMock).toHaveBeenCalledTimes(1);
    expect(result.current.contents.map((item) => item.id)).toEqual(['poi-2']);
  });

  it('reuses fetched source data across page and sort changes until refetch is requested', async () => {
    const visibleTypes = ['news.article', 'events.event-record', 'poi.point-of-interest'] as const;
    const permissionActions = ['news.read', 'events.read', 'poi.read'] as const;

    listNewsMock.mockResolvedValue({
      data: [
        {
          id: 'news-1',
          title: 'Alpha',
          contentType: 'news.article',
          status: 'published',
          payload: {},
          author: 'Redaktion',
          createdAt: '2026-05-01T09:00:00.000Z',
          updatedAt: '2026-05-02T10:00:00.000Z',
          publishedAt: '2026-05-02T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });
    listEventsMock.mockResolvedValue({
      data: [
        {
          id: 'event-1',
          title: 'Beta Event',
          contentType: 'events.event-record',
          status: 'published',
          createdAt: '2026-05-01T08:00:00.000Z',
          updatedAt: '2026-05-04T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });
    listPoiMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    type HookProps = {
      readonly query: IamContentListQuery;
    };

    const initialQuery: IamContentListQuery = {
      page: 1,
      pageSize: 1,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
      visibleTypes,
    };

    const sortedQuery: IamContentListQuery = {
      page: 1,
      pageSize: 1,
      sortBy: 'title',
      sortDirection: 'asc',
      visibleTypes,
    };

    const pagedQuery: IamContentListQuery = {
      page: 2,
      pageSize: 1,
      sortBy: 'title',
      sortDirection: 'asc',
      visibleTypes,
    };

    const { result, rerender } = renderHook(
      ({ query }) => useUnifiedContentList(query, visibleTypes, 'de-musterhausen', permissionActions),
      {
        initialProps: {
          query: initialQuery,
        } satisfies HookProps,
      }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    rerender({ query: sortedQuery });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    rerender({ query: pagedQuery });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(listNewsMock).toHaveBeenCalledTimes(1);
    expect(listEventsMock).toHaveBeenCalledTimes(1);
    expect(listPoiMock).toHaveBeenCalledTimes(1);

    await result.current.refetch();

    await waitFor(() => {
      expect(listNewsMock).toHaveBeenCalledTimes(2);
    });
    expect(listEventsMock).toHaveBeenCalledTimes(2);
    expect(listPoiMock).toHaveBeenCalledTimes(2);
  });

  it('sorts by content type and exposes normalized fetch errors', async () => {
    const visibleTypes = ['news.article', 'events.event-record'] as const;
    const query = {
      page: 1,
      pageSize: 25,
      sortBy: 'contentType',
      sortDirection: 'asc',
      visibleTypes,
    } as const;

    listNewsMock.mockResolvedValue({
      data: [
        {
          id: 'news-1',
          title: 'News',
          contentType: 'news.article',
          status: 'published',
          payload: {},
          author: 'Redaktion',
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-03T10:00:00.000Z',
          publishedAt: '2026-05-03T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    listEventsMock.mockResolvedValue({
      data: [
        {
          id: 'event-1',
          title: 'Event',
          contentType: 'events.event-record',
          status: 'published',
          createdAt: '2026-05-01T08:00:00.000Z',
          updatedAt: '2026-05-04T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    listPoiMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    const { result, unmount } = renderHook(
      ({ currentQuery }) => useUnifiedContentList(currentQuery, visibleTypes, 'de-musterhausen'),
      {
        initialProps: {
          currentQuery: query,
        },
      }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.contents.map((item) => item.id)).toEqual(['event-1', 'news-1']);

    unmount();
    listNewsMock.mockReset();
    listEventsMock.mockReset();
    listPoiMock.mockReset();
    listEventsMock.mockRejectedValueOnce(new Error('mainserver down'));
    const errorVisibleTypes = ['events.event-record'] as const;
    const errorPermissionActions: readonly string[] = [];
    const { result: errorResult } = renderHook(() =>
      useUnifiedContentList(
        {
          ...query,
          type: 'events.event-record',
        },
        errorVisibleTypes,
        'de-musterhausen',
        errorPermissionActions
      )
    );

    await waitFor(() => {
      expect(errorResult.current.error?.message).toBe('mainserver down');
    });

    expect(errorResult.current.contents).toEqual([]);
    expect(errorResult.current.isLoading).toBe(false);
    expect(errorResult.current.error?.name).toBe('IamHttpError');
    expect(errorResult.current.error?.status).toBe(500);
    expect(errorResult.current.error?.code).toBe('internal_error');
  });
});
