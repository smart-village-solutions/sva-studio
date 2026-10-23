import { describe, expect, it } from 'vitest';

import {
  mediaLiterals,
  resolveMediaFocusCrop,
  type MediaAsset,
  type MediaDeletionDecision,
  type MediaMetadata,
  type MediaReference,
  type MediaVariant,
} from './index.js';

describe('media type contracts', () => {
  it('publishes the canonical literal value sets for runtime consumers', () => {
    expect(mediaLiterals.types).toEqual(['image']);
    expect(mediaLiterals.visibilities).toEqual(['public', 'protected']);
    expect(mediaLiterals.uploadStatuses).toEqual([
      'pending',
      'validated',
      'processed',
      'failed',
      'blocked',
    ]);
    expect(mediaLiterals.processingStatuses).toEqual(['pending', 'ready', 'failed']);
    expect(mediaLiterals.roles).toEqual([
      'thumbnail',
      'teaser_image',
      'header_image',
      'gallery_item',
      'download',
      'hero_image',
      'attachment_image',
    ]);
    expect(mediaLiterals.formats).toEqual(['jpeg', 'png', 'webp']);
  });

  it('keeps the entity interfaces assignable with nested metadata and optional fields', () => {
    const metadata: MediaMetadata = {
      title: 'Titel',
      focusPoint: { x: 0.4, y: 0.7 },
      crop: { x: 10, y: 20, width: 200, height: 100 },
    };
    const asset: MediaAsset = {
      id: 'asset-1',
      instanceId: 'instance-1',
      storageKey: 'instance-1/originals/asset-1.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      byteSize: 1024,
      visibility: 'public',
      uploadStatus: 'processed',
      processingStatus: 'ready',
      metadata,
      technical: { width: 1200, height: 800 },
    };
    const variant: MediaVariant = {
      id: 'variant-1',
      assetId: asset.id,
      variantKey: 'hero',
      presetKey: 'hero',
      format: 'webp',
      width: 1600,
      storageKey: 'instance-1/variants/asset-1.webp',
      generationStatus: 'ready',
    };
    const reference: MediaReference = {
      id: 'ref-1',
      assetId: asset.id,
      targetType: 'news',
      targetId: 'news-1',
      role: 'hero_image',
      sortOrder: 1,
    };
    const decision: MediaDeletionDecision = {
      allowed: false,
      reason: 'active_references',
    };

    expect(asset.metadata).toBe(metadata);
    expect(variant.generationStatus).toBe('ready');
    expect(reference.role).toBe('hero_image');
    expect(decision.reason).toBe('active_references');
  });
});

describe('media focus extraction', () => {
  it.each([
    [1200, 600, 320, 320, { x: 0, y: 0.5 }, { left: 0, top: 0, width: 600, height: 600 }],
    [1200, 600, 320, 320, { x: 1, y: 0.5 }, { left: 600, top: 0, width: 600, height: 600 }],
    [600, 1200, 800, 450, { x: 0.5, y: 1 }, { left: 0, top: 862, width: 600, height: 338 }],
    [600, 1200, 800, 450, { x: 0.5, y: -1 }, { left: 0, top: 0, width: 600, height: 338 }],
  ])(
    'matches the bounded server crop for %s x %s',
    (width, height, targetWidth, targetHeight, focus, expected) => {
      expect(
        resolveMediaFocusCrop(width, height, { width: targetWidth, height: targetHeight }, focus)
      ).toEqual(expected);
    }
  );
  it('retains the whole image at an identical ratio and rejects invalid dimensions', () => {
    expect(
      resolveMediaFocusCrop(1600, 900, { width: 800, height: 450 }, { x: 1, y: 0 })
    ).toBeUndefined();
    expect(
      resolveMediaFocusCrop(0, 900, { width: 800, height: 450 }, { x: 0.5, y: 0.5 })
    ).toBeUndefined();
    expect(
      resolveMediaFocusCrop(1200, 900, { width: 800, height: 450 }, { x: NaN, y: 0.5 })
    ).toBeUndefined();
  });
});
