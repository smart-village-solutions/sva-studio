import { createMediaEditingDocument } from '@sva/media';
import { describe, expect, it, vi } from 'vitest';

import {
  completeHostMediaUpload,
  initializeHostMediaUpload,
  uploadHostMediaFile,
  waitForHostMediaUpload,
} from './media-upload-client.js';

it('resumes transferred bytes after an uncertain completion without initializing or PUT again', async () => {
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { assetId: 'copy', uploadSessionId: 'session', status: 'processed' },
        }),
        { status: 200 }
      )
    );
  const input = {
    fetch,
    file: new File(['bytes'], 'copy.png', { type: 'image/png' }),
    transferred: { assetId: 'copy', uploadSessionId: 'session' },
  };
  await expect(uploadHostMediaFile(input)).rejects.toThrow('network');
  await expect(uploadHostMediaFile(input)).resolves.toMatchObject({ assetId: 'copy' });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(
    fetch.mock.calls.every(([url]) => String(url).includes('/upload-sessions/session/complete'))
  ).toBe(true);
});

describe('media upload client', () => {
  it.each([false, true])(
    'transfers the private local foundation before completing an edited upload (source failure: %s)',
    async (failSource) => {
      const document = createMediaEditingDocument({ annotations: {} });
      const sourceFile = new File(['original'], 'source.jpg', { type: 'image/jpeg' });
      const outputFile = new File(['output'], 'edited.png', { type: 'image/png' });
      const calls: string[] = [];
      let payload: unknown;
      const fetch = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
        const url = String(request);
        calls.push(url);
        if (url.endsWith('/upload-sessions')) {
          payload = JSON.parse(String(init?.body));
          return Response.json({
            data: {
              assetId: 'copy',
              uploadSessionId: 'session',
              uploadUrl: 'https://storage.test/output',
              method: 'PUT',
              headers: {},
              sourceUpload: {
                uploadUrl: 'https://storage.test/source',
                method: 'PUT',
                headers: {},
              },
            },
          });
        }
        if (url === 'https://storage.test/source') {
          expect(init?.body).toBe(sourceFile);
          return new Response(null, { status: failSource ? 503 : 200 });
        }
        if (url.endsWith('/complete'))
          return Response.json({
            data: { assetId: 'copy', uploadSessionId: 'session', status: 'processed' },
          });
        expect(init?.body).toBe(outputFile);
        return new Response(null, { status: 200 });
      });
      const uploading = uploadHostMediaFile({
        fetch,
        file: outputFile,
        metadata: { title: ' Bearbeitet ', tags: [' Park '] },
        editing: { document, sourceFile },
      });
      if (failSource) await expect(uploading).rejects.toThrow('media_upload_put_failed:503');
      else await expect(uploading).resolves.toMatchObject({ assetId: 'copy' });
      expect(payload).toMatchObject({
        metadata: { title: 'Bearbeitet', tags: ['Park'] },
        editing: { document, source: { mimeType: 'image/jpeg', byteSize: sourceFile.size } },
      });
      expect(calls.filter((url) => url.endsWith('/complete'))).toHaveLength(failSource ? 0 : 1);
      expect(calls.slice(1, 3)).toEqual([
        'https://storage.test/output',
        'https://storage.test/source',
      ]);
    }
  );

  it('rejects an incomplete source-upload contract before transferring output or completing it', async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        data: {
          assetId: 'copy',
          uploadSessionId: 'session',
          uploadUrl: 'https://storage.test/output',
          headers: {},
          method: 'PUT',
        },
      })
    );
    await expect(
      uploadHostMediaFile({
        fetch,
        file: new File(['out'], 'out.png', { type: 'image/png' }),
        editing: {
          document: createMediaEditingDocument({}),
          sourceFile: new File(['source'], 'source.png', { type: 'image/png' }),
        },
      })
    ).rejects.toThrow('media_upload_source_contract_mismatch');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('rejects invalid metadata before creating server-side upload state', async () => {
    const fetch = vi.fn();
    await expect(
      initializeHostMediaUpload({
        fetch,
        payload: { mimeType: 'image/png', byteSize: 10, metadata: { title: 'a'.repeat(513) } },
      })
    ).rejects.toThrow('invalid_media_metadata:title');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports a blocked malware upload using only the stable error code', async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        data: {
          uploadStatus: 'blocked',
          processingStatus: 'failed',
          technical: {
            lastError: { code: 'media_scan_infected', message: 'scanner-internal-detail' },
          },
        },
      })
    );
    await expect(waitForHostMediaUpload({ fetch, assetId: 'asset-1' })).rejects.toMatchObject({
      code: 'media_scan_infected',
      message: 'media_scan_infected',
    });
  });

  it('returns a stable size error when initialization rejects a file before transfer', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 413 }));
    await expect(
      initializeHostMediaUpload({
        fetch,
        payload: { mimeType: 'image/jpeg', byteSize: 65 * 1024 * 1024 },
      })
    ).rejects.toMatchObject({ code: 'upload_size_exceeded' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('waits for actual ready state on the scoped asset endpoint', async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ data: { uploadStatus: 'pending', processingStatus: 'pending' } })
        )
        .mockResolvedValueOnce(
          Response.json({ data: { uploadStatus: 'processed', processingStatus: 'ready' } })
        );
      const waiting = waitForHostMediaUpload({ fetch, assetId: 'asset-1', instanceId: 'tenant-a' });
      await vi.advanceTimersByTimeAsync(1000);
      await waiting;
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/iam/media/asset-1?instanceId=tenant-a',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('times out without creating or completing another upload', async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(async () =>
        Response.json({ data: { uploadStatus: 'pending', processingStatus: 'pending' } })
      );
      const waiting = waitForHostMediaUpload({ fetch, assetId: 'asset-1' });
      const rejected = expect(waiting).rejects.toMatchObject({ code: 'media_processing_timeout' });
      await vi.advanceTimersByTimeAsync(120_000);
      await rejected;
      expect(fetch.mock.calls.every(([url]) => String(url) === '/api/v1/iam/media/asset-1')).toBe(
        true
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails immediately on terminal processing errors', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ data: { uploadStatus: 'failed', processingStatus: 'failed' } })
    );
    await expect(waitForHostMediaUpload({ fetch, assetId: 'asset-1' })).rejects.toMatchObject({
      code: 'media_processing_failed',
    });
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
          { status: 200 }
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
          { status: 200 }
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
      })
    ).resolves.toMatchObject({
      assetId: 'asset-1',
      uploadSessionId: 'upload-1',
    });

    await expect(
      completeHostMediaUpload({
        fetch: fetchMock as never,
        uploadSessionId: 'upload-1',
        instanceId: 'de-demo',
      })
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
          { status: 200 }
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
          { status: 200 }
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
      })
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
          { status: 200 }
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
      })
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
          { status: 200 }
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
          { status: 200 }
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
      })
    ).resolves.toEqual({
      assetId: 'asset-4',
      uploadSessionId: 'upload-4',
    });
  });
});
