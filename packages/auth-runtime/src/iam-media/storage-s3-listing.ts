import { ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3';
import type { MediaStorageConfig } from './storage-s3-config.js';
import type { MediaStorageObjectList, MediaStorageObjectSummary } from './storage-port.js';
import {
  createMediaStorageInstancePrefix,
  isListableMediaStorageKey,
} from './storage-key-paths.js';

const createStorageObjectList = (input: {
  items: readonly MediaStorageObjectSummary[];
  nextCursor: string | null;
  lastScannedStorageKey?: string;
}): MediaStorageObjectList => ({
  items: input.items,
  nextCursor: input.nextCursor,
  ...(input.nextCursor !== null && input.lastScannedStorageKey
    ? { lastScannedStorageKey: input.lastScannedStorageKey }
    : {}),
});

export const resolveStoragePrefix = (instanceId: string, bucket: string): string =>
  bucket.trim() === instanceId.trim() ? '' : createMediaStorageInstancePrefix(instanceId);

const encodeStorageKeyForUrl = (storageKey: string): string =>
  storageKey
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const toMediaStorageObjectSummary = (entry: {
  instanceId: string;
  publicBaseUrl?: string;
  Key?: string;
  Size?: number;
  LastModified?: Date;
}): MediaStorageObjectSummary | null => {
  if (typeof entry.Key !== 'string' || entry.Key.length === 0) {
    return null;
  }

  if (!isListableMediaStorageKey({ instanceId: entry.instanceId, storageKey: entry.Key })) {
    return null;
  }

  return {
    storageKey: entry.Key,
    byteSize: typeof entry.Size === 'number' ? entry.Size : 0,
    lastModified: entry.LastModified?.toISOString() ?? null,
    previewUrl: entry.publicBaseUrl
      ? `${entry.publicBaseUrl}/${encodeStorageKeyForUrl(entry.Key)}`
      : null,
  };
};

export const createS3ListObjects =
  (client: S3Client, config: MediaStorageConfig) =>
  async (input: {
    instanceId: string;
    limit: number;
    cursor?: string;
    prefix?: string;
    startAfter?: string;
  }): Promise<MediaStorageObjectList> => {
    const instancePrefix = resolveStoragePrefix(input.instanceId, config.bucket);
    const requestedPrefix = input.prefix?.replace(/^\/+/, '') ?? '';
    const prefix = requestedPrefix.startsWith(instancePrefix)
      ? requestedPrefix
      : `${instancePrefix}${requestedPrefix}`;
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: prefix || undefined,
        MaxKeys: input.limit,
        ContinuationToken: input.cursor,
        ...(!input.cursor && input.startAfter ? { StartAfter: input.startAfter } : {}),
      })
    );

    const items = (response.Contents ?? [])
      .map((entry) =>
        toMediaStorageObjectSummary({
          ...entry,
          instanceId: input.instanceId,
          publicBaseUrl: config.publicBaseUrl,
        })
      )
      .filter((entry): entry is MediaStorageObjectSummary => entry !== null);
    const contents = response.Contents ?? [];
    const lastScannedStorageKey = contents[contents.length - 1]?.Key;

    return createStorageObjectList({
      items,
      nextCursor: response.NextContinuationToken ?? null,
      lastScannedStorageKey,
    });
  };
