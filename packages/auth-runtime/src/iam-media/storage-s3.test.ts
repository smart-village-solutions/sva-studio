import { GetObjectCommand, ListObjectsV2Command, type S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listExternalInterfaceRecordsMock,
  resolveExternalInterfaceMock,
  revealFieldMock,
} = vi.hoisted(() => ({
  listExternalInterfaceRecordsMock: vi.fn(),
  resolveExternalInterfaceMock: vi.fn(),
  revealFieldMock: vi.fn(),
}));

vi.mock('@sva/data-repositories/server', () => ({
  listExternalInterfaceRecords: (...args: Parameters<typeof listExternalInterfaceRecordsMock>) =>
    listExternalInterfaceRecordsMock(...args),
}));

vi.mock('@sva/server-runtime', () => ({
  resolveExternalInterface: (...args: Parameters<typeof resolveExternalInterfaceMock>) =>
    resolveExternalInterfaceMock(...args),
}));

vi.mock('../iam-account-management/encryption.js', () => ({
  revealField: (...args: Parameters<typeof revealFieldMock>) => revealFieldMock(...args),
}));

import {
  createConfiguredMediaStoragePort,
  createConfiguredMediaStoragePortForInstance,
  createS3ClientConfig,
  createS3MediaStoragePort,
  resolveMediaStorageConfig,
} from './storage-s3.js';
import { MediaStorageUnavailableError } from './storage-port.js';

describe('media storage s3 adapter', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    listExternalInterfaceRecordsMock.mockReset();
    resolveExternalInterfaceMock.mockReset();
    revealFieldMock.mockReset();
  });

  it('reads the default s3 interface from the instance registry before falling back to env config', async () => {
    listExternalInterfaceRecordsMock.mockResolvedValue([
      {
        id: 's3-1',
        instanceId: 'de-musterhausen',
        typeKey: 's3',
        enabled: true,
        isDefault: true,
        publicConfig: {
          endpoint: 'https://fileserver.smart-village.app',
          region: 'eu-central-1',
          bucket: 'de-musterhausen',
          accessKeyId: 'db-access',
        },
        secretConfigCiphertext: 'ciphertext',
      },
    ]);
    resolveExternalInterfaceMock.mockResolvedValue({
      id: 's3-1',
      instanceId: 'de-musterhausen',
      typeKey: 's3',
      enabled: true,
      publicConfig: {
        endpoint: 'https://fileserver.smart-village.app',
        region: 'eu-central-1',
        bucket: 'de-musterhausen',
        accessKeyId: 'db-access',
      },
      secretConfig: {
        secretAccessKey: 'db-secret',
      },
    });
    revealFieldMock.mockReturnValue('db-secret');

    const port = await createConfiguredMediaStoragePortForInstance('de-musterhausen');

    expect(port).toBeDefined();
    expect(listExternalInterfaceRecordsMock).toHaveBeenCalledWith('de-musterhausen');
    expect(resolveExternalInterfaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'de-musterhausen',
        typeKey: 's3',
        interfaceId: 's3-1',
      })
    );
  });

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

  it('lists objects from the configured instance prefix and filters pseudo-folder keys', async () => {
    const send = vi.fn().mockResolvedValue({
      Contents: [
        {
          Key: 'tenant-a/uploads/',
          Size: 0,
          LastModified: new Date('2026-06-11T08:58:00.000Z'),
        },
        {
          Key: 'tenant-a/uploads/2026/',
          Size: 0,
          LastModified: new Date('2026-06-11T08:59:00.000Z'),
        },
        {
          Key: 'tenant-a/uploads/2026/06/photo.jpg',
          Size: 42,
          LastModified: new Date('2026-06-11T09:00:00.000Z'),
        },
      ],
      NextContinuationToken: 'cursor-next',
    });

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
        client: { send } as unknown as S3Client,
        getSignedUrl: vi.fn(),
      }
    );

    await expect(
      port.listObjects({
        instanceId: 'tenant-a',
        limit: 25,
        cursor: 'cursor-current',
      })
    ).resolves.toEqual({
      items: [
        {
          storageKey: 'tenant-a/uploads/2026/06/photo.jpg',
          byteSize: 42,
          lastModified: '2026-06-11T09:00:00.000Z',
          previewUrl: null,
        },
      ],
      nextCursor: 'cursor-next',
    });

    expect(send).toHaveBeenCalledWith(
      expect.any(ListObjectsV2Command)
    );
    expect(send.mock.calls[0]?.[0].input).toEqual({
      Bucket: 'media-bucket',
      Prefix: 'tenant-a/',
      MaxKeys: 25,
      ContinuationToken: 'cursor-current',
    });
  });

  it('lists objects from the bucket root when the bucket itself is instance-scoped', async () => {
    const send = vi.fn().mockResolvedValue({
      Contents: [
        {
          Key: 'cms_uploads/photo.jpg',
          Size: 42,
          LastModified: new Date('2026-06-11T09:00:00.000Z'),
        },
      ],
      NextContinuationToken: undefined,
    });

    const port = createS3MediaStoragePort(
      {
        endpoint: 'https://minio.example.test',
        region: 'eu-central-1',
        bucket: 'de-musterhausen',
        accessKeyId: 'access',
        secretAccessKey: 'secret',
        signedUrlTtlSeconds: 900,
      },
      {
        client: { send } as unknown as S3Client,
        getSignedUrl: vi.fn(),
      }
    );

    await expect(
      port.listObjects({
        instanceId: 'de-musterhausen',
        limit: 25,
      })
    ).resolves.toEqual({
      items: [
        {
          storageKey: 'cms_uploads/photo.jpg',
          byteSize: 42,
          lastModified: '2026-06-11T09:00:00.000Z',
          previewUrl: null,
        },
      ],
      nextCursor: null,
    });

    expect(send.mock.calls[0]?.[0].input).toEqual({
      Bucket: 'de-musterhausen',
      Prefix: undefined,
      MaxKeys: 25,
      ContinuationToken: undefined,
    });
  });

  it('fails closed when storage configuration is incomplete', () => {
    vi.stubEnv('MEDIA_STORAGE_ENDPOINT', '');
    vi.stubEnv('MEDIA_STORAGE_BUCKET', '');
    vi.stubEnv('MEDIA_STORAGE_ACCESS_KEY_ID', '');
    vi.stubEnv('MEDIA_STORAGE_SECRET_ACCESS_KEY', '');

    expect(() => createConfiguredMediaStoragePort()).toThrow(MediaStorageUnavailableError);
  });
});
