import { describe, expect, it, vi } from 'vitest';

import { listHostMediaAssets, replaceHostMediaReferences } from './media-picker-client.js';

describe('media picker client helpers', () => {
  it('preserves merged json headers when init uses tuple-based headers', async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: [] }));

    await listHostMediaAssets({
      fetch: fetchMock,
      search: 'logo',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/iam/media?search=logo',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.any(Headers),
      })
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = requestInit.headers as Headers;
    expect(headers.get('Accept')).toBe('application/json');
  });

  it('keeps json request headers when replacing references', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ targetType: 'news', targetId: 'news-1', references: [] })
    );

    await replaceHostMediaReferences({
      fetch: fetchMock,
      targetType: 'news',
      targetId: 'news-1',
      references: [],
    });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = requestInit.headers as Headers;
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-Requested-With')).toBe('XMLHttpRequest');
  });
});
