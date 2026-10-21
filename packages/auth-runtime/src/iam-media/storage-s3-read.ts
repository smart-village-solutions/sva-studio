import { GetObjectCommand, HeadObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { mediaScanLimits } from '@sva/media';
import { isMediaQuarantineKey } from './storage-key-paths.js';
import {
  MediaStorageObjectNotFoundError,
  MediaStorageSizeLimitError,
  MediaStorageUnavailableError,
  type ReadMediaObjectInput,
} from './storage-port.js';

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

export const statS3MediaObject = async (client: S3Client, bucket: string, storageKey: string) => {
  try {
    const response = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: storageKey }));
    return {
      byteSize: typeof response.ContentLength === 'number' ? response.ContentLength : 0,
      contentType: response.ContentType,
      etag: response.ETag,
    };
  } catch (error) {
    if (isMissingS3ObjectError(error)) throw new MediaStorageObjectNotFoundError();
    throw error;
  }
};

export const readS3MediaObject = async (
  client: S3Client,
  bucket: string,
  input: ReadMediaObjectInput
) => {
  if (isMediaQuarantineKey(input.storageKey)) {
    const object = await statS3MediaObject(client, bucket, input.storageKey);
    if (object.byteSize > mediaScanLimits.maxBytes) throw new MediaStorageUnavailableError();
  }
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: input.storageKey,
      ...(input.maxBytes !== undefined ? { Range: `bytes=0-${input.maxBytes}` } : {}),
    })
  );
  if (
    input.maxBytes !== undefined &&
    (response.ContentLength === undefined || response.ContentLength > input.maxBytes)
  ) {
    const stream = response.Body;
    if (stream && 'destroy' in stream && typeof stream.destroy === 'function') stream.destroy();
    throw new MediaStorageSizeLimitError();
  }
  const body = response.Body
    ? new Uint8Array(await response.Body.transformToByteArray())
    : new Uint8Array();
  if (input.maxBytes !== undefined && body.byteLength > input.maxBytes)
    throw new MediaStorageSizeLimitError();
  return {
    body,
    byteSize: body.byteLength,
    contentType: response.ContentType,
    etag: response.ETag,
  };
};
