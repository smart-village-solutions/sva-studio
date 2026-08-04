import { describe, expect, it } from 'vitest';

import { genericItemMediaContentsToUsages, genericItemMediaUsagesToContents } from '../src/generic-items.content-media-adapter.js';
import { resolveGenericItemsPersistentDeliveryUrl } from '../src/generic-items.detail-page.js';

describe('generic item content media adapter', () => {
  it('preserves unknown media and source fields during a roundtrip', () => {
    const source = [{
      captionText: 'Caption', copyright: 'Credit', contentType: 'image', width: 640, height: 480,
      sourceUrl: { url: 'https://cdn.example.test/image.jpg', description: 'Alt', focalPoint: 'center' },
      providerData: { key: 'preserved' },
    }];

    expect(genericItemMediaUsagesToContents(genericItemMediaContentsToUsages(source))).toEqual(source);
  });

  it('aligns asset references by order and uses gallery_item', () => {
    const [usage] = genericItemMediaContentsToUsages(
      [{ sourceUrl: { url: 'https://cdn.example.test/image.jpg' } }],
      [{ assetId: 'asset-1', status: 'synced' }]
    );
    expect(usage).toMatchObject({ assetId: 'asset-1', role: 'gallery_item', sortOrder: 0, referenceStatus: 'synced' });
  });

  it('accepts only explicitly public, non-signed delivery URLs', () => {
    expect(resolveGenericItemsPersistentDeliveryUrl({ deliveryUrl: 'https://cdn.example.test/image.jpg', isPublicUrl: true })).toBe('https://cdn.example.test/image.jpg');
    expect(resolveGenericItemsPersistentDeliveryUrl({ deliveryUrl: 'https://cdn.example.test/image.jpg', isPublicUrl: false })).toBeNull();
    expect(resolveGenericItemsPersistentDeliveryUrl({ deliveryUrl: 'https://cdn.example.test/image.jpg?token=secret', isPublicUrl: true })).toBeNull();
  });
});
