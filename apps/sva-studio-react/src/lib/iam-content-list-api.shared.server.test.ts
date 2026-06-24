import { describe, expect, it } from 'vitest';

import {
  EMPTY_VISIBLE_TYPE_SENTINEL,
  createListErrorResponse,
  isMainserverContentType,
  normalizeApiErrorCode,
  readContentListQuery,
} from './iam-content-list-api.shared.js';

describe('iam content list api shared helpers', () => {
  it('normalizes list query search params and drops empty sentinels', () => {
    expect(
      readContentListQuery(
        new Request(
          `https://studio.test/api/content?page=0&pageSize=999&q=%20Suche%20&type=all&status=published&sortBy=title&sortDirection=asc&visibleType=news.article&visibleType=${EMPTY_VISIBLE_TYPE_SENTINEL}&visibleType=%20`
        )
      )
    ).toEqual({
      page: 1,
      pageSize: 100,
      q: 'Suche',
      status: 'published',
      visibleTypes: ['news.article'],
      sortBy: 'title',
      sortDirection: 'asc',
    });
  });

  it('falls back for invalid query, error, and content type values', async () => {
    expect(
      readContentListQuery(
        new Request('https://studio.test/api/content?page=abc&pageSize=-5&type=plugin.custom&status=deleted&sortBy=createdAt')
      )
    ).toEqual({
      page: 1,
      pageSize: 1,
      type: 'plugin.custom',
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
    expect(normalizeApiErrorCode('forbidden')).toBe('forbidden');
    expect(normalizeApiErrorCode('unknown')).toBe('internal_error');
    expect(isMainserverContentType('events.event-record')).toBe(true);
    expect(isMainserverContentType('plugin.custom')).toBe(false);

    const response = createListErrorResponse(429, 'rate_limited', 'Zu viele Anfragen', 'req-1');
    await expect(response.json()).resolves.toEqual({
      error: { code: 'rate_limited', message: 'Zu viele Anfragen' },
      requestId: 'req-1',
    });
  });
});
