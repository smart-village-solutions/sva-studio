import { describe, expect, it } from 'vitest';

import {
  poiAssetToUsage,
  poiMediaContentsToUsages,
  poiMediaUsagesToContents,
} from '../src/poi.content-media-adapter.js';

describe('POI content media adapter', () => {
  it('roundtrips supported Mainserver fields and preserves additional dimensions', () => {
    const source = [
      {
        sourceUrl: { url: 'https://example.test/image.jpg', description: 'Alt' },
        captionText: 'Caption',
        copyright: 'Credit',
        contentType: 'image',
        width: 800,
        height: 600,
      },
    ];
    expect(poiMediaUsagesToContents(poiMediaContentsToUsages(source))).toEqual(source);
  });

  it('uses safe defaults for sparse media and reference alignments', () => {
    expect(poiMediaContentsToUsages([{}, {}], [{ status: 'synced' }])).toMatchObject([
      { assetId: undefined, persistentUrl: '', referenceStatus: 'synced' },
      { assetId: undefined, persistentUrl: '', referenceStatus: 'missing' },
    ]);
    expect(
      poiMediaUsagesToContents([
        {
          uiId: 'manual',
          persistentUrl: '',
          altText: '',
          caption: '',
          credit: '',
          role: 'gallery_item',
          sortOrder: 0,
          referenceStatus: 'pending',
          additionalData: { original: 'invalid', contentType: 1, width: 'wide', height: null },
        },
      ])
    ).toEqual([
      {
        sourceUrl: { url: '', description: '' },
        captionText: '',
        copyright: '',
        contentType: undefined,
        width: undefined,
        height: undefined,
      },
    ]);
  });

  it('creates a linked usage with filename and title metadata fallbacks', () => {
    expect(
      poiAssetToUsage({
        assetId: 'asset-1',
        persistentUrl: 'https://example.test/image.jpg',
        previewUrl: null,
        sortOrder: 2,
        metadata: {
          title: 'Titel',
          fileName: 'image.jpg',
          altText: '',
          description: '',
          copyright: '',
          license: '',
        },
      })
    ).toMatchObject({
      previewUrl: undefined,
      altText: 'image.jpg',
      caption: 'Titel',
      referenceStatus: 'pending',
    });
  });
});
