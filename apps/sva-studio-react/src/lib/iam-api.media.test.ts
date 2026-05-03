import { beforeEach, describe, expect, it, vi } from 'vitest';

const browserLoggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@sva/monitoring-client/logging', () => ({
  createBrowserLogger: () => browserLoggerMock,
}));

import { deleteMedia, getMediaDelivery, initializeMediaUpload, listMedia, updateMedia } from './iam-api';

describe('iam-api media helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    browserLoggerMock.debug.mockReset();
    browserLoggerMock.error.mockReset();
    browserLoggerMock.info.mockReset();
    browserLoggerMock.warn.mockReset();
  });

  it('builds canonical media list queries and omits the all-visibility filter', async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ data: [], pagination: { page: 1, pageSize: 25, total: 0 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await listMedia({ search: 'hero', visibility: 'public' });
    await listMedia({ visibility: 'all' });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/iam/media?search=hero&visibility=public',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/iam/media', expect.objectContaining({ credentials: 'include' }));
  });

  it('posts upload initialization payloads with JSON and idempotency headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            assetId: 'asset-1',
            uploadSessionId: 'session-1',
            uploadUrl: 'https://upload.example.test',
            method: 'PUT',
            headers: {},
            expiresAt: '2026-04-29T12:00:00.000Z',
            status: 'pending',
            initializedAt: '2026-04-29T10:00:00.000Z',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'media-idempotency-1' });

    await initializeMediaUpload({
      mimeType: 'image/webp',
      byteSize: 4096,
      visibility: 'protected',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/iam/media/upload-sessions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          mimeType: 'image/webp',
          byteSize: 4096,
          visibility: 'protected',
        }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Idempotency-Key': 'media-idempotency-1',
          'X-Requested-With': 'XMLHttpRequest',
        }),
      })
    );
  });

  it('uses the canonical delivery, update, and delete endpoints for asset detail actions', async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ data: { id: 'asset-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await getMediaDelivery('asset-1');
    await updateMedia('asset-1', {
      visibility: 'public',
      metadata: {
        title: 'Hero',
      },
    });
    await deleteMedia('asset-1');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/iam/media/asset-1/delivery',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/iam/media/asset-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          visibility: 'public',
          metadata: { title: 'Hero' },
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/iam/media/asset-1',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });
});
