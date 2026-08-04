import { describe, expect, it, vi } from 'vitest';

import { alignHostMediaReferencesByOrder, saveContentWithHostMediaReferences } from './content-media-persistence.js';

describe('content media persistence', () => {
  it('saves the content before replacing references', async () => {
    const calls: string[] = [];
    const fetch = vi.fn(async () => {
      calls.push('references');
      return new Response(JSON.stringify({ data: { targetType: 'news', targetId: '1', references: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
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
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { targetType: 'news', targetId: '1', references: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
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

  it('aligns references conservatively by role and sort order', () => {
    expect(alignHostMediaReferencesByOrder({
      itemCount: 2,
      role: 'gallery_item',
      references: [{ assetId: 'asset-2', role: 'gallery_item', sortOrder: 1 }],
    })).toEqual([{ status: 'missing' }, { assetId: 'asset-2', status: 'synced' }]);
  });

  it('does not relabel a synchronized item when an extra reference exists', () => {
    expect(alignHostMediaReferencesByOrder({
      itemCount: 1,
      role: 'gallery_item',
      references: [
        { assetId: 'asset-1', role: 'gallery_item', sortOrder: 0 },
        { assetId: 'asset-extra', role: 'gallery_item', sortOrder: 1 },
      ],
    })).toEqual([{ assetId: 'asset-1', status: 'synced' }]);
  });

  it('surfaces an extra reference through an otherwise missing slot', () => {
    expect(alignHostMediaReferencesByOrder({
      itemCount: 2,
      role: 'gallery_item',
      references: [{ assetId: 'asset-extra', role: 'gallery_item', sortOrder: 2 }],
    })).toEqual([{ status: 'missing' }, { status: 'additional' }]);
  });
});
