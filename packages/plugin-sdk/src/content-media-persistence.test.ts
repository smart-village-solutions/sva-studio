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
});

