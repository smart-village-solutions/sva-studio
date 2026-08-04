import { describe, expect, it } from 'vitest';

import {
  cockpitCardMediaToUsages,
  cockpitCardUsagesToMedia,
} from '../src/cockpit-cards.content-media-adapter.js';

describe('cockpit card content media adapter', () => {
  it('preserves plugin-specific and unknown fields across a roundtrip', () => {
    const media = [{
      sourceUrl: { url: 'https://cdn.example.test/image.jpg', description: 'Alt text', futureSourceField: 42 },
      contentType: 'image' as const,
      captionText: 'Caption',
      copyright: 'Credit',
      futureField: { nested: true },
    }];

    expect(cockpitCardUsagesToMedia(cockpitCardMediaToUsages(media))).toEqual(media);
  });

  it('uses the canonical gallery role and continuous ordering', () => {
    const usages = cockpitCardMediaToUsages([
      { sourceUrl: { url: 'https://cdn.example.test/one.jpg' }, contentType: 'image' },
      { sourceUrl: { url: 'https://cdn.example.test/two.jpg' }, contentType: 'image' },
    ], [{ assetId: 'asset-1', status: 'synced' }]);

    expect(usages.map(({ assetId, role, sortOrder }) => ({ assetId, role, sortOrder }))).toEqual([
      { assetId: 'asset-1', role: 'gallery_item', sortOrder: 0 },
      { assetId: undefined, role: 'gallery_item', sortOrder: 1 },
    ]);
  });
});
