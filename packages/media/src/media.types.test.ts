import { describe, expect, it } from 'vitest';

import {
  mediaLiterals,
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
    expect(mediaLiterals.uploadStatuses).toEqual(['pending', 'validated', 'processed', 'failed', 'blocked']);
    expect(mediaLiterals.processingStatuses).toEqual(['pending', 'ready', 'failed']);
    expect(mediaLiterals.roles).toEqual([
      'thumbnail',
      'teaser_image',
      'header_image',
      'gallery_item',
      'download',
      'hero_image',
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
