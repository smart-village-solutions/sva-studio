import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IamContentListQuery } from '@sva/core';

import { useUnifiedContentList } from './use-unified-content-list';

const listNewsMock = vi.fn();
const listEventsMock = vi.fn();
const listPoiMock = vi.fn();

vi.mock('@sva/plugin-news', () => ({
  listNews: (...args: unknown[]) => listNewsMock(...args),
}));

vi.mock('@sva/plugin-events', () => ({
  listEvents: (...args: unknown[]) => listEventsMock(...args),
}));

vi.mock('@sva/plugin-poi', () => ({
  listPoi: (...args: unknown[]) => listPoiMock(...args),
}));

describe('useUnifiedContentList', () => {
  beforeEach(() => {
    listNewsMock.mockReset();
    listEventsMock.mockReset();
    listPoiMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads mainserver-backed content items, filters them and paginates the merged result', async () => {
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
        visibleTypes: ['news.article', 'events.event-record', 'poi.point-of-interest'],
      },
      visibleTypes: ['news.article', 'events.event-record', 'poi.point-of-interest'],
      instanceId: 'de-musterhausen',
    };

    const { result, rerender } = renderHook(
      ({ query, visibleTypes, instanceId }) => useUnifiedContentList(query, visibleTypes, instanceId),
      {
        initialProps,
      }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.contents.map((item) => item.id)).toEqual(['news-1', 'event-1']);
    expect(result.current.pagination).toEqual({ page: 1, pageSize: 2, total: 4 });

    const updatedProps: HookProps = {
      query: {
        page: 2,
        pageSize: 2,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        visibleTypes: ['news.article', 'events.event-record', 'poi.point-of-interest'],
      },
      visibleTypes: ['news.article', 'events.event-record', 'poi.point-of-interest'],
      instanceId: 'de-musterhausen',
    };

    rerender(updatedProps);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.contents.map((item) => item.id)).toEqual(['news-1', 'poi-1']);
    expect(listNewsMock).toHaveBeenCalled();
    expect(listEventsMock).toHaveBeenCalled();
    expect(listPoiMock).toHaveBeenCalled();
  });

  it('falls back to the first news content block headline when the news title is missing', async () => {
    const visibleTypes = ['news.article'] as const;

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

    const { result } = renderHook(() =>
      useUnifiedContentList(
        {
          page: 1,
          pageSize: 25,
          sortBy: 'updatedAt',
          sortDirection: 'desc',
          visibleTypes,
        },
        visibleTypes,
        'de-musterhausen'
      )
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.contents[0]?.title).toBe('Headline aus Block 1');
  });

  it('derives per-item edit access from granted update permissions', async () => {
    const visibleTypes = ['news.article', 'events.event-record'] as const;

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

    const { result } = renderHook(() =>
      useUnifiedContentList(
        {
          page: 1,
          pageSize: 25,
          sortBy: 'updatedAt',
          sortDirection: 'desc',
          visibleTypes,
        },
        visibleTypes,
        'de-musterhausen',
        ['news.read', 'news.update', 'events.read']
      )
    );

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
});
