import type { MediaAsset, MediaReference, MediaVariant } from './index.js';

const mediaAsset: MediaAsset = {
  id: 'asset-type-test',
  instanceId: 'instance-type-test',
  storageKey: 'instance-type-test/originals/asset-type-test.jpg',
  mediaType: 'image',
  mimeType: 'image/jpeg',
  byteSize: 1024,
  visibility: 'public',
  uploadStatus: 'processed',
  processingStatus: 'ready',
  metadata: {
    title: 'Type Test Asset',
  },
  technical: {
    width: 1200,
    height: 800,
  },
};

const mediaVariant: MediaVariant = {
  id: 'variant-type-test',
  assetId: mediaAsset.id,
  variantKey: 'hero-webp',
  presetKey: 'hero',
  format: 'webp',
  width: 1600,
  height: 900,
  storageKey: 'instance-type-test/variants/asset-type-test/hero.webp',
  generationStatus: 'ready',
};

const mediaReference: MediaReference = {
  id: 'reference-type-test',
  assetId: mediaAsset.id,
  targetType: 'news',
  targetId: 'news-1',
  role: 'teaser_image',
  sortOrder: 0,
};

const mediaTypeContract: readonly [MediaAsset, MediaVariant, MediaReference] = [
  mediaAsset,
  mediaVariant,
  mediaReference,
];

void mediaTypeContract;
