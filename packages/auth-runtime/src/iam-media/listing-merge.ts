import type { MediaAssetRecord } from '@sva/data-repositories';

import { deriveMediaPathInfo } from './storage-key-paths.js';
import type { MediaStorageObjectSummary } from './storage-port.js';

export type UnregisteredMediaListItem = Readonly<{
  source: 'bucket';
  registrationStatus: 'unregistered';
  storageKey: string;
  fileName: string;
  folderPath: string;
  relativePath: string;
  byteSize: number;
  updatedAt: string | null;
  lastModified: string | null;
  previewUrl?: string | null;
}>;

export type MediaListingItem = MediaAssetRecord | UnregisteredMediaListItem;

const isGeneratedVariantObject = (instanceId: string, storageKey: string): boolean => {
  const relativePath = deriveMediaPathInfo({ instanceId, storageKey }).relativePath;
  return relativePath === 'variants' || relativePath.startsWith('variants/');
};

const toUnregisteredItem = (
  instanceId: string,
  entry: MediaStorageObjectSummary
): UnregisteredMediaListItem => {
  const pathInfo = deriveMediaPathInfo({ instanceId, storageKey: entry.storageKey });
  return {
    source: 'bucket',
    registrationStatus: 'unregistered',
    storageKey: entry.storageKey,
    fileName: pathInfo.fileName,
    folderPath: pathInfo.folderPath,
    relativePath: pathInfo.relativePath,
    byteSize: entry.byteSize,
    updatedAt: entry.lastModified,
    lastModified: entry.lastModified,
    previewUrl: entry.previewUrl ?? null,
  };
};

export const mergeMediaListingPage = (input: {
  instanceId: string;
  limit: number;
  registeredAssets: readonly MediaAssetRecord[];
  bucketObjects: readonly MediaStorageObjectSummary[];
}): Readonly<{
  items: readonly MediaListingItem[];
  hasMoreItems: boolean;
}> => {
  const byStorageKey = new Map<string, MediaListingItem>();

  for (const bucketObject of input.bucketObjects) {
    if (!isGeneratedVariantObject(input.instanceId, bucketObject.storageKey)) {
      byStorageKey.set(bucketObject.storageKey, toUnregisteredItem(input.instanceId, bucketObject));
    }
  }
  for (const asset of input.registeredAssets) {
    byStorageKey.set(asset.storageKey, asset);
  }

  const merged = [...byStorageKey.values()].sort((left, right) =>
    left.storageKey.localeCompare(right.storageKey)
  );

  return {
    items: merged.slice(0, input.limit),
    hasMoreItems: merged.length > input.limit,
  };
};
