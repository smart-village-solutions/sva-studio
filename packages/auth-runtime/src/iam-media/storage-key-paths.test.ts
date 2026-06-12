import { describe, expect, it } from 'vitest';

import { deriveMediaPathInfo, isListableMediaStorageKey } from './storage-key-paths.js';

describe('deriveMediaPathInfo', () => {
  it('derives file name and folder path below the instance prefix', () => {
    expect(
      deriveMediaPathInfo({
        instanceId: 'de-musterhausen',
        storageKey: 'de-musterhausen/uploads/2026/06/bild.jpg',
      })
    ).toEqual({
      fileName: 'bild.jpg',
      folderPath: 'uploads/2026/06',
      relativePath: 'uploads/2026/06/bild.jpg',
    });
  });

  it('returns an empty folder path for top-level files', () => {
    expect(
      deriveMediaPathInfo({
        instanceId: 'de-musterhausen',
        storageKey: 'de-musterhausen/asset.pdf',
      })
    ).toEqual({
      fileName: 'asset.pdf',
      folderPath: '',
      relativePath: 'asset.pdf',
    });
  });

  it('keeps root-relative paths unchanged for instance-scoped buckets without instance prefix', () => {
    expect(
      deriveMediaPathInfo({
        instanceId: 'de-musterhausen',
        storageKey: 'cms_uploads/bild.jpg',
      })
    ).toEqual({
      fileName: 'bild.jpg',
      folderPath: 'cms_uploads',
      relativePath: 'cms_uploads/bild.jpg',
    });
  });

  it('treats pseudo-folder keys as not listable objects', () => {
    expect(
      isListableMediaStorageKey({
        instanceId: 'tenant-a',
        storageKey: 'tenant-a/uploads/',
      })
    ).toBe(false);

    expect(
      isListableMediaStorageKey({
        instanceId: 'tenant-a',
        storageKey: 'tenant-a/uploads/2026/',
      })
    ).toBe(false);

    expect(
      isListableMediaStorageKey({
        instanceId: 'tenant-a',
        storageKey: 'tenant-a/uploads/2026/photo.jpg',
      })
    ).toBe(true);
  });
});
