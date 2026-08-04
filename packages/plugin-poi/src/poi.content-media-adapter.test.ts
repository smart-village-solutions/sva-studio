import { describe, expect, it } from 'vitest';

import { poiMediaContentsToUsages, poiMediaUsagesToContents } from './poi.content-media-adapter.js';

describe('POI content media adapter', () => {
  it('roundtrips supported Mainserver fields and preserves additional dimensions', () => {
    const source = [{
      sourceUrl: { url: 'https://example.test/image.jpg', description: 'Alt' },
      captionText: 'Caption',
      copyright: 'Credit',
      contentType: 'image',
      width: 800,
      height: 600,
    }];
    expect(poiMediaUsagesToContents(poiMediaContentsToUsages(source))).toEqual(source);
  });
});
