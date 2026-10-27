import { isGenericItemsAssetSelectable } from '../src/generic-items.detail-page.media-picker.js';
import { createEmptyMediaContent } from '../src/generic-items.detail-media-upload.js';

import { describe, expect, it } from 'vitest';

import {
  genericItemMediaContentsToUsages,
  genericItemMediaUsagesToContents,
  genericItemMediaUsagesToFormValues,
} from '../src/generic-items.content-media-adapter.js';
import { resolveGenericItemsPersistentDeliveryUrl } from '../src/generic-items.detail-page.js';

describe('generic item content media adapter', () => {
  it('preserves unknown media and source fields during a roundtrip', () => {
    const source = [
      {
        captionText: 'Caption',
        copyright: 'Credit',
        contentType: 'image',
        width: 640,
        height: 480,
        sourceUrl: {
          url: 'https://cdn.example.test/image.jpg',
          description: 'Alt',
          focalPoint: 'center',
        },
        providerData: { key: 'preserved' },
      },
    ];

    expect(genericItemMediaUsagesToContents(genericItemMediaContentsToUsages(source))).toEqual(
      source
    );
  });

  it('aligns asset references by order and uses gallery_item', () => {
    const [usage] = genericItemMediaContentsToUsages(
      [{ sourceUrl: { url: 'https://cdn.example.test/image.jpg' } }],
      [{ assetId: 'asset-1', status: 'synced' }]
    );
    expect(usage).toMatchObject({
      assetId: 'asset-1',
      role: 'gallery_item',
      sortOrder: 0,
      referenceStatus: 'synced',
    });
  });

  it('normalizes missing dimensions for form validation', () => {
    expect(
      genericItemMediaUsagesToFormValues(
        genericItemMediaContentsToUsages([
          { sourceUrl: { url: 'https://cdn.example.test/image.jpg' } },
        ])
      )
    ).toEqual([
      {
        captionText: '',
        contentType: '',
        copyright: '',
        height: '',
        sourceUrl: { description: '', url: 'https://cdn.example.test/image.jpg' },
        width: '',
      },
    ]);
  });

  it('accepts only explicitly public, non-signed delivery URLs', () => {
    expect(
      resolveGenericItemsPersistentDeliveryUrl({
        deliveryUrl: 'https://cdn.example.test/image.jpg',
        isPublicUrl: true,
      })
    ).toBe('https://cdn.example.test/image.jpg');
    expect(
      resolveGenericItemsPersistentDeliveryUrl({
        deliveryUrl: 'https://cdn.example.test/image.jpg',
        isPublicUrl: false,
      })
    ).toBeNull();
    expect(
      resolveGenericItemsPersistentDeliveryUrl({
        deliveryUrl: 'https://cdn.example.test/image.jpg?token=secret',
        isPublicUrl: true,
      })
    ).toBeNull();
  });
});

it('uses the delivery URL for selection without requiring a preview', () => {
  const asset = {
    id: 'asset-delivery',
    title: 'Image',
    fileName: 'image.jpg',
    mimeType: 'image/jpeg',
    visibility: 'public',
    previewUrl: null,
    persistentUrl: 'https://example.org/delivery.jpg',
    metadata: { title: 'Image', altText: '', description: '', copyright: '', license: '' },
  };
  expect(isGenericItemsAssetSelectable(asset, [], [])).toBe(true);
  expect(
    isGenericItemsAssetSelectable(
      { ...asset, previewUrl: 'https://example.org/preview.jpg' },
      [],
      [{ ...createEmptyMediaContent(), sourceUrl: { url: asset.persistentUrl, description: '' } }]
    )
  ).toBe(false);
});
