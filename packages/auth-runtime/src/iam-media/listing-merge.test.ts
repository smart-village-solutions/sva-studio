import { describe, expect, it } from 'vitest';

import { mergeMediaListingPage } from './listing-merge.js';

const asset = (id: string, storageKey: string) => ({
  id,
  instanceId: 'tenant-a',
  storageKey,
  mediaType: 'image',
  mimeType: 'image/jpeg',
  byteSize: 10,
  visibility: 'public',
  uploadStatus: 'processed',
  processingStatus: 'ready',
  metadata: {},
  technical: {},
});

const bucketObject = (storageKey: string, byteSize = 10) => ({
  storageKey,
  byteSize,
  lastModified: '2026-06-11T09:00:00.000Z',
});

describe('mergeMediaListingPage', () => {
  it('merges both sources in stable storage-key order', () => {
    const result = mergeMediaListingPage({
      instanceId: 'tenant-a',
      limit: 10,
      registeredAssets: [asset('asset-b', 'tenant-a/originals/b.jpg')],
      bucketObjects: [bucketObject('tenant-a/originals/a.jpg')],
      registeredHasMore: false,
      bucketHasMore: false,
    });

    expect(result.items.map((item) => item.storageKey)).toEqual([
      'tenant-a/originals/a.jpg',
      'tenant-a/originals/b.jpg',
    ]);
    expect(result.hasNextPage).toBe(false);
  });

  it('uses the binary storage-key order used by S3', () => {
    const result = mergeMediaListingPage({
      instanceId: 'tenant-a',
      limit: 10,
      registeredAssets: [asset('asset-a', 'tenant-a/originals/a.jpg')],
      bucketObjects: [bucketObject('tenant-a/originals/B.jpg')],
      registeredHasMore: false,
      bucketHasMore: false,
    });

    expect(result.items.map((item) => item.storageKey)).toEqual([
      'tenant-a/originals/B.jpg',
      'tenant-a/originals/a.jpg',
    ]);
  });

  it('uses registered metadata for duplicate storage keys', () => {
    const result = mergeMediaListingPage({
      instanceId: 'tenant-a',
      limit: 10,
      registeredAssets: [asset('asset-a', 'tenant-a/originals/a.jpg')],
      bucketObjects: [bucketObject('tenant-a/originals/a.jpg', 999)],
      registeredHasMore: false,
      bucketHasMore: false,
    });

    expect(result.items).toEqual([expect.objectContaining({ id: 'asset-a', byteSize: 10 })]);
  });

  it('filters generated variants and limits the merged page', () => {
    const result = mergeMediaListingPage({
      instanceId: 'tenant-a',
      limit: 1,
      registeredAssets: [],
      bucketObjects: [
        bucketObject('tenant-a/variants/asset-a/thumbnail.webp'),
        bucketObject('tenant-a/originals/a.jpg'),
        bucketObject('tenant-a/originals/b.jpg'),
      ],
      registeredHasMore: false,
      bucketHasMore: false,
    });

    expect(result.items.map((item) => item.storageKey)).toEqual(['tenant-a/originals/a.jpg']);
    expect(result.hasNextPage).toBe(true);
  });

  it('derives presentation paths for unregistered bucket objects', () => {
    const result = mergeMediaListingPage({
      instanceId: 'tenant-a',
      limit: 10,
      registeredAssets: [],
      bucketObjects: [bucketObject('tenant-a/invoices/2026/report.pdf')],
      registeredHasMore: false,
      bucketHasMore: false,
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        source: 'bucket',
        fileName: 'report.pdf',
        folderPath: 'invoices/2026',
        relativePath: 'invoices/2026/report.pdf',
      }),
    ]);
  });
});
