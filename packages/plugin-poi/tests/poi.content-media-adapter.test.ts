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

  it.each([
    { altText: 'Zentraler Alternativtext', description: 'Zentrale Bildunterschrift' },
    { altText: '', description: '' },
  ])('preserves content overrides separately from central metadata %j', (central) => {
    const usage = poiAssetToUsage({
      assetId: 'asset-1',
      persistentUrl: 'https://example.test/image.jpg',
      sortOrder: 0,
      metadata: {
        title: 'Titel im Inhalt',
        fileName: 'image.jpg',
        altText: 'Alternativtext im Inhalt',
        description: 'Bildunterschrift im Inhalt',
        copyright: 'Credit im Inhalt',
        license: 'Eigene Lizenzangabe',
      },
      centralMetadata: {
        title: 'Zentraler Titel',
        ...central,
        copyright: 'Zentraler Credit',
        license: 'CC0',
      },
    });
    expect(usage.assetSnapshot).toEqual({
      persistentUrl: 'https://example.test/image.jpg',
      altText: central.altText || 'image.jpg',
      caption: central.description || 'Zentraler Titel',
      credit: 'Zentraler Credit',
      license: 'CC0',
    });
    expect(poiMediaUsagesToContents([usage])).toEqual([
      {
        sourceUrl: {
          url: 'https://example.test/image.jpg',
          description: 'Alternativtext im Inhalt',
        },
        captionText: 'Bildunterschrift im Inhalt',
        copyright: 'Credit im Inhalt',
        contentType: 'image',
        width: undefined,
        height: undefined,
      },
    ]);
    expect(usage.license).toBe('Eigene Lizenzangabe');
  });
});
