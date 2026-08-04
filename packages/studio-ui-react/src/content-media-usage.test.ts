import { describe, expect, it } from 'vitest';

import {
  contentMediaUsageToReference,
  createManualContentMediaUsage,
  isPersistableContentMediaUrl,
  moveContentMediaUsage,
} from './content-media-usage.js';

describe('content media usage', () => {
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
});
