import { describe, expect, it, vi } from 'vitest';

import {
  completeHostMediaUpload,
  initializeHostMediaUpload,
  uploadHostMediaFile,
  waitForHostMediaUpload,
} from './media-upload-client.js';

describe('media upload client', () => {
  it('reports a blocked malware upload using only the stable error code', async () => {
    const fetch = vi.fn(async () => Response.json({ data: { uploadStatus: 'blocked', processingStatus: 'failed', technical: { lastError: { code: 'media_scan_infected', message: 'scanner-internal-detail' } } } }));
    await expect(waitForHostMediaUpload({ fetch, assetId: 'asset-1' })).rejects.toMatchObject({ code: 'media_scan_infected', message: 'media_scan_infected' });
  });

  it('returns a stable size error when initialization rejects a file before transfer', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 413 }));
    await expect(initializeHostMediaUpload({ fetch, payload: { mimeType: 'image/jpeg', byteSize: 65 * 1024 * 1024 } })).rejects.toMatchObject({ code: 'upload_size_exceeded' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('waits for actual ready state on the scoped asset endpoint', async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn().mockResolvedValueOnce(Response.json({ data: { uploadStatus: 'pending', processingStatus: 'pending' } }))
        .mockResolvedValueOnce(Response.json({ data: { uploadStatus: 'processed', processingStatus: 'ready' } }));
      const waiting = waitForHostMediaUpload({ fetch, assetId: 'asset-1', instanceId: 'tenant-a' });
      await vi.advanceTimersByTimeAsync(1000);
      await waiting;
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenCalledWith('/api/v1/iam/media/asset-1?instanceId=tenant-a', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    } finally { vi.useRealTimers(); }
  });

  it('times out without creating or completing another upload', async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(async () => Response.json({ data: { uploadStatus: 'pending', processingStatus: 'pending' } }));
      const waiting = waitForHostMediaUpload({ fetch, assetId: 'asset-1' });
      const rejected = expect(waiting).rejects.toMatchObject({ code: 'media_processing_timeout' });
      await vi.advanceTimersByTimeAsync(120_000);
      await rejected;
      expect(fetch.mock.calls.every(([url]) => String(url) === '/api/v1/iam/media/asset-1')).toBe(true);
    } finally { vi.useRealTimers(); }
  });

  it('fails immediately on terminal processing errors', async () => {
    const fetch = vi.fn(async () => Response.json({ data: { uploadStatus: 'failed', processingStatus: 'failed' } }));
    await expect(waitForHostMediaUpload({ fetch, assetId: 'asset-1' })).rejects.toMatchObject({ code: 'media_processing_failed' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('initializes and completes host-side upload sessions through the iam media contract', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/v1/iam/media/upload-sessions') {
        return new Response(
          JSON.stringify({
            data: {
              assetId: 'asset-1',
              uploadSessionId: 'upload-1',
              uploadUrl: 'https://uploads.example/asset-1',
              method: 'PUT',
              headers: { 'content-type': 'image/jpeg' },
              expiresAt: '2026-06-21T10:00:00.000Z',
              status: 'pending',
              initializedAt: '2026-06-21T09:00:00.000Z',
            },
          }),
          { status: 200 },
        );
      }
      if (url === '/api/v1/iam/media/upload-sessions/upload-1/complete?instanceId=de-demo') {
        return new Response(
          JSON.stringify({
            data: {
              assetId: 'asset-1',
              uploadSessionId: 'upload-1',
              status: 'validated',
            },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 500 });
    });

    await expect(
      initializeHostMediaUpload({
        fetch: fetchMock as never,
        payload: {
          mimeType: 'image/jpeg',
          byteSize: 1024,
          visibility: 'protected',
          instanceId: 'de-demo',
        },
      }),
    ).resolves.toMatchObject({
      assetId: 'asset-1',
      uploadSessionId: 'upload-1',
    });

    await expect(
      completeHostMediaUpload({
        fetch: fetchMock as never,
        uploadSessionId: 'upload-1',
        instanceId: 'de-demo',
      }),
    ).resolves.toEqual({
      assetId: 'asset-1',
      uploadSessionId: 'upload-1',
      status: 'validated',
    });
  });

  it('uploads a browser file through the signed-url flow and returns the registered asset id', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/v1/iam/media/upload-sessions') {
        return new Response(
          JSON.stringify({
            data: {
              assetId: 'asset-2',
              uploadSessionId: 'upload-2',
              uploadUrl: 'https://uploads.example/asset-2',
              method: 'PUT',
              headers: { 'content-type': 'image/png' },
              expiresAt: '2026-06-21T10:00:00.000Z',
              status: 'pending',
              initializedAt: '2026-06-21T09:00:00.000Z',
            },
          }),
          { status: 200 },
        );
      }
      if (url === 'https://uploads.example/asset-2') {
        expect(init?.method).toBe('PUT');
        expect(init?.body).toBeInstanceOf(File);
        return new Response(null, { status: 200 });
      }
      if (url === '/api/v1/iam/media/upload-sessions/upload-2/complete?instanceId=de-demo') {
        return new Response(
          JSON.stringify({
            data: {
              assetId: 'asset-2',
              uploadSessionId: 'upload-2',
              status: 'processed',
              previewUrl: 'https://cdn.example.test/asset-2.png',
            },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 500 });
    });

    const file = new File(['image'], 'poi.png', { type: 'image/png' });

    await expect(
      uploadHostMediaFile({
        fetch: fetchMock as never,
        file,
        visibility: 'protected',
        instanceId: 'de-demo',
      }),
    ).resolves.toEqual({
      assetId: 'asset-2',
      uploadSessionId: 'upload-2',
      previewUrl: 'https://cdn.example.test/asset-2.png',
    });
  });

  it('fails deterministically when the signed upload target rejects the file body', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/v1/iam/media/upload-sessions') {
        return new Response(
          JSON.stringify({
            data: {
              assetId: 'asset-3',
              uploadSessionId: 'upload-3',
              uploadUrl: 'https://uploads.example/asset-3',
              method: 'PUT',
              headers: {},
              expiresAt: '2026-06-21T10:00:00.000Z',
              status: 'pending',
              initializedAt: '2026-06-21T09:00:00.000Z',
            },
          }),
          { status: 200 },
        );
      }
      if (url === 'https://uploads.example/asset-3') {
        return new Response(null, { status: 500 });
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 500 });
    });

    await expect(
      uploadHostMediaFile({
        fetch: fetchMock as never,
        file: new File(['image'], 'broken.png', { type: 'image/png' }),
        instanceId: 'de-demo',
      }),
    ).rejects.toThrow('media_upload_put_failed:500');
  });

  it('passes the explicit instance context through initialize and complete requests', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/v1/iam/media/upload-sessions') {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          instanceId: 'de-demo',
          mimeType: 'image/webp',
        });
        return new Response(
          JSON.stringify({
            data: {
              assetId: 'asset-4',
              uploadSessionId: 'upload-4',
              uploadUrl: 'https://uploads.example/asset-4',
              method: 'PUT',
              headers: {},
              expiresAt: '2026-06-21T10:00:00.000Z',
              status: 'pending',
              initializedAt: '2026-06-21T09:00:00.000Z',
            },
          }),
          { status: 200 },
        );
      }
      if (url === 'https://uploads.example/asset-4') {
        return new Response(null, { status: 200 });
      }
      if (url === '/api/v1/iam/media/upload-sessions/upload-4/complete?instanceId=de-demo') {
        return new Response(
          JSON.stringify({
            data: {
              assetId: 'asset-4',
              uploadSessionId: 'upload-4',
              status: 'validated',
            },
          }),
          { status: 200 },
        );
      }
      if (url === '/api/v1/iam/media/asset-4?instanceId=de-demo') {
        return Response.json({ data: { uploadStatus: 'processed', processingStatus: 'ready' } });
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 500 });
    });

    await expect(
      uploadHostMediaFile({
        fetch: fetchMock as never,
        file: new File(['img'], 'ctx.webp', { type: 'image/webp' }),
        instanceId: 'de-demo',
      }),
    ).resolves.toEqual({
      assetId: 'asset-4',
      uploadSessionId: 'upload-4',
    });
  });
});
