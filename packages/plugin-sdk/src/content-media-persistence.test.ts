import { describe, expect, it, vi } from 'vitest';

import {
  alignHostMediaReferencesByOrder,
  ContentMediaSaveError,
  saveContentWithHostMediaReferences,
} from './content-media-persistence.js';

describe('content media persistence', () => {
  const processingSave = (pending: boolean) => {
    let reads = 0;
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url.endsWith('/content-save-operations')) return Response.json({ data: { id: 'operation-1' } });
      if (url.endsWith('/upload-sessions')) return Response.json({ data: {
        assetId: 'asset-new', uploadSessionId: 'session-1', uploadUrl: 'https://storage.test/file', method: 'PUT', headers: {},
      } });
      if (url.includes('/complete')) return Response.json({ data: { assetId: 'asset-new', uploadSessionId: 'session-1', status: 'processing' } });
      if (url.endsWith('/media/asset-new')) {
        reads++;
        return Response.json({ data: { uploadStatus: !pending && reads > 1 ? 'processed' : 'pending', processingStatus: !pending && reads > 1 ? 'ready' : 'pending' } });
      }
      if (url.endsWith('/delivery')) return Response.json({ data: { deliveryUrl: 'https://cdn.test/asset-new.jpg' } });
      return Response.json({ data: {} });
    });
    const saveContent = vi.fn(async () => ({ id: 'content-1' }));
    const file = new File(['image'], 'file.jpg', { type: 'image/jpeg' });
    const input = { fetch, saveContent, getTargetId: (saved: { id: string }) => saved.id, targetType: 'news',
      references: [{ assetId: 'library-existing', role: 'header_image' }],
      drafts: [{ draftId: 'draft-1', file, role: 'teaser_image' }] };
    return { fetch, saveContent, input };
  };

  it('waits before delivery resolution and content persistence, using a permanent ready URL', async () => {
    vi.useFakeTimers();
    try {
      const { fetch, saveContent, input } = processingSave(false);
      const saving = saveContentWithHostMediaReferences(input);
      await vi.advanceTimersByTimeAsync(0);
      expect(saveContent).not.toHaveBeenCalled();
      expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/delivery'))).toBe(false);
      await vi.advanceTimersByTimeAsync(1000);
      await saving;
      expect(saveContent).toHaveBeenCalledWith([expect.objectContaining({ persistentUrl: 'https://cdn.test/asset-new.jpg' })], expect.anything());
    } finally { vi.useRealTimers(); }
  });

  it('abandons only provisional uploads on timeout, preserving local drafts and existing library references', async () => {
    vi.useFakeTimers();
    try {
      const { fetch, saveContent, input } = processingSave(true);
      const originalDrafts = [...input.drafts];
      const saving = saveContentWithHostMediaReferences(input);
      const rejected = expect(saving).rejects.toMatchObject({ code: 'media_processing_timeout' });
      await vi.advanceTimersByTimeAsync(120_000);
      await rejected;
      expect(saveContent).not.toHaveBeenCalled();
      expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/operation-1/abandon'))).toBe(true);
      expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/delivery') || String(url).endsWith('/commit'))).toBe(false);
      expect(input.drafts).toEqual(originalDrafts);
      expect(input.references).toEqual([{ assetId: 'library-existing', role: 'header_image' }]);
    } finally { vi.useRealTimers(); }
  });

  it('saves the content before replacing references', async () => {
    const calls: string[] = [];
    const fetch = vi.fn(async () => {
      calls.push('references');
      return new Response(
        JSON.stringify({ data: { targetType: 'news', targetId: '1', references: [] } }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });
    const result = await saveContentWithHostMediaReferences({
      fetch,
      saveContent: async () => {
        calls.push('content');
        return { id: '1' };
      },
      getTargetId: (saved) => saved.id,
      targetType: 'news',
      references: [],
    });
    expect(result.status).toBe('complete');
    expect(calls).toEqual(['content', 'references']);
  });

  it('returns an idempotent reference-only retry after a partial failure', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { targetType: 'news', targetId: '1', references: [] } }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );
    const saveContent = vi.fn(async () => ({ id: '1' }));
    const result = await saveContentWithHostMediaReferences({
      fetch,
      saveContent,
      getTargetId: (saved) => saved.id,
      targetType: 'news',
      references: [],
    });
    expect(result.status).toBe('reference_failed');
    if (result.status === 'reference_failed') await result.retryReferenceSync();
    expect(saveContent).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('uploads local drafts only during save and commits them after content persistence', async () => {
    const calls: string[] = [];
    const requestBodies: unknown[] = [];
    const fetch = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = String(request);
      calls.push(url);
      if (typeof init?.body === 'string') requestBodies.push(JSON.parse(init.body));
      if (url.endsWith('/content-save-operations')) {
        return Response.json(
          {
            data: {
              id: 'operation-1',
              targetType: 'news',
              status: 'preparing',
              expiresAt: 'later',
            },
          },
          { status: 201 }
        );
      }
      if (url.endsWith('/upload-sessions')) {
        return Response.json(
          {
            data: {
              assetId: 'asset-1',
              uploadSessionId: 'upload-1',
              uploadUrl: 'https://storage.test/upload',
              method: 'PUT',
              headers: {},
              expiresAt: 'later',
              status: 'pending',
              initializedAt: 'now',
            },
          },
          { status: 201 }
        );
      }
      if (url === 'https://storage.test/upload') return new Response(null, { status: 200 });
      if (url.includes('/upload-sessions/upload-1/complete')) {
        return Response.json({
          data: { assetId: 'asset-1', uploadSessionId: 'upload-1', status: 'processed' },
        });
      }
      if (url.includes('/media/asset-1/delivery')) {
        return Response.json({
          data: {
            deliveryUrl: 'https://media.test/asset-1.jpg',
            expiresAt: 'later',
            isPublicUrl: true,
          },
        });
      }
      return Response.json({ data: {} });
    });
    const phases: string[] = [];
    const saveContent = vi.fn(async (drafts, context) => {
      calls.push('content');
      expect(drafts).toEqual([
        expect.objectContaining({
          draftId: '00000000-0000-4000-8000-000000000001',
          assetId: 'asset-1',
          persistentUrl: 'https://media.test/asset-1.jpg',
        }),
      ]);
      expect(context).toEqual({ operationId: 'operation-1' });
      return { id: 'news-1' };
    });

    await expect(
      saveContentWithHostMediaReferences({
        fetch,
        saveContent,
        getTargetId: (saved) => saved.id,
        targetType: 'news',
        references: [],
        onPhaseChange: (phase) => phases.push(phase),
        drafts: [
          {
            draftId: '00000000-0000-4000-8000-000000000001',
            file: new File(['image'], 'image.jpg', { type: 'image/jpeg' }),
            role: 'gallery_item',
            sortOrder: 0,
          },
        ],
      })
    ).resolves.toMatchObject({
      status: 'complete',
      saved: { id: 'news-1' },
      resolutions: [
        {
          draftId: '00000000-0000-4000-8000-000000000001',
          assetId: 'asset-1',
          persistentUrl: 'https://media.test/asset-1.jpg',
        },
      ],
    });

    expect(calls.indexOf('content')).toBeGreaterThan(
      calls.findIndex((call) => call.includes('/references'))
    );
    expect(calls.findIndex((call) => call.endsWith('/content-saved'))).toBeGreaterThan(
      calls.indexOf('content')
    );
    expect(calls.at(-1)).toContain('/commit');
    expect(phases).toEqual(['uploading', 'saving_content', 'linking_media']);
    expect(requestBodies[0]).toEqual(
      expect.objectContaining({ operationId: expect.stringMatching(/^[0-9a-f-]{36}$/iu) })
    );
  });

  it('marks an ambiguous provider outcome for reconciliation instead of deleting media', async () => {
    const urls: string[] = [];
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      urls.push(url);
      if (url.endsWith('/content-save-operations')) {
        return Response.json(
          {
            data: {
              id: 'operation-1',
              targetType: 'news',
              status: 'preparing',
              expiresAt: 'later',
            },
          },
          { status: 201 }
        );
      }
      if (url.endsWith('/upload-sessions')) {
        return Response.json(
          {
            data: {
              assetId: 'asset-1',
              uploadSessionId: 'upload-1',
              uploadUrl: 'https://storage.test/upload',
              method: 'PUT',
              headers: {},
              expiresAt: 'later',
              status: 'pending',
              initializedAt: 'now',
            },
          },
          { status: 201 }
        );
      }
      if (url === 'https://storage.test/upload') return new Response(null, { status: 200 });
      if (url.includes('/upload-sessions/upload-1/complete'))
        return Response.json({
          data: { assetId: 'asset-1', uploadSessionId: 'upload-1', status: 'processed' },
        });
      if (url.includes('/media/asset-1/delivery'))
        return Response.json({
          data: {
            deliveryUrl: 'https://media.test/asset-1.jpg',
            expiresAt: 'later',
            isPublicUrl: true,
          },
        });
      return Response.json({ data: {} });
    });

    const promise = saveContentWithHostMediaReferences({
      fetch,
      saveContent: async () => {
        throw new TypeError('network response lost');
      },
      getTargetId: () => 'unused',
      targetType: 'news',
      references: [],
      drafts: [
        {
          draftId: '00000000-0000-4000-8000-000000000001',
          file: new File(['image'], 'image.jpg', { type: 'image/jpeg' }),
          role: 'gallery_item',
        },
      ],
    });

    await expect(promise).rejects.toMatchObject<Partial<ContentMediaSaveError>>({
      name: 'ContentMediaSaveError',
      status: 'outcome_unknown',
      operationId: 'operation-1',
    });
    expect(urls.some((url) => url.endsWith('/outcome-unknown'))).toBe(true);
    expect(urls.some((url) => url.endsWith('/abandon'))).toBe(false);
  });

  it('abandons safely rejected provider writes and reports deferred cleanup failures', async () => {
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url.endsWith('/content-save-operations'))
        return Response.json(
          {
            data: {
              id: 'operation-1',
              targetType: 'news',
              status: 'preparing',
              expiresAt: 'later',
            },
          },
          { status: 201 }
        );
      if (url.endsWith('/upload-sessions'))
        return Response.json(
          {
            data: {
              assetId: 'asset-1',
              uploadSessionId: 'upload-1',
              uploadUrl: 'https://storage.test/upload',
              method: 'PUT',
              headers: {},
              expiresAt: 'later',
              status: 'pending',
              initializedAt: 'now',
            },
          },
          { status: 201 }
        );
      if (url === 'https://storage.test/upload') return new Response(null, { status: 200 });
      if (url.includes('/upload-sessions/upload-1/complete'))
        return Response.json({
          data: { assetId: 'asset-1', uploadSessionId: 'upload-1', status: 'processed' },
        });
      if (url.includes('/media/asset-1/delivery'))
        return Response.json({
          data: {
            deliveryUrl: 'https://media.test/asset-1.jpg',
            expiresAt: 'later',
            isPublicUrl: true,
          },
        });
      if (url.endsWith('/abandon'))
        return Response.json({ error: 'cleanup unavailable' }, { status: 503 });
      return Response.json({ data: {} });
    });

    await expect(
      saveContentWithHostMediaReferences({
        fetch,
        saveContent: async () => {
          throw Object.assign(new Error('validation rejected'), { httpStatus: 422 });
        },
        getTargetId: () => 'unused',
        targetType: 'news',
        references: [],
        drafts: [
          {
            draftId: '00000000-0000-4000-8000-000000000001',
            file: new File(['image'], 'image.jpg', { type: 'image/jpeg' }),
            role: 'gallery_item',
          },
        ],
      })
    ).rejects.toMatchObject<Partial<ContentMediaSaveError>>({
      status: 'cleanup_pending',
      operationId: 'operation-1',
    });
  });

  it('aligns references conservatively by role and sort order', () => {
    expect(
      alignHostMediaReferencesByOrder({
        itemCount: 2,
        role: 'gallery_item',
        references: [{ assetId: 'asset-2', role: 'gallery_item', sortOrder: 1 }],
      })
    ).toEqual([{ status: 'missing' }, { assetId: 'asset-2', status: 'synced' }]);
  });

  it('preserves synchronized items and appends extra references', () => {
    expect(
      alignHostMediaReferencesByOrder({
        itemCount: 1,
        role: 'gallery_item',
        references: [
          { assetId: 'asset-1', role: 'gallery_item', sortOrder: 0 },
          { assetId: 'asset-extra', role: 'gallery_item', sortOrder: 1 },
        ],
      })
    ).toEqual([
      { assetId: 'asset-1', status: 'synced' },
      { assetId: 'asset-extra', status: 'additional' },
    ]);
  });

  it('surfaces an extra reference through an otherwise missing slot', () => {
    expect(
      alignHostMediaReferencesByOrder({
        itemCount: 2,
        role: 'gallery_item',
        references: [{ assetId: 'asset-extra', role: 'gallery_item', sortOrder: 2 }],
      })
    ).toEqual([
      { status: 'missing' },
      { status: 'missing' },
      { assetId: 'asset-extra', status: 'additional' },
    ]);
  });
});
