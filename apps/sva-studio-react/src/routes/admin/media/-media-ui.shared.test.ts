import { describe, expect, it } from 'vitest';

import { decodeBucketMediaId, encodeBucketMediaId } from './-media-ui.shared.js';

describe('bucket media id encoding', () => {
  it('round-trips non-ascii storage keys', () => {
    const storageKey = 'cms_uploads/äöü/straße und café.jpg';

    const encoded = encodeBucketMediaId(storageKey);

    expect(decodeBucketMediaId(encoded)).toBe(storageKey);
  });
});
