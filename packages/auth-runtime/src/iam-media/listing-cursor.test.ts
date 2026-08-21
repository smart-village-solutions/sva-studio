import { describe, expect, it } from 'vitest';

import { decodeMediaListingCursor, encodeMediaListingCursor } from './listing-cursor.js';

describe('media listing cursor', () => {
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
