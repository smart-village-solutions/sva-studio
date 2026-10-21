import { describe, expect, it } from 'vitest';

import { decodeMediaListingCursor, encodeMediaListingCursor } from './listing-cursor.js';

describe('media listing cursor', () => {
  it('binds the cursor to the normalized tag filter', () => {
    const cursor = encodeMediaListingCursor({ afterStorageKey: 'tenant-a/a' }, { tag: '  Grünes   Rathaus ' });
    expect(decodeMediaListingCursor(cursor, { tag: 'GRÜNES Rathaus' })).toEqual({ afterStorageKey: 'tenant-a/a' });
    expect(decodeMediaListingCursor(cursor, { tag: 'Park' })).toBeNull();
    expect(decodeMediaListingCursor(cursor, {})).toBeNull();
  });
  it('round-trips the last storage key with matching filters', () => {
    const cursor = encodeMediaListingCursor(
      { afterStorageKey: 'tenant-a/originals/a.jpg' },
      { search: ' originals/ ', visibility: 'public' }
    );

    expect(
      decodeMediaListingCursor(cursor, { search: 'originals/', visibility: 'public' })
    ).toEqual({ afterStorageKey: 'tenant-a/originals/a.jpg' });
  });

  it('rejects malformed cursors and filter changes', () => {
    const cursor = encodeMediaListingCursor(
      { afterStorageKey: 'tenant-a/originals/a.jpg' },
      { visibility: 'public' }
    );

    expect(decodeMediaListingCursor('not-a-cursor', {})).toBeNull();
    expect(decodeMediaListingCursor(cursor, { visibility: 'protected' })).toBeNull();
  });
});
