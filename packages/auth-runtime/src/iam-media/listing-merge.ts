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

const compareMediaStorageKeys = (left: string, right: string): number =>
  Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));

const earliestStorageKey = (keys: readonly (string | undefined)[]): string | undefined =>
  keys
    .filter((key): key is string => key !== undefined)
    .reduce<string | undefined>(
      (earliest, key) =>
        earliest === undefined || compareMediaStorageKeys(key, earliest) < 0 ? key : earliest,
      undefined
    );

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
  registeredHasMore: boolean;
  bucketHasMore: boolean;
  lastScannedBucketKey?: string;
}): Readonly<{
  items: readonly MediaListingItem[];
  hasNextPage: boolean;
  nextCursorStorageKey?: string;
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

  const safeScanFrontier = earliestStorageKey([
    input.registeredHasMore
      ? input.registeredAssets[input.registeredAssets.length - 1]?.storageKey
      : undefined,
    input.bucketHasMore
      ? (input.lastScannedBucketKey ??
        input.bucketObjects[input.bucketObjects.length - 1]?.storageKey)
      : undefined,
  ]);
  const merged = [...byStorageKey.values()]
    .filter(
      (item) =>
        safeScanFrontier === undefined ||
        compareMediaStorageKeys(item.storageKey, safeScanFrontier) <= 0
    )
    .sort((left, right) => compareMediaStorageKeys(left.storageKey, right.storageKey));
  const items = merged.slice(0, input.limit);
  const hasMoreItems = merged.length > input.limit;
  const hasNextPage = hasMoreItems || input.registeredHasMore || input.bucketHasMore;
  const nextCursorStorageKey = hasMoreItems
    ? items[items.length - 1]?.storageKey
    : (safeScanFrontier ?? items[items.length - 1]?.storageKey);

  return {
    items,
    hasNextPage,
    ...(hasNextPage && nextCursorStorageKey ? { nextCursorStorageKey } : {}),
  };
};
