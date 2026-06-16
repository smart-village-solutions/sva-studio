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

const normalizeSearchTerm = (value: string | undefined): string | undefined => {
  const normalized = value?.trim().toLocaleLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
};

const buildSearchableFields = (input: {
  instanceId: string;
  storageKey: string;
  metadata?: Readonly<Record<string, unknown>>;
  mimeType?: string;
}): readonly string[] => {
  const pathInfo = deriveMediaPathInfo(input);
  const title = typeof input.metadata?.['title'] === 'string' ? input.metadata['title'] : '';
  const altText = typeof input.metadata?.['altText'] === 'string' ? input.metadata['altText'] : '';

  return [input.storageKey, pathInfo.fileName, pathInfo.folderPath, pathInfo.relativePath, title, altText, input.mimeType ?? ''];
};

const matchesSearch = (input: {
  instanceId: string;
  storageKey: string;
  normalizedSearch?: string;
  metadata?: Readonly<Record<string, unknown>>;
  mimeType?: string;
}): boolean => {
  const { normalizedSearch } = input;
  if (!normalizedSearch) {
    return true;
  }

  return buildSearchableFields({
    instanceId: input.instanceId,
    storageKey: input.storageKey,
    metadata: input.metadata,
    mimeType: input.mimeType,
  }).some((field) => field.toLocaleLowerCase().includes(normalizedSearch));
};

const toSortTimestamp = (value: string | null | undefined): number => {
  if (typeof value !== 'string' || value.length === 0) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const pickPreferredBucketObject = (
  current: MediaStorageObjectSummary,
  candidate: MediaStorageObjectSummary
): MediaStorageObjectSummary => {
  const currentTime = toSortTimestamp(current.lastModified);
  const candidateTime = toSortTimestamp(candidate.lastModified);

  if (candidateTime !== currentTime) {
    return candidateTime > currentTime ? candidate : current;
  }

  if (candidate.byteSize !== current.byteSize) {
    return candidate.byteSize > current.byteSize ? candidate : current;
  }

  return candidate.storageKey.localeCompare(current.storageKey) >= 0 ? candidate : current;
};

const isGeneratedVariantObject = (instanceId: string, storageKey: string): boolean => {
  const segments = storageKey.split('/').filter((segment) => segment.length > 0);
  return segments[0] === instanceId && segments[1] === 'variants';
};

const getListingItemSortTimestamp = (item: MediaListingItem): number => {
  const primaryTimestamp = toSortTimestamp(item.updatedAt);
  if (primaryTimestamp > 0) {
    return primaryTimestamp;
  }

  if ('createdAt' in item) {
    return toSortTimestamp(item.createdAt);
  }

  return 0;
};

export const mergeMediaListingPage = (input: {
  instanceId: string;
  page: number;
  pageSize: number;
  search?: string;
  visibility?: string;
  registeredAssets: readonly MediaAssetRecord[];
  bucketObjects: readonly MediaStorageObjectSummary[];
}): Readonly<{
  items: readonly MediaListingItem[];
  total: number;
}> => {
  const normalizedSearch = normalizeSearchTerm(input.search);
  const registeredAssets = input.registeredAssets.filter((asset) =>
    matchesSearch({
      instanceId: input.instanceId,
      storageKey: asset.storageKey,
      normalizedSearch,
      metadata: asset.metadata,
      mimeType: asset.mimeType,
    })
  );
  const includeUnregisteredItems = !input.visibility?.trim();
  const registeredKeys = new Set(input.registeredAssets.map((asset) => asset.storageKey));
  const deduplicatedBucketObjects = includeUnregisteredItems
    ? Array.from(
        input.bucketObjects.reduce<Map<string, MediaStorageObjectSummary>>((accumulator, entry) => {
          if (registeredKeys.has(entry.storageKey) || isGeneratedVariantObject(input.instanceId, entry.storageKey)) {
            return accumulator;
          }

          const current = accumulator.get(entry.storageKey);
          accumulator.set(
            entry.storageKey,
            current ? pickPreferredBucketObject(current, entry) : entry
          );
          return accumulator;
        }, new Map()).values()
      )
    : [];

  const unregisteredItems: readonly UnregisteredMediaListItem[] = includeUnregisteredItems
    ? deduplicatedBucketObjects
    .map((entry) => {
      const pathInfo = deriveMediaPathInfo({
        instanceId: input.instanceId,
        storageKey: entry.storageKey,
      });

      return {
        source: 'bucket' as const,
        registrationStatus: 'unregistered' as const,
        storageKey: entry.storageKey,
        fileName: pathInfo.fileName,
        folderPath: pathInfo.folderPath,
        relativePath: pathInfo.relativePath,
        byteSize: entry.byteSize,
        updatedAt: entry.lastModified,
        lastModified: entry.lastModified,
        previewUrl: entry.previewUrl ?? null,
      };
    })
    .filter((entry) => {
      return matchesSearch({
        instanceId: input.instanceId,
        storageKey: entry.storageKey,
        normalizedSearch,
      });
    })
    : [];

  const merged = [...registeredAssets, ...unregisteredItems].sort((left, right) => {
    const leftTime = getListingItemSortTimestamp(left);
    const rightTime = getListingItemSortTimestamp(right);

    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return left.storageKey.localeCompare(right.storageKey);
  });

  const startIndex = (input.page - 1) * input.pageSize;

  return {
    items: merged.slice(startIndex, startIndex + input.pageSize),
    total: merged.length,
  };
};
