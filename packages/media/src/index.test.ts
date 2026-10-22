import { describe, expect, it } from 'vitest';

import {
  canDeleteMediaAsset,
  defaultMediaPresets,
  type MediaAsset,
  type MediaReference,
} from './index.js';

const baseAsset: MediaAsset = {
  id: 'asset-1',
  instanceId: 'instance-1',
  storageKey: 'instance-1/originals/asset-1.jpg',
  mediaType: 'image',
  mimeType: 'image/jpeg',
  byteSize: 1024,
  visibility: 'public',
  uploadStatus: 'processed',
  processingStatus: 'ready',
  metadata: {
    title: 'Testbild',
    altText: 'Alt',
  },
  technical: {
    width: 1200,
    height: 800,
  },
};

const makeReference = (overrides: Partial<MediaReference> = {}): MediaReference => ({
  id: 'ref-1',
  assetId: 'asset-1',
  targetType: 'news',
  targetId: 'news-1',
  role: 'teaser_image',
  ...overrides,
});

describe('@sva/media', () => {
  it('blocks deletion when active references exist', () => {
    expect(canDeleteMediaAsset({ asset: baseAsset, references: [makeReference()] })).toEqual({
      allowed: false,
      reason: 'active_references',
    });
  });

  it('blocks deletion while upload processing is incomplete', () => {
    expect(
      canDeleteMediaAsset({
        asset: {
          ...baseAsset,
          uploadStatus: 'validated',
        },
        references: [],
      })
    ).toEqual({
      allowed: false,
      reason: 'upload_incomplete',
    });
  });

  it('allows deletion only when the asset is reference-free and not under legal hold', () => {
    expect(
      canDeleteMediaAsset({
        asset: baseAsset,
        references: [],
        legalHold: false,
      })
    ).toEqual({
      allowed: true,
      reason: null,
    });
  });

  it.each(['failed', 'blocked', 'pending'] as const)(
    'allows cleanup of reference-free %s assets subject to repository session guards',
    (status) => {
      expect(
        canDeleteMediaAsset({
          asset: {
            ...baseAsset,
            uploadStatus: status,
            processingStatus: status === 'pending' ? 'pending' : 'failed',
          },
          references: [],
        }).allowed
      ).toBe(true);
    }
  );

  it('publishes central preset defaults for thumbnail, teaser, and hero usage', () => {
    expect(defaultMediaPresets.map((preset) => preset.key)).toEqual([
      'thumbnail',
      'teaser',
      'hero',
    ]);
    expect(defaultMediaPresets.find((preset) => preset.key === 'hero')).toEqual(
      expect.objectContaining({
        width: 1600,
        format: 'webp',
      })
    );
  });
});
