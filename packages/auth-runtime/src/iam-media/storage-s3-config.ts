import { listExternalInterfaceRecords } from '@sva/data-repositories/server';
import { type S3ClientConfig } from '@aws-sdk/client-s3';
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

export type MediaStorageConfig = Readonly<{
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
  signedUrlTtlSeconds: number;
}>;

const SOLIDUS_CODE_POINT = 47;

const trimTrailingSlashes = (value: string): string => {
  let end = value.length;
  while (end > 0 && value.codePointAt(end - 1) === SOLIDUS_CODE_POINT) {
    end -= 1;
  }
  return value.slice(0, end);
};

const trimSurroundingSlashes = (value: string): string => {
  let start = 0;
  let end = value.length;

  while (start < end && value.codePointAt(start) === SOLIDUS_CODE_POINT) {
    start += 1;
  }
  while (end > start && value.codePointAt(end - 1) === SOLIDUS_CODE_POINT) {
    end -= 1;
  }

  return value.slice(start, end);
};

const createBucketPublicBaseUrl = (endpoint: string, bucket: string): string =>
  `${trimTrailingSlashes(endpoint)}/${trimSurroundingSlashes(bucket)}`;

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

export const resolveMediaStorageConfigFromInterface = async (
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

  const endpoint =
    typeof resolved.publicConfig.endpoint === 'string' ? resolved.publicConfig.endpoint.trim() : '';
  const bucket =
    typeof resolved.publicConfig.bucket === 'string' ? resolved.publicConfig.bucket.trim() : '';
  const accessKeyId =
    typeof resolved.publicConfig.accessKeyId === 'string'
      ? resolved.publicConfig.accessKeyId.trim()
      : '';
  const secretAccessKey =
    typeof resolved.secretConfig.secretAccessKey === 'string'
      ? resolved.secretConfig.secretAccessKey.trim()
      : '';
  const region =
    typeof resolved.publicConfig.region === 'string' &&
    resolved.publicConfig.region.trim().length > 0
      ? resolved.publicConfig.region.trim()
      : 'eu-central-1';

  if (
    !resolved.enabled ||
    endpoint.length === 0 ||
    bucket.length === 0 ||
    accessKeyId.length === 0 ||
    secretAccessKey.length === 0
  ) {
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
