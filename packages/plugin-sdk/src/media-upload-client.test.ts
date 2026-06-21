import { describe, expect, it, vi } from 'vitest';

import {
  completeHostMediaUpload,
  initializeHostMediaUpload,
  uploadHostMediaFile,
} from './media-upload-client.js';

describe('media upload client', () => {
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
      if (url === '/api/v1/iam/media/upload-sessions/upload-1/complete') {
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
      if (url === '/api/v1/iam/media/upload-sessions/upload-2/complete') {
        return new Response(
          JSON.stringify({
            data: {
              assetId: 'asset-2',
              uploadSessionId: 'upload-2',
              status: 'processed',
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
      }),
    ).resolves.toEqual({
      assetId: 'asset-2',
      uploadSessionId: 'upload-2',
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
      }),
    ).rejects.toThrow('media_upload_put_failed:500');
  });
});
