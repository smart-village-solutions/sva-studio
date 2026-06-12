import { describe, expect, it } from 'vitest';

import { mergeMediaListingPage } from './listing-merge.js';

describe('mergeMediaListingPage', () => {
  it('mixes registered and unregistered entries and sorts by descending time', () => {
    const result = mergeMediaListingPage({
      instanceId: 'tenant-a',
      page: 1,
      pageSize: 25,
      registeredAssets: [
        {
          id: 'asset-1',
          instanceId: 'tenant-a',
          storageKey: 'tenant-a/originals/asset-1.jpg',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 10,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {},
          technical: {},
          updatedAt: '2026-06-11T08:00:00.000Z',
        },
      ],
      bucketObjects: [
        {
          storageKey: 'tenant-a/uploads/2026/06/photo.jpg',
          byteSize: 12,
          lastModified: '2026-06-11T09:00:00.000Z',
        },
      ],
    });

    expect(result.items.map((item) => ('id' in item ? item.id : item.storageKey))).toEqual([
      'tenant-a/uploads/2026/06/photo.jpg',
      'asset-1',
    ]);
    expect(result.total).toBe(2);
  });

  it('de-duplicates registered storage keys and applies flat page slicing', () => {
    const result = mergeMediaListingPage({
      instanceId: 'tenant-a',
      page: 2,
      pageSize: 2,
      registeredAssets: [
        {
          id: 'asset-1',
          instanceId: 'tenant-a',
          storageKey: 'tenant-a/originals/asset-1.jpg',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 10,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {},
          technical: {},
          updatedAt: '2026-06-11T08:00:00.000Z',
        },
        {
          id: 'asset-2',
          instanceId: 'tenant-a',
          storageKey: 'tenant-a/originals/asset-2.jpg',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 10,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {},
          technical: {},
          updatedAt: '2026-06-11T06:00:00.000Z',
        },
      ],
      bucketObjects: [
        {
          storageKey: 'tenant-a/originals/asset-1.jpg',
          byteSize: 12,
          lastModified: '2026-06-11T10:00:00.000Z',
        },
        {
          storageKey: 'tenant-a/uploads/2026/06/photo-new.jpg',
          byteSize: 12,
          lastModified: '2026-06-11T09:00:00.000Z',
        },
        {
          storageKey: 'tenant-a/uploads/2026/06/photo-old.jpg',
          byteSize: 12,
          lastModified: '2026-06-11T07:00:00.000Z',
        },
      ],
    });

    expect(result.items.map((item) => ('id' in item ? item.id : item.storageKey))).toEqual([
      'tenant-a/uploads/2026/06/photo-old.jpg',
      'asset-2',
    ]);
    expect(result.total).toBe(4);
  });

  it('de-duplicates repeated bucket objects among themselves before paging and total calculation', () => {
    const result = mergeMediaListingPage({
      instanceId: 'tenant-a',
      page: 1,
      pageSize: 10,
      registeredAssets: [
        {
          id: 'asset-1',
          instanceId: 'tenant-a',
          storageKey: 'tenant-a/originals/asset-1.jpg',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 10,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {},
          technical: {},
          updatedAt: '2026-06-11T08:00:00.000Z',
        },
      ],
      bucketObjects: [
        {
          storageKey: 'tenant-a/uploads/2026/06/photo.jpg',
          byteSize: 12,
          lastModified: '2026-06-11T09:00:00.000Z',
        },
        {
          storageKey: 'tenant-a/uploads/2026/06/photo.jpg',
          byteSize: 12,
          lastModified: '2026-06-11T09:00:00.000Z',
        },
        {
          storageKey: 'tenant-a/uploads/2026/06/photo-2.jpg',
          byteSize: 8,
          lastModified: '2026-06-11T07:00:00.000Z',
        },
      ],
    });

    expect(result.items.map((item) => ('id' in item ? item.id : item.storageKey))).toEqual([
      'tenant-a/uploads/2026/06/photo.jpg',
      'asset-1',
      'tenant-a/uploads/2026/06/photo-2.jpg',
    ]);
    expect(result.total).toBe(3);
  });

  it('keeps the freshest duplicate bucket metadata when repeated storage keys disagree across pages', () => {
    const result = mergeMediaListingPage({
      instanceId: 'tenant-a',
      page: 1,
      pageSize: 10,
      registeredAssets: [],
      bucketObjects: [
        {
          storageKey: 'tenant-a/uploads/2026/06/photo.jpg',
          byteSize: 12,
          lastModified: '2026-06-11T07:00:00.000Z',
        },
        {
          storageKey: 'tenant-a/uploads/2026/06/photo.jpg',
          byteSize: 18,
          lastModified: '2026-06-11T09:00:00.000Z',
        },
        {
          storageKey: 'tenant-a/uploads/2026/06/photo-2.jpg',
          byteSize: 8,
          lastModified: '2026-06-11T08:00:00.000Z',
        },
      ],
    });

    expect(result.items).toEqual([
      {
        source: 'bucket',
        registrationStatus: 'unregistered',
        storageKey: 'tenant-a/uploads/2026/06/photo.jpg',
        fileName: 'photo.jpg',
        folderPath: 'uploads/2026/06',
        relativePath: 'uploads/2026/06/photo.jpg',
        byteSize: 18,
        updatedAt: '2026-06-11T09:00:00.000Z',
        lastModified: '2026-06-11T09:00:00.000Z',
        previewUrl: null,
      },
      {
        source: 'bucket',
        registrationStatus: 'unregistered',
        storageKey: 'tenant-a/uploads/2026/06/photo-2.jpg',
        fileName: 'photo-2.jpg',
        folderPath: 'uploads/2026/06',
        relativePath: 'uploads/2026/06/photo-2.jpg',
        byteSize: 8,
        updatedAt: '2026-06-11T08:00:00.000Z',
        lastModified: '2026-06-11T08:00:00.000Z',
        previewUrl: null,
      },
    ]);
    expect(result.total).toBe(2);
  });

  it('filters unregistered bucket items by search across storage key, file name, and folder path', () => {
    const result = mergeMediaListingPage({
      instanceId: 'tenant-a',
      page: 1,
      pageSize: 10,
      search: 'invoices',
      registeredAssets: [],
      bucketObjects: [
        {
          storageKey: 'tenant-a/uploads/2026/06/photo.jpg',
          byteSize: 12,
          lastModified: '2026-06-11T09:00:00.000Z',
        },
        {
          storageKey: 'tenant-a/invoices/2026/report.pdf',
          byteSize: 18,
          lastModified: '2026-06-11T08:00:00.000Z',
        },
      ],
    });

    expect(result.items.map((item) => ('id' in item ? item.id : item.storageKey))).toEqual([
      'tenant-a/invoices/2026/report.pdf',
    ]);
    expect(result.total).toBe(1);
  });

  it('applies the same filename and path search semantics to registered assets after registration', () => {
    const result = mergeMediaListingPage({
      instanceId: 'tenant-a',
      page: 1,
      pageSize: 10,
      search: 'invoices/2026',
      registeredAssets: [
        {
          id: 'asset-1',
          instanceId: 'tenant-a',
          storageKey: 'tenant-a/invoices/2026/report.pdf',
          mediaType: 'image',
          mimeType: 'application/pdf',
          byteSize: 18,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {},
          technical: {},
          updatedAt: '2026-06-11T08:00:00.000Z',
        },
        {
          id: 'asset-2',
          instanceId: 'tenant-a',
          storageKey: 'tenant-a/uploads/2026/photo.jpg',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 11,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {},
          technical: {},
          updatedAt: '2026-06-11T07:00:00.000Z',
        },
      ],
      bucketObjects: [],
    });

    expect(result.items.map((item) => ('id' in item ? item.id : item.storageKey))).toEqual([
      'asset-1',
    ]);
    expect(result.total).toBe(1);
  });

  it('excludes unregistered bucket items when a visibility filter is present', () => {
    const result = mergeMediaListingPage({
      instanceId: 'tenant-a',
      page: 1,
      pageSize: 10,
      visibility: 'public',
      registeredAssets: [
        {
          id: 'asset-1',
          instanceId: 'tenant-a',
          storageKey: 'tenant-a/originals/asset-1.jpg',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 10,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {},
          technical: {},
          updatedAt: '2026-06-11T08:00:00.000Z',
        },
      ],
      bucketObjects: [
        {
          storageKey: 'tenant-a/uploads/2026/06/photo.jpg',
          byteSize: 12,
          lastModified: '2026-06-11T09:00:00.000Z',
        },
      ],
    });

    expect(result.items.map((item) => ('id' in item ? item.id : item.storageKey))).toEqual([
      'asset-1',
    ]);
    expect(result.total).toBe(1);
  });

  it('keeps later combined pages stable when newer bucket entries interleave with many registered assets', () => {
    const registeredAssets = Array.from({ length: 9 }, (_, index) => {
      const assetNumber = index + 1;
      const hour = String(18 - index).padStart(2, '0');

      return {
        id: `asset-${assetNumber}`,
        instanceId: 'tenant-a',
        storageKey: `tenant-a/originals/asset-${assetNumber}.jpg`,
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 10,
        visibility: 'public',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {},
        technical: {},
        updatedAt: `2026-06-11T${hour}:00:00.000Z`,
      };
    });

    const result = mergeMediaListingPage({
      instanceId: 'tenant-a',
      page: 5,
      pageSize: 2,
      registeredAssets,
      bucketObjects: [
        {
          storageKey: 'tenant-a/originals/asset-9.jpg',
          byteSize: 50,
          lastModified: '2026-06-11T19:00:00.000Z',
        },
        {
          storageKey: 'tenant-a/uploads/2026/06/photo-new.jpg',
          byteSize: 12,
          lastModified: '2026-06-11T17:30:00.000Z',
        },
        {
          storageKey: 'tenant-a/uploads/2026/06/photo-old.jpg',
          byteSize: 12,
          lastModified: '2026-06-11T09:30:00.000Z',
        },
        {
          storageKey: 'tenant-a/uploads/2026/06/photo-old.jpg',
          byteSize: 12,
          lastModified: '2026-06-11T09:30:00.000Z',
        },
        {
          storageKey: 'tenant-a/uploads/2026/06/photo-older.jpg',
          byteSize: 12,
          lastModified: '2026-06-11T08:30:00.000Z',
        },
      ],
    });

    expect(result.items.map((item) => ('id' in item ? item.id : item.storageKey))).toEqual([
      'asset-8',
      'asset-9',
    ]);
    expect(result.total).toBe(12);
  });
});
