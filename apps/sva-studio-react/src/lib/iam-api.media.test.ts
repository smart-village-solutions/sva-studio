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

import {
  completeMediaUpload,
  deleteMedia,
  getMediaDelivery,
  initializeMediaUpload,
  listMedia,
  registerBucketMedia,
  updateMedia,
} from './iam-api';

describe('iam-api media helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    browserLoggerMock.debug.mockReset();
    browserLoggerMock.error.mockReset();
    browserLoggerMock.info.mockReset();
    browserLoggerMock.warn.mockReset();
  });

  it('builds canonical media list queries including explicit pagination and omits the all-visibility filter', async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ data: [], pagination: { page: 1, pageSize: 25, total: 0 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await listMedia({ search: 'hero', visibility: 'public', page: 2, pageSize: 50 });
    await listMedia({ visibility: 'all' });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/iam/media?search=hero&visibility=public&page=2&pageSize=50',
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

  it('completes a media upload session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            assetId: 'asset-1',
            uploadSessionId: 'upload-1',
            status: 'processed',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await completeMediaUpload('upload-1');

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/iam/media/upload-sessions/upload-1/complete',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        }),
      })
    );
    expect(requestInit.body).toBeUndefined();
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

  it('posts bucket registration payloads to the dedicated endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'asset-registered' } }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'media-idempotency-2' });

    await registerBucketMedia({
      storageKey: 'cms_uploads/photo.jpg',
      fileName: 'photo.jpg',
      byteSize: 42,
      mimeType: 'image/jpeg',
      visibility: 'public',
      metadata: { title: 'photo' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/iam/media/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          storageKey: 'cms_uploads/photo.jpg',
          fileName: 'photo.jpg',
          byteSize: 42,
          mimeType: 'image/jpeg',
          visibility: 'public',
          metadata: { title: 'photo' },
        }),
      })
    );
  });
});
