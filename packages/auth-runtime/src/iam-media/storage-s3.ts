import {
  DeleteObjectCommand,
  GetObjectCommand,
  GetBucketAclCommand,
  GetBucketPolicyCommand,
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
import { MediaStorageUnavailableError } from './storage-port.js';
import {
  createS3ClientConfig,
  resolveMediaStorageConfig,
  resolveMediaStorageConfigFromInterface,
  type MediaStorageConfig,
} from './storage-s3-config.js';
import { createS3ListObjects, resolveStoragePrefix } from './storage-s3-listing.js';
import { readS3MediaObject, statS3MediaObject } from './storage-s3-read.js';
import { getMediaScanEnabled } from '../runtime-secrets.js';
import { isMediaQuarantineKey, isPrivateMediaStorageKey } from './storage-key-paths.js';

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

const resolveObjectBucket = (
  config: MediaStorageConfig,
  storageKey: string,
  instanceId: string
): string => {
  if (!isPrivateMediaStorageKey(storageKey)) return config.bucket;
  if (
    !storageKey.startsWith(`.protected/${instanceId}/`) &&
    !storageKey.startsWith(`.quarantine/${instanceId}/`)
  )
    throw new MediaStorageUnavailableError();
  const bucket = process.env.MEDIA_SCAN_QUARANTINE_BUCKET;
  if (!bucket || bucket === config.bucket) throw new MediaStorageUnavailableError();
  return bucket;
};

const assertPrivateIntakeBucket = async (client: S3Client, bucket: string): Promise<void> => {
  const acl = await client.send(new GetBucketAclCommand({ Bucket: bucket }));
  if (
    !acl.Owner?.ID ||
    !acl.Grants?.length ||
    acl.Grants.some(
      (grant) =>
        grant.Grantee?.Type !== 'CanonicalUser' ||
        (grant.Grantee.ID !== undefined && grant.Grantee.ID !== acl.Owner?.ID)
    )
  )
    throw new MediaStorageUnavailableError();
  try {
    await client.send(new GetBucketPolicyCommand({ Bucket: bucket }));
  } catch (error) {
    // The intake bucket accepts no bucket policy, including one granting anonymous access.
    if (error instanceof Error && error.name === 'NoSuchBucketPolicy') return;
    throw new MediaStorageUnavailableError();
  }
  throw new MediaStorageUnavailableError();
};

export const createS3MediaStoragePort = (
  config: MediaStorageConfig,
  options?: {
    client?: S3Client;
    getSignedUrl?: SignedUrlResolver;
  }
): MediaStoragePort => {
  const client = options?.client ?? new S3Client(createS3ClientConfig(config));
  const bucketForKey = (storageKey: string, instanceId: string) =>
    resolveObjectBucket(config, storageKey, instanceId);
  const assertPrivateIntake = (storageKey: string, instanceId: string) =>
    assertPrivateIntakeBucket(client, bucketForKey(storageKey, instanceId));
  const signedUrl =
    options?.getSignedUrl ??
    ((targetClient, command, expiresIn) => getSignedUrl(targetClient, command, { expiresIn }));

  const toExpiresAt = (): string =>
    new Date(Date.now() + config.signedUrlTtlSeconds * 1000).toISOString();

  const publicListing = createS3ListObjects(client, config);
  const listObjects: MediaStoragePort['listObjects'] = (input) => {
    if (input.prefix && isPrivateMediaStorageKey(input.prefix)) {
      if (isMediaQuarantineKey(input.prefix)) throw new MediaStorageUnavailableError();
      return createS3ListObjects(client, {
        ...config,
        bucket: bucketForKey(input.prefix, input.instanceId),
        publicBaseUrl: undefined,
      })(input);
    }
    return publicListing(input);
  };

  const prepareUpload = async (input: PrepareMediaUploadInput): Promise<MediaUploadPreparation> => {
    const storageKey = getMediaScanEnabled()
      ? `.quarantine/${input.instanceId}/${input.assetId}/${input.uploadSessionId}`
      : createStorageKey(input, config.bucket);
    if (getMediaScanEnabled()) await assertPrivateIntake(storageKey, input.instanceId);
    const uploadUrl = await signedUrl(
      client,
      new PutObjectCommand({
        Bucket: bucketForKey(storageKey, input.instanceId),
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
    if (isMediaQuarantineKey(input.storageKey)) throw new MediaStorageUnavailableError();
    if (isPrivateMediaStorageKey(input.storageKey) && input.visibility !== 'protected')
      throw new MediaStorageUnavailableError();
    if (input.visibility === 'public' && !isPrivateMediaStorageKey(input.storageKey)) {
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
        Bucket: bucketForKey(input.storageKey, input.instanceId),
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

  const statObject = (input: { instanceId: string; storageKey: string }) =>
    statS3MediaObject(client, bucketForKey(input.storageKey, input.instanceId), input.storageKey);
  const readObject: MediaStoragePort['readObject'] = (input) =>
    readS3MediaObject(client, bucketForKey(input.storageKey, input.instanceId), input);

  const writeObject = async (input: {
    instanceId: string;
    storageKey: string;
    body: Uint8Array;
    contentType: string;
  }) => {
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucketForKey(input.storageKey, input.instanceId),
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
        Bucket: bucketForKey(input.storageKey, input.instanceId),
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
