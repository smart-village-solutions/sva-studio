import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type {
  MediaDeliveryResolution,
  MediaStoragePort,
  MediaUploadPreparation,
  PrepareMediaUploadInput,
  ResolveMediaDeliveryInput,
} from './storage-port.js';
import { MediaStorageObjectNotFoundError, MediaStorageUnavailableError } from './storage-port.js';
import {
  createS3ClientConfig,
  resolveMediaStorageConfig,
  resolveMediaStorageConfigFromInterface,
  type MediaStorageConfig,
} from './storage-s3-config.js';
import { createS3ListObjects, resolveStoragePrefix } from './storage-s3-listing.js';

export { createS3ClientConfig, resolveMediaStorageConfig } from './storage-s3-config.js';

type SignedUrlResolver = (
  client: S3Client,
  command: PutObjectCommand | GetObjectCommand,
  expiresIn: number
) => Promise<string>;

const mimeTypeExtensions: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const resolveObjectExtension = (mimeType: string): string => mimeTypeExtensions[mimeType] ?? 'bin';

const createStorageKey = (input: PrepareMediaUploadInput, bucket: string): string =>
  `${resolveStoragePrefix(input.instanceId, bucket)}originals/${input.assetId}.${resolveObjectExtension(input.mimeType)}`;

const createPublicDeliveryUrl = (
  publicBaseUrl: string | undefined,
  storageKey: string
): string | null => {
  if (!publicBaseUrl) {
    return null;
  }
  return `${publicBaseUrl}/${storageKey}`;
};

const isMissingS3ObjectError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const statusCode =
    '$metadata' in error &&
    typeof error.$metadata === 'object' &&
    error.$metadata !== null &&
    'httpStatusCode' in error.$metadata &&
    typeof error.$metadata.httpStatusCode === 'number'
      ? error.$metadata.httpStatusCode
      : null;

  return statusCode === 404 || error.name === 'NotFound' || error.name === 'NoSuchKey';
};

export const createS3MediaStoragePort = (
  config: MediaStorageConfig,
  options?: {
    client?: S3Client;
    getSignedUrl?: SignedUrlResolver;
  }
): MediaStoragePort => {
  const client = options?.client ?? new S3Client(createS3ClientConfig(config));
  const signedUrl =
    options?.getSignedUrl ??
    ((targetClient, command, expiresIn) => getSignedUrl(targetClient, command, { expiresIn }));

  const toExpiresAt = (): string =>
    new Date(Date.now() + config.signedUrlTtlSeconds * 1000).toISOString();

  const listObjects = createS3ListObjects(client, config);

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

  const resolveDelivery = async (
    input: ResolveMediaDeliveryInput
  ): Promise<MediaDeliveryResolution> => {
    if (input.visibility === 'public') {
      const publicUrl = createPublicDeliveryUrl(config.publicBaseUrl, input.storageKey);
      if (publicUrl) {
        return {
          deliveryUrl: publicUrl,
          expiresAt: toExpiresAt(),
          isPublicUrl: true,
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
      isPublicUrl: false,
    };
  };

  const statObject = async (input: { instanceId: string; storageKey: string }) => {
    try {
      const response = await client.send(
        new HeadObjectCommand({
          Bucket: config.bucket,
          Key: input.storageKey,
        })
      );

      return {
        byteSize: typeof response.ContentLength === 'number' ? response.ContentLength : 0,
        contentType: response.ContentType,
        etag: response.ETag,
      };
    } catch (error) {
      if (isMissingS3ObjectError(error)) {
        throw new MediaStorageObjectNotFoundError();
      }

      throw error;
    }
  };

  const readObject = async (input: { instanceId: string; storageKey: string }) => {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: input.storageKey,
      })
    );
    const body = response.Body
      ? new Uint8Array(await response.Body.transformToByteArray())
      : new Uint8Array();
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
    statObject,
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
