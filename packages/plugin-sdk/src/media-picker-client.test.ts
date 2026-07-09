import { describe, expect, it, vi } from 'vitest';

import {
  getHostMediaAsset,
  listHostMediaAssets,
  listHostMediaReferencesByTarget,
  replaceHostMediaReferences,
  updateHostMediaAsset,
} from './media-picker-client.js';

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

    const assets = await listHostMediaAssets({ fetch: fetchMock as never, search: 'hero', instanceId: 'de-demo' });
    const references = await listHostMediaReferencesByTarget({
      fetch: fetchMock as never,
      instanceId: 'de-demo',
      targetType: 'news',
      targetId: 'news-1',
    });

    expect(assets).toEqual([{ id: 'asset-1', metadata: { title: 'Titel' } }]);
    expect(references).toEqual([{ id: 'ref-1', assetId: 'asset-1', role: 'teaser_image' }]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/iam/media?search=hero&instanceId=de-demo',
      expect.objectContaining({
        credentials: 'include',
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/iam/media/references?targetType=news&targetId=news-1&instanceId=de-demo',
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

  it('loads a host media asset detail with an optional instance scope query', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => {
      return new Response(
        JSON.stringify({
          data: {
            id: 'asset-1',
            instanceId: 'de-demo',
            storageKey: 'media/asset-1',
            mediaType: 'image',
            mimeType: 'image/jpeg',
            byteSize: 1234,
            visibility: 'public',
            uploadStatus: 'processed',
            processingStatus: 'ready',
            metadata: { title: 'Titel' },
            technical: {},
            previewUrl: 'https://cdn.example.test/media/asset-1.jpg',
          },
        }),
        { status: 200 }
      );
    });

    await expect(
      getHostMediaAsset({
        fetch: fetchMock as never,
        assetId: 'asset-1',
        instanceId: 'de-demo',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'asset-1',
        instanceId: 'de-demo',
        previewUrl: 'https://cdn.example.test/media/asset-1.jpg',
      })
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/iam/media/asset-1?instanceId=de-demo',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('replaces host media references with role-based selections only', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      return new Response(JSON.stringify({ data: JSON.parse(String(init?.body ?? '{}')) }), { status: 200 });
    });

    const response = await replaceHostMediaReferences({
      fetch: fetchMock as never,
      instanceId: 'de-demo',
      targetType: 'events',
      targetId: 'event-1',
      references: [{ assetId: 'asset-1', role: 'header_image', sortOrder: 0 }],
    });

    expect(response).toEqual({
      instanceId: 'de-demo',
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
          instanceId: 'de-demo',
          targetType: 'events',
          targetId: 'event-1',
          references: [{ assetId: 'asset-1', role: 'header_image', sortOrder: 0 }],
        }),
      })
    );
  });

  it('sends the instance id in the metadata update payload', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      return new Response(JSON.stringify({ data: JSON.parse(String(init?.body ?? '{}')) }), { status: 200 });
    });

    const response = await updateHostMediaAsset({
      fetch: fetchMock as never,
      assetId: 'asset-1',
      instanceId: 'de-demo',
      visibility: 'public',
      metadata: {
        title: 'Aktualisiert',
        altText: null,
      },
    });

    expect(response).toEqual({
      instanceId: 'de-demo',
      visibility: 'public',
      metadata: {
        title: 'Aktualisiert',
        altText: null,
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/iam/media/asset-1?instanceId=de-demo',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        body: JSON.stringify({
          instanceId: 'de-demo',
          visibility: 'public',
          metadata: {
            title: 'Aktualisiert',
            altText: null,
          },
        }),
      })
    );
  });
});
