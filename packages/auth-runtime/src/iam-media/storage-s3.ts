import { GetObjectCommand, PutObjectCommand, S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import {
  getMediaStorageAccessKeyId,
  getMediaStorageBucket,
  getMediaStorageEndpoint,
  getMediaStoragePublicBaseUrl,
  getMediaStorageRegion,
  getMediaStorageSecretAccessKey,
  getMediaStorageSignedUrlTtlSeconds,
} from '../runtime-secrets.js';
import type {
  MediaDeliveryResolution,
  MediaStoragePort,
  MediaUploadPreparation,
  PrepareMediaUploadInput,
  ResolveMediaDeliveryInput,
} from './storage-port.js';
import { MediaStorageUnavailableError } from './storage-port.js';

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

const createStorageKey = (input: PrepareMediaUploadInput): string =>
  `${input.instanceId}/originals/${input.assetId}.${resolveObjectExtension(input.mimeType)}`;

const createPublicDeliveryUrl = (publicBaseUrl: string | undefined, storageKey: string): string | null => {
  if (!publicBaseUrl) {
    return null;
  }
  return `${publicBaseUrl}/${storageKey}`;
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

  const prepareUpload = async (input: PrepareMediaUploadInput): Promise<MediaUploadPreparation> => {
    const storageKey = createStorageKey(input);
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

  return {
    prepareUpload,
    resolveDelivery,
    readObject,
    writeObject,
  };
};

export const createConfiguredMediaStoragePort = (): MediaStoragePort => {
  const config = resolveMediaStorageConfig();
  if (!config) {
    throw new MediaStorageUnavailableError();
  }
  return createS3MediaStoragePort(config);
};
