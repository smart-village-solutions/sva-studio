import { describe, expect, it } from 'vitest';

import {
  projectAssetToMediaUsage,
  projectImagesToMediaUsages,
  projectMediaUsagesToImages,
  resolveProjectPersistentDeliveryUrl,
} from '../src/projects.content-media-adapter.js';

describe('projects content media adapter', () => {
  it('preserves known and unknown image fields while deriving contiguous positions', () => {
    const images = [
      {
        url: ' https://cdn.example.test/one.jpg ',
        altText: ' One ',
        caption: ' Caption ',
        credits: ' Credits ',
        position: 8,
        futureField: { retained: true },
      },
    ];
    const usages = projectImagesToMediaUsages(images);
    const reordered = [{ ...usages[0]!, sortOrder: 9 }, { ...usages[0]!, uiId: 'copy' }];

    expect(projectMediaUsagesToImages(reordered)).toEqual([
      expect.objectContaining({
        url: 'https://cdn.example.test/one.jpg',
        altText: 'One',
        caption: 'Caption',
        credits: 'Credits',
        position: 0,
        futureField: { retained: true },
      }),
      expect.objectContaining({ position: 1, futureField: { retained: true } }),
    ]);
  });

  it('aligns linked assets and builds a snapshot-backed linked usage', () => {
    const usage = projectAssetToMediaUsage({
      assetId: 'asset-1',
      persistentUrl: 'https://cdn.example.test/asset-1.jpg',
      previewUrl: 'https://preview.example.test/asset-1.jpg',
      metadata: {
        title: 'Title', fileName: 'image.jpg', altText: 'Alt', description: 'Caption',
        copyright: 'Credits', license: 'CC BY',
      },
      sortOrder: 2,
    });

    expect(usage).toMatchObject({
      assetId: 'asset-1', role: 'gallery_item', sortOrder: 2,
      altText: 'Alt', caption: 'Caption', credit: 'Credits', license: 'CC BY',
      referenceStatus: 'pending',
      assetSnapshot: { persistentUrl: 'https://cdn.example.test/asset-1.jpg' },
    });
  });

  it('accepts only explicitly public, non-signed delivery URLs', () => {
    expect(resolveProjectPersistentDeliveryUrl({ deliveryUrl: 'https://cdn.example.test/image.jpg', isPublicUrl: true })).toBe('https://cdn.example.test/image.jpg');
    expect(resolveProjectPersistentDeliveryUrl({ deliveryUrl: 'https://cdn.example.test/image.jpg', isPublicUrl: false })).toBeNull();
    expect(resolveProjectPersistentDeliveryUrl({ deliveryUrl: 'https://cdn.example.test/image.jpg?X-Amz-Signature=secret', isPublicUrl: true })).toBeNull();
  });
});
