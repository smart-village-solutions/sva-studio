import { listExternalInterfaceRecords } from '@sva/data-repositories/server';
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { resolveExternalInterface } from '@sva/server-runtime';

import {
  getMediaStorageAccessKeyId,
  getMediaStorageBucket,
  getMediaStorageEndpoint,
  getMediaStoragePublicBaseUrl,
  getMediaStorageRegion,
  getMediaStorageSecretAccessKey,
  getMediaStorageSignedUrlTtlSeconds,
} from '../runtime-secrets.js';
import { revealField } from '../iam-account-management/encryption.js';
import type {
  MediaDeliveryResolution,
  MediaStorageObjectList,
  MediaStorageObjectSummary,
  MediaStoragePort,
  MediaUploadPreparation,
  PrepareMediaUploadInput,
  ResolveMediaDeliveryInput,
} from './storage-port.js';
import { MediaStorageUnavailableError } from './storage-port.js';
import { createMediaStorageInstancePrefix, isListableMediaStorageKey } from './storage-key-paths.js';

type SignedUrlResolver = (client: S3Client, command: PutObjectCommand | GetObjectCommand, expiresIn: number) => Promise<string>;

type MediaStorageConfig = Readonly<{
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
  signedUrlTtlSeconds: number;
}>;

const mimeTypeExtensions: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const resolveObjectExtension = (mimeType: string): string => mimeTypeExtensions[mimeType] ?? 'bin';

const resolveStoragePrefix = (instanceId: string, bucket: string): string =>
  bucket.trim() === instanceId.trim() ? '' : createMediaStorageInstancePrefix(instanceId);

const createStorageKey = (input: PrepareMediaUploadInput, bucket: string): string =>
  `${resolveStoragePrefix(input.instanceId, bucket)}originals/${input.assetId}.${resolveObjectExtension(input.mimeType)}`;

const createPublicDeliveryUrl = (publicBaseUrl: string | undefined, storageKey: string): string | null => {
  if (!publicBaseUrl) {
    return null;
  }
  return `${publicBaseUrl}/${storageKey}`;
};

const createBucketPublicBaseUrl = (endpoint: string, bucket: string): string =>
  `${endpoint.replace(/\/+$/, '')}/${bucket.replace(/^\/+|\/+$/g, '')}`;

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
    previewUrl: entry.publicBaseUrl ? `${entry.publicBaseUrl}/${encodeStorageKeyForUrl(entry.Key)}` : null,
  };
};

export const resolveMediaStorageConfig = (): MediaStorageConfig | null => {
  const endpoint = getMediaStorageEndpoint();
  const bucket = getMediaStorageBucket();
  const accessKeyId = getMediaStorageAccessKeyId();
  const secretAccessKey = getMediaStorageSecretAccessKey();

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    endpoint,
    region: getMediaStorageRegion(),
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: getMediaStoragePublicBaseUrl(),
    signedUrlTtlSeconds: getMediaStorageSignedUrlTtlSeconds(),
  };
};

const resolveMediaStorageConfigFromInterface = async (
  instanceId: string
): Promise<MediaStorageConfig | null> => {
  const records = await listExternalInterfaceRecords(instanceId);
  const s3Records = records.filter((record) => record.typeKey === 's3');
  const selectedRecord =
    s3Records.find((record) => record.enabled && record.isDefault) ??
    s3Records.find((record) => record.enabled) ??
    s3Records[0] ??
    null;

  if (!selectedRecord) {
    return null;
  }

  const resolved = await resolveExternalInterface({
    instanceId,
    typeKey: 's3',
    interfaceId: selectedRecord.id,
    loadById: async () => selectedRecord,
    revealSecret: (ciphertext, aad) => revealField(ciphertext, aad) ?? undefined,
  });

  const endpoint = typeof resolved.publicConfig.endpoint === 'string' ? resolved.publicConfig.endpoint.trim() : '';
  const bucket = typeof resolved.publicConfig.bucket === 'string' ? resolved.publicConfig.bucket.trim() : '';
  const accessKeyId =
    typeof resolved.publicConfig.accessKeyId === 'string' ? resolved.publicConfig.accessKeyId.trim() : '';
  const secretAccessKey =
    typeof resolved.secretConfig.secretAccessKey === 'string' ? resolved.secretConfig.secretAccessKey.trim() : '';
  const region =
    typeof resolved.publicConfig.region === 'string' && resolved.publicConfig.region.trim().length > 0
      ? resolved.publicConfig.region.trim()
      : 'eu-central-1';

  if (!resolved.enabled || endpoint.length === 0 || bucket.length === 0 || accessKeyId.length === 0 || secretAccessKey.length === 0) {
    return null;
  }

  return {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: createBucketPublicBaseUrl(endpoint, bucket),
    signedUrlTtlSeconds: getMediaStorageSignedUrlTtlSeconds(),
  };
};

