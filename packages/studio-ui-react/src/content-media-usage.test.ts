import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  contentMediaUsageToReference,
  createContentMediaUiId,
  createManualContentMediaUsage,
  isPersistableContentMediaUrl,
  moveContentMediaUsage,
} from './content-media-usage.js';
import {
  contentMediaUsagesToLocalDrafts,
  resolveContentMediaUsageDrafts,
} from './content-media-drafts.js';

describe('content media usage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the Web Crypto UUID as its UI identity', () => {
    const uiId = '722328a4-8731-47b0-a7ea-b544be7dd527';
    const randomUUID = vi.fn(() => uiId);
    vi.stubGlobal('crypto', { randomUUID });

    expect(createContentMediaUiId()).toBe(uiId);
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('fails closed when the runtime does not provide crypto.randomUUID', () => {
    vi.stubGlobal('crypto', {});

    expect(() => createContentMediaUiId()).toThrow(TypeError);
    expect(() => createContentMediaUiId()).toThrow(
      'Content media UI IDs require crypto.randomUUID'
    );
  });

  it('keeps UI identity while normalizing order', () => {
    const first = { ...createManualContentMediaUsage(), uiId: 'first', sortOrder: 0 };
    const second = { ...createManualContentMediaUsage(), uiId: 'second', sortOrder: 1 };

    expect(moveContentMediaUsage([first, second], 1, 0)).toMatchObject([
      { uiId: 'second', sortOrder: 0 },
      { uiId: 'first', sortOrder: 1 },
    ]);
    expect(moveContentMediaUsage([first, second], -1, 0)).toEqual([first, second]);
    expect(moveContentMediaUsage([first, second], 0, 2)).toEqual([first, second]);
    expect(moveContentMediaUsage([first, second], 0, 0)).toEqual([first, second]);
  });

  it('rejects insecure and signed URLs', () => {
    expect(isPersistableContentMediaUrl('https://cdn.example.test/image.jpg')).toBe(true);
    expect(isPersistableContentMediaUrl('http://cdn.example.test/image.jpg')).toBe(false);
    expect(
      isPersistableContentMediaUrl('https://cdn.example.test/image.jpg?X-Amz-Signature=secret')
    ).toBe(false);
    expect(
      isPersistableContentMediaUrl('https://cdn.example.test/image.jpg?X-Amz-Expires=900')
    ).toBe(false);
    expect(
      isPersistableContentMediaUrl('https://cdn.example.test/image.jpg?sv=2024-11-04&sig=secret')
    ).toBe(false);
    expect(isPersistableContentMediaUrl('https://user:secret@cdn.example.test/image.jpg')).toBe(
      false
    );
    expect(isPersistableContentMediaUrl('https://cdn.example.test/image.jpg?width=1280')).toBe(
      true
    );
    expect(isPersistableContentMediaUrl('not a url')).toBe(false);
  });

  it('creates references only for asset-backed usages', () => {
    const manual = createManualContentMediaUsage();
    expect(contentMediaUsageToReference(manual)).toBeNull();
    expect(
      contentMediaUsageToReference({
        ...manual,
        assetId: 'asset-1',
        role: 'gallery_item',
        sortOrder: 2,
      })
    ).toEqual({
      assetId: 'asset-1',
      role: 'gallery_item',
      sortOrder: 2,
    });
  });

  it('keeps local files out of references until the save operation resolves them', () => {
    const file = new File(['image'], 'draft.jpg', { type: 'image/jpeg' });
    const draft = {
      ...createManualContentMediaUsage(),
      uiId: 'draft-ui',
      persistentUrl: '',
      localDraft: { id: 'draft-1', file },
    };

    expect(contentMediaUsageToReference(draft)).toBeNull();
    expect(contentMediaUsagesToLocalDrafts([draft])).toEqual([
      {
        draftId: 'draft-1',
        file,
        role: 'gallery_item',
        sortOrder: 0,
      },
    ]);
    expect(
      resolveContentMediaUsageDrafts(
        [draft],
        [
          {
            draftId: 'draft-1',
            assetId: 'asset-1',
            persistentUrl: 'https://media.test/asset-1.jpg',
          },
        ]
      )
    ).toEqual([
      expect.objectContaining({
        assetId: 'asset-1',
        persistentUrl: 'https://media.test/asset-1.jpg',
        referenceStatus: 'pending',
      }),
    ]);
  });
});
