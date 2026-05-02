import { describe, expect, it, vi } from 'vitest';

import {
  listHostMediaAssets,
  listHostMediaReferencesByTarget,
  replaceHostMediaReferences,
} from './media-picker-client.js';

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

  it('loads references by target and forwards visibility filters', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: [{ id: 'ref-1', assetId: 'asset-1', role: 'hero' }] }))
      .mockResolvedValueOnce(Response.json({ data: [{ id: 'asset-1' } satisfies { id: string }] }));

    await expect(
      listHostMediaReferencesByTarget({
        fetch: fetchMock,
        targetType: 'news',
        targetId: 'news-1',
      })
    ).resolves.toEqual([{ id: 'ref-1', assetId: 'asset-1', role: 'hero' }]);

    await listHostMediaAssets({
      fetch: fetchMock,
      visibility: 'public',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/iam/media/references?targetType=news&targetId=news-1',
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/iam/media?visibility=public', expect.any(Object));
  });

  it('throws deterministic http errors for failed media requests', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));

    await expect(listHostMediaAssets({ fetch: fetchMock })).rejects.toThrow('media_picker_http_503');
  });
});