export const createS3ClientConfig = (config: MediaStorageConfig): S3ClientConfig => ({
  endpoint: config.endpoint,
  region: config.region,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
});

export const createS3MediaStoragePort = (
  config: MediaStorageConfig,
  options?: {
    client?: S3Client;
    getSignedUrl?: SignedUrlResolver;
  }
): MediaStoragePort => {
  const client = options?.client ?? new S3Client(createS3ClientConfig(config));
  const signedUrl = options?.getSignedUrl ?? ((targetClient, command, expiresIn) => getSignedUrl(targetClient, command, { expiresIn }));

  const toExpiresAt = (): string => new Date(Date.now() + config.signedUrlTtlSeconds * 1000).toISOString();

  const listObjects = async (input: {
    instanceId: string;
    limit: number;
    cursor?: string;
  }): Promise<MediaStorageObjectList> => {
    const prefix = resolveStoragePrefix(input.instanceId, config.bucket);
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: prefix || undefined,
        MaxKeys: input.limit,
        ContinuationToken: input.cursor,
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

    return {
      items,
      nextCursor: response.NextContinuationToken ?? null,
    };
  };

  const prepareUpload = async (input: PrepareMediaUploadInput): Promise<MediaUploadPreparation> => {
    const storageKey = createStorageKey(input, config.bucket);
    const uploadUrl = await signedUrl(
      client,
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
        ContentType: input.mimeType,
        ContentLength: input.byteSize,
        Metadata: {
          instanceId: input.instanceId,
          assetId: input.assetId,
          uploadSessionId: input.uploadSessionId,
          mediaType: input.mediaType,
        },
      }),
      config.signedUrlTtlSeconds
    );

    return {
      uploadUrl,
      method: 'PUT',
      headers: {
        'Content-Type': input.mimeType,
      },
      storageKey,
      expiresAt: toExpiresAt(),
    };
  };

  const resolveDelivery = async (input: ResolveMediaDeliveryInput): Promise<MediaDeliveryResolution> => {
    if (input.visibility === 'public') {
      const publicUrl = createPublicDeliveryUrl(config.publicBaseUrl, input.storageKey);
      if (publicUrl) {
        return {
          deliveryUrl: publicUrl,
          expiresAt: toExpiresAt(),
        };
      }
    }

    const deliveryUrl = await signedUrl(
      client,
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: input.storageKey,
      }),
      config.signedUrlTtlSeconds
    );

    return {
      deliveryUrl,
      expiresAt: toExpiresAt(),
    };
  };

  const readObject = async (input: { instanceId: string; storageKey: string }) => {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: input.storageKey,
      })
    );
    const body = response.Body ? new Uint8Array(await response.Body.transformToByteArray()) : new Uint8Array();
    return {
      body,
      byteSize: body.byteLength,
      contentType: response.ContentType,
      etag: response.ETag,
    };
  };

  const writeObject = async (input: {
    instanceId: string;
    storageKey: string;
    body: Uint8Array;
    contentType: string;
  }) => {
    const response = await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: input.storageKey,
        Body: input.body,
        ContentType: input.contentType,
      })
    );

    return {
      byteSize: input.body.byteLength,
      etag: response.ETag,
    };
  };

  const deleteObject = async (input: { instanceId: string; storageKey: string }) => {
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: input.storageKey,
      })
    );
  };

  return {
    listObjects,
    prepareUpload,
    resolveDelivery,
    readObject,
    writeObject,
    deleteObject,
  };
};

export const createConfiguredMediaStoragePort = (): MediaStoragePort => {
  const config = resolveMediaStorageConfig();
  if (!config) {
    throw new MediaStorageUnavailableError();
  }
  return createS3MediaStoragePort(config);
};

export const createConfiguredMediaStoragePortForInstance = async (
  instanceId: string
): Promise<MediaStoragePort> => {
  const interfaceConfig = await resolveMediaStorageConfigFromInterface(instanceId);
  if (interfaceConfig) {
    return createS3MediaStoragePort(interfaceConfig);
  }

  const envConfig = resolveMediaStorageConfig();
  if (envConfig) {
    return createS3MediaStoragePort(envConfig);
  }

  throw new MediaStorageUnavailableError();
};
