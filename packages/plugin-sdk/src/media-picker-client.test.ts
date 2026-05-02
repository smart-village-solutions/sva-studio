import { describe, expect, it, vi } from 'vitest';

import { listHostMediaAssets, listHostMediaReferencesByTarget, replaceHostMediaReferences } from './media-picker-client.js';

describe('media picker client', () => {
  it('lists host media assets and references without leaking storage primitives into the request contract', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/iam/media?')) {
        return new Response(JSON.stringify({ data: [{ id: 'asset-1', metadata: { title: 'Titel' } }] }), { status: 200 });
      }
      if (url.includes('/api/v1/iam/media/references?')) {
        return new Response(JSON.stringify({ data: [{ id: 'ref-1', assetId: 'asset-1', role: 'teaser_image' }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });

    const assets = await listHostMediaAssets({ fetch: fetchMock as never, search: 'hero' });
    const references = await listHostMediaReferencesByTarget({
      fetch: fetchMock as never,
      targetType: 'news',
      targetId: 'news-1',
    });

    expect(assets).toEqual([{ id: 'asset-1', metadata: { title: 'Titel' } }]);
    expect(references).toEqual([{ id: 'ref-1', assetId: 'asset-1', role: 'teaser_image' }]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/iam/media?search=hero',
      expect.objectContaining({
        credentials: 'include',
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/iam/media/references?targetType=news&targetId=news-1',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('supports empty media list queries, visibility filters, and deterministic http errors', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/v1/iam/media') {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      if (url === '/api/v1/iam/media?visibility=protected') {
        return new Response(JSON.stringify({ data: [{ id: 'asset-2', visibility: 'protected' }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
    });

    await expect(listHostMediaAssets({ fetch: fetchMock as never })).resolves.toEqual([]);
    await expect(listHostMediaAssets({ fetch: fetchMock as never, visibility: 'protected' })).resolves.toEqual([
      { id: 'asset-2', visibility: 'protected' },
    ]);
    await expect(
      listHostMediaReferencesByTarget({
        fetch: fetchMock as never,
        targetType: 'poi',
        targetId: 'poi-1',
      })
    ).rejects.toThrow('media_picker_http_403');
  });

  it('replaces host media references with role-based selections only', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      return new Response(JSON.stringify({ data: JSON.parse(String(init?.body ?? '{}')) }), { status: 200 });
    });

    const response = await replaceHostMediaReferences({
      fetch: fetchMock as never,
      targetType: 'events',
      targetId: 'event-1',
      references: [{ assetId: 'asset-1', role: 'header_image', sortOrder: 0 }],
    });

    expect(response).toEqual({
      targetType: 'events',
      targetId: 'event-1',
      references: [{ assetId: 'asset-1', role: 'header_image', sortOrder: 0 }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/iam/media/references',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        body: JSON.stringify({
          targetType: 'events',
          targetId: 'event-1',
          references: [{ assetId: 'asset-1', role: 'header_image', sortOrder: 0 }],
        }),
      })
    );
  });

  it('preserves custom header inputs while still defaulting Accept', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      return new Response(
        JSON.stringify({
          data: {
            accept: headers.get('Accept'),
            trace: headers.get('X-Trace'),
          },
        }),
        { status: 200 }
      );
    });

    await replaceHostMediaReferences({
      fetch: fetchMock as never,
      targetType: 'events',
      targetId: 'event-1',
      references: [{ assetId: 'asset-1', role: 'header_image' }],
    });

    const [, replaceInit] = fetchMock.mock.calls[0] ?? [];
    const replaceHeaders = new Headers(replaceInit?.headers);
    expect(replaceHeaders.get('Accept')).toBe('application/json');
    expect(replaceHeaders.get('Content-Type')).toBe('application/json');
    expect(replaceHeaders.get('X-Requested-With')).toBe('XMLHttpRequest');

    const customHeaderFetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      return new Response(JSON.stringify({ data: [{ id: headers.get('X-Trace') }] }), { status: 200 });
    });

    await listHostMediaAssets({
      fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
        customHeaderFetchMock(input, {
          ...init,
          headers: new Headers([
            ['Accept', 'application/vnd.custom+json'],
            ['X-Trace', 'trace-1'],
          ]),
        })) as never,
    });

    const [, listInit] = customHeaderFetchMock.mock.calls[0] ?? [];
    const listHeaders = new Headers(listInit?.headers);
    expect(listHeaders.get('Accept')).toBe('application/vnd.custom+json');
    expect(listHeaders.get('X-Trace')).toBe('trace-1');
  });
});
