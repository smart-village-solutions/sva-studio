import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';

import { createConfiguredMediaStoragePort, createS3ClientConfig, createS3MediaStoragePort, resolveMediaStorageConfig } from './storage-s3.js';
import { MediaStorageUnavailableError } from './storage-port.js';

describe('media storage s3 adapter', () => {
  it('reads runtime configuration and builds a force-path-style client config', () => {
    vi.stubEnv('MEDIA_STORAGE_ENDPOINT', 'https://minio.example.test');
    vi.stubEnv('MEDIA_STORAGE_BUCKET', 'media-bucket');
    vi.stubEnv('MEDIA_STORAGE_ACCESS_KEY_ID', 'access');
    vi.stubEnv('MEDIA_STORAGE_SECRET_ACCESS_KEY', 'secret');
    vi.stubEnv('MEDIA_STORAGE_REGION', 'eu-west-1');

    const config = resolveMediaStorageConfig();

    expect(config).toEqual({
      endpoint: 'https://minio.example.test',
      region: 'eu-west-1',
      bucket: 'media-bucket',
      accessKeyId: 'access',
      secretAccessKey: 'secret',
      publicBaseUrl: undefined,
      signedUrlTtlSeconds: 900,
    });
    expect(createS3ClientConfig(config!)).toEqual({
      endpoint: 'https://minio.example.test',
      region: 'eu-west-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: 'access',
        secretAccessKey: 'secret',
      },
    });
  });

  it('creates signed upload and protected delivery urls through the adapter', async () => {
    const signed = vi
      .fn()
      .mockResolvedValueOnce('https://uploads.example.test/put')
      .mockResolvedValueOnce('https://downloads.example.test/get');

    const port = createS3MediaStoragePort(
      {
        endpoint: 'https://minio.example.test',
        region: 'eu-central-1',
        bucket: 'media-bucket',
        accessKeyId: 'access',
        secretAccessKey: 'secret',
        signedUrlTtlSeconds: 900,
      },
      {
        client: {} as never,
        getSignedUrl: signed,
      }
    );

    const upload = await port.prepareUpload({
      instanceId: 'tenant-a',
      assetId: 'asset-1',
      uploadSessionId: 'upload-1',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      byteSize: 1234,
    });
    const delivery = await port.resolveDelivery({
      instanceId: 'tenant-a',
      assetId: 'asset-1',
      storageKey: 'tenant-a/originals/asset-1.jpg',
      visibility: 'protected',
    });

    expect(upload.uploadUrl).toBe('https://uploads.example.test/put');
    expect(upload.storageKey).toBe('tenant-a/originals/asset-1.jpg');
    expect(delivery.deliveryUrl).toBe('https://downloads.example.test/get');

    expect(signed).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.any(PutObjectCommand),
      900
    );
    expect(signed).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.any(GetObjectCommand),
      900
    );
  });

  it('uses the configured public base url for public delivery when available', async () => {
    const port = createS3MediaStoragePort(
      {
        endpoint: 'https://minio.example.test',
        region: 'eu-central-1',
        bucket: 'media-bucket',
        accessKeyId: 'access',
        secretAccessKey: 'secret',
        publicBaseUrl: 'https://cdn.example.test/media',
        signedUrlTtlSeconds: 900,
      },
      {
        client: {} as never,
        getSignedUrl: vi.fn(),
      }
    );

    await expect(
      port.resolveDelivery({
        instanceId: 'tenant-a',
        assetId: 'asset-1',
        storageKey: 'tenant-a/originals/asset-1.jpg',
        visibility: 'public',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        deliveryUrl: 'https://cdn.example.test/media/tenant-a/originals/asset-1.jpg',
      })
    );
  });

  it('fails closed when storage configuration is incomplete', () => {
    vi.stubEnv('MEDIA_STORAGE_ENDPOINT', '');
    vi.stubEnv('MEDIA_STORAGE_BUCKET', '');
    vi.stubEnv('MEDIA_STORAGE_ACCESS_KEY_ID', '');
    vi.stubEnv('MEDIA_STORAGE_SECRET_ACCESS_KEY', '');

    expect(() => createConfiguredMediaStoragePort()).toThrow(MediaStorageUnavailableError);
  });
});
