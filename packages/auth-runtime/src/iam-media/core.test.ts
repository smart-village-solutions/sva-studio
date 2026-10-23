import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMediaEditingDocument } from '@sva/media';

import { createMediaHttpHandlers } from './core.js';
import { decodeMediaListingCursor } from './listing-cursor.js';
import { MediaStorageObjectNotFoundError, MediaStorageUnavailableError } from './storage-port.js';

const { scheduleUploadProcessing } = vi.hoisted(() => ({ scheduleUploadProcessing: vi.fn() }));
vi.mock('./upload-processing-job.js', () => ({
  scheduleMediaUploadProcessing: scheduleUploadProcessing,
}));
beforeEach(() => {
  scheduleUploadProcessing.mockReset().mockResolvedValue('queued');
});

const allowAuthorization = vi.fn(async () => ({ ok: true }) as const);
const emitAuditEvent = vi.fn(async () => undefined);

const createContext = (...args: [instanceId?: string]) =>
  ({
    user: {
      id: 'kc-user-1',
      instanceId: args.length === 0 ? 'tenant-a' : args[0],
      requestId: 'req-1',
    },
  }) as never;

const createService = () => {
  const service = {
    listAssets: vi.fn(async () => [{ id: 'asset-1' }]),
    countAssets: vi.fn(async () => 31),
    getAssetById: vi.fn(async (_instanceId: string, assetId: string) =>
      assetId === 'missing'
        ? null
        : {
            id: assetId,
            instanceId: 'tenant-a',
            storageKey: `tenant-a/originals/${assetId}.jpg`,
            mediaType: 'image',
            mimeType: 'image/jpeg',
            byteSize: 1234,
            visibility: 'protected',
            uploadStatus: 'processed',
            processingStatus: 'ready',
            metadata: {},
            technical: {},
          }
    ),
    getAssetByStorageKey: vi.fn(async () => null),
    getProvisionalAssetByDraft: vi.fn(async () => null),
    getContentSaveOperation: vi.fn(async () => null),
    lockOpenContentSaveOperationForUpload: vi.fn(async () => true),
    createContentSaveOperation: vi.fn(async (input) => input),
    replaceContentSaveOperationReferences: vi.fn(async () => true),
    markContentSaveOperationContentSaved: vi.fn(async () => true),
    commitContentSaveOperation: vi.fn(async () => true),
    markContentSaveOperationAbandonPending: vi.fn(async () => true),
    finalizeContentSaveOperationAbandoned: vi.fn(async () => true),
    listAssetsByOperation: vi.fn(async () => []),
    getUsageImpact: vi.fn(async (_instanceId: string, assetId: string) => ({
      assetId,
      totalReferences: 1,
      references: [],
    })),
    getUploadSessionById: vi.fn(async (_instanceId: string, uploadSessionId: string) => ({
      id: uploadSessionId,
      instanceId: 'tenant-a',
      assetId: 'asset-1',
      storageKey: 'tenant-a/originals/asset-1.jpg',
      mimeType: 'image/jpeg',
      byteSize: 1234,
      status: 'pending',
    })),
    getUploadSessionByAssetId: vi.fn(async () => null),
    claimUploadSession: vi.fn(async (_instanceId: string, uploadSessionId: string) => ({
      id: uploadSessionId,
      instanceId: 'tenant-a',
      assetId: 'asset-1',
      storageKey: 'tenant-a/originals/asset-1.jpg',
      mimeType: 'image/jpeg',
      byteSize: 1234,
      status: 'uploaded',
      claimToken: '00000000-0000-4000-8000-000000000099',
    })),
    lockUploadSessionClaim: vi.fn(async () => true),
    getStorageUsage: vi.fn(async () => null),
    listVariantsByAssetId: vi.fn(async () => [
      {
        id: 'variant-1',
        assetId: 'asset-1',
        storageKey: 'tenant-a/variants/asset-1/thumbnail.webp',
      },
    ]),
    listReferencesByTarget: vi.fn(async () => [
      {
        id: 'reference-1',
        assetId: 'asset-1',
        targetType: 'news',
        targetId: 'news-1',
        role: 'teaser_image',
      },
    ]),
    wouldExceedStorageQuota: vi.fn(async () => ({
      instanceId: 'tenant-a',
      currentBytes: 100,
      additionalBytes: 200,
      maxBytes: 1000,
      wouldExceed: false,
    })),
    upsertAsset: vi.fn(async () => undefined),
    upsertUploadSession: vi.fn(async () => undefined),
    refreshPendingUploadSession: vi.fn(async () => true),
    upsertVariant: vi.fn(async () => undefined),
    upsertStorageUsage: vi.fn(async () => undefined),
    applyStorageUsageDelta: vi.fn(async () => undefined),
    tryApplyStorageUsageWithinQuota: vi.fn(async () => true),
    deleteVariantsByAssetId: vi.fn(async () => undefined),
    deleteAsset: vi.fn(async () => undefined),
    claimAssetDeletion: vi.fn(async () => true),
    finalizeAssetDeletion: vi.fn(async () => true),
    listEditingCopies: vi.fn(async () => []),
    listReferencesByAssetId: vi.fn(async () => []),
    replaceReferences: vi.fn(async () => undefined),
  };
  return Object.assign(service, {
    lockAssetById: vi.fn((instanceId: string, assetId: string) =>
      service.getAssetById(instanceId, assetId)
    ),
  });
};

describe('media http handlers', () => {
  it('blocks new bucket registrations and oversized uploads when scanning is active', async () => {
    vi.stubEnv('MEDIA_SCAN_ENABLED', 'true');
    try {
      const service = createService();
      const prepareUpload = vi.fn();
      const handlers = createMediaHttpHandlers({
        withMediaService: async (_id, work) => work(service as never),
        storagePort: { prepareUpload } as never,
        authorizeAction: allowAuthorization,
        createId: () => 'id',
        now: () => new Date().toISOString(),
        emitAuditEvent,
      });
      const response = await handlers.registerBucketMedia(
        new Request('http://localhost/api/v1/iam/media/register-bucket', {
          method: 'POST',
          body: JSON.stringify({
            storageKey: 'tenant-a/test.jpg',
            fileName: 'test.jpg',
            byteSize: 100,
            mimeType: 'image/jpeg',
          }),
        }),
        createContext()
      );
      expect(response.status).toBe(409);
      expect(service.upsertAsset).not.toHaveBeenCalled();
      const oversized = await handlers.initializeUpload(
        new Request('http://localhost/api/v1/iam/media/upload-sessions', {
          method: 'POST',
          body: JSON.stringify({ byteSize: 64 * 1024 * 1024 + 1, mimeType: 'image/jpeg' }),
        }),
        createContext()
      );
      expect(oversized.status).toBe(413);
      expect(prepareUpload).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('does not query unregistered objects for an exact tag filter', async () => {
    const service = createService();
    service.listAssets.mockResolvedValue([]);
    const listObjects = vi.fn();
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_id, work) => work(service as never),
      storagePort: { listObjects } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id',
      now: () => new Date().toISOString(),
      emitAuditEvent,
    });
    const response = await handlers.listMedia(
      new Request('http://localhost/api/v1/iam/media?tag=Park'),
      createContext()
    );
    expect(response.status).toBe(200);
    expect(service.listAssets).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'tenant-a', tag: 'Park' })
    );
    expect(listObjects).not.toHaveBeenCalled();
  });

  it('adds preview URLs to registered public image assets in the library response', async () => {
    const service = createService();
    service.listAssets = vi.fn(async () => [
      {
        id: 'asset-1',
        instanceId: 'tenant-a',
        storageKey: 'tenant-a/originals/asset-1.jpg',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 100,
        visibility: 'public',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {},
        technical: {},
        updatedAt: '2026-06-11T08:00:00.000Z',
      },
    ]);
    service.countAssets = vi.fn(async () => 1);

    const storagePort = {
      listObjects: vi.fn(async () => ({ items: [], nextCursor: null })),
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(async ({ storageKey }) => ({
        deliveryUrl: `https://cdn.example.test/${storageKey}`,
        expiresAt: '2099-01-01T00:00:00.000Z',
        isPublicUrl: true,
      })),
      readObject: vi.fn(),
      writeObject: vi.fn(),
      deleteObject: vi.fn(),
    };

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.listMedia(
      new Request('http://localhost/api/v1/iam/media?instanceId=tenant-a&limit=1'),
      createContext()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: 'asset-1',
          instanceId: 'tenant-a',
          storageKey: 'tenant-a/originals/asset-1.jpg',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 100,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {},
          technical: {},
          updatedAt: '2026-06-11T08:00:00.000Z',
          previewUrl: 'https://cdn.example.test/tenant-a/originals/asset-1.jpg',
        },
      ],
      pagination: { limit: 1, nextCursor: null, hasNextPage: false },
    });
    expect(storagePort.resolveDelivery).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      assetId: 'asset-1',
      storageKey: 'tenant-a/originals/asset-1.jpg',
      visibility: 'public',
    });
  });

  it('does not expose signed delivery URLs as persisted media previews', async () => {
    const service = createService();
    service.listAssets = vi.fn(async () => [
      {
        id: 'asset-1',
        instanceId: 'tenant-a',
        storageKey: 'tenant-a/originals/asset-1.jpg',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 100,
        visibility: 'public',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {},
        technical: {},
        updatedAt: '2026-06-11T08:00:00.000Z',
      },
    ]);
    service.countAssets = vi.fn(async () => 1);

    const storagePort = {
      listObjects: vi.fn(async () => ({ items: [], nextCursor: null })),
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(async () => ({
        deliveryUrl: 'https://signed.example.test/asset-1.jpg?expires=900',
        expiresAt: '2026-06-11T08:15:00.000Z',
        isPublicUrl: false,
      })),
      readObject: vi.fn(),
      writeObject: vi.fn(),
      deleteObject: vi.fn(),
    };

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.listMedia(
      new Request(
        'http://localhost/api/v1/iam/media?instanceId=tenant-a&limit=1&visibility=public'
      ),
      createContext()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        expect.not.objectContaining({
          previewUrl: 'https://signed.example.test/asset-1.jpg?expires=900',
        }),
      ],
      pagination: { limit: 1, nextCursor: null, hasNextPage: false },
    });
  });

  it('lists registered and unregistered media with combined server-side paging', async () => {
    const service = createService();
    service.listAssets = vi.fn(async () => [
      {
        id: 'asset-1',
        instanceId: 'tenant-a',
        storageKey: 'tenant-a/originals/asset-1.jpg',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 100,
        visibility: 'public',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {},
        technical: {},
        updatedAt: '2026-06-11T08:00:00.000Z',
      },
    ]);
    service.countAssets = vi.fn(async () => 1);
    const storagePort = {
      listObjects: vi
        .fn()
        .mockResolvedValueOnce({
          items: [
            {
              storageKey: 'tenant-a/uploads/2026/06/photo-new.jpg',
              byteSize: 42,
              lastModified: '2026-06-11T09:00:00.000Z',
            },
          ],
          nextCursor: 'cursor-1',
        })
        .mockResolvedValueOnce({
          items: [
            {
              storageKey: 'tenant-a/uploads/2026/06/photo-old.jpg',
              byteSize: 7,
              lastModified: '2026-06-11T07:00:00.000Z',
            },
          ],
          nextCursor: null,
        }),
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(),
      readObject: vi.fn(),
      writeObject: vi.fn(),
      deleteObject: vi.fn(),
    };
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.listMedia(
      new Request('http://localhost/api/v1/iam/media?instanceId=tenant-a&limit=2'),
      createContext()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: expect.arrayContaining([
        expect.objectContaining({ id: 'asset-1' }),
        expect.objectContaining({ storageKey: 'tenant-a/uploads/2026/06/photo-new.jpg' }),
      ]),
      pagination: {
        limit: 2,
        nextCursor: expect.any(String),
        hasNextPage: true,
      },
    });
    expect(service.listAssets).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      search: undefined,
      visibility: undefined,
      afterStorageKey: undefined,
      order: 'storageKeyAsc',
      limit: 3,
      offset: 0,
    });
    expect(storagePort.listObjects).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      limit: 6,
      prefix: undefined,
      startAfter: undefined,
    });
  });

  it('accepts the 144-item page size exposed by the media toolbar', async () => {
    const service = createService();
    service.listAssets = vi.fn(async () => []);
    const storagePort = {
      listObjects: vi.fn(async () => ({ items: [], nextCursor: null })),
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(),
      readObject: vi.fn(),
      writeObject: vi.fn(),
      deleteObject: vi.fn(),
    };
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.listMedia(
      new Request('http://localhost/api/v1/iam/media?instanceId=tenant-a&limit=144'),
      createContext()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [],
      pagination: { limit: 144, nextCursor: null, hasNextPage: false },
    });
    expect(service.listAssets).toHaveBeenCalledWith(expect.objectContaining({ limit: 145 }));
  });

  it('does not advance beyond the scanned bucket frontier when variants fill the S3 page', async () => {
    const service = createService();
    service.listAssets = vi.fn(async () => [
      {
        id: 'asset-z',
        instanceId: 'tenant-a',
        storageKey: 'tenant-a/z.jpg',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 100,
        visibility: 'public',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {},
        technical: {},
      },
    ]);
    const storagePort = {
      listObjects: vi.fn(async () => ({
        items: [
          {
            storageKey: 'tenant-a/variants/asset-a/thumbnail.webp',
            byteSize: 12,
            lastModified: '2026-06-11T09:00:00.000Z',
          },
        ],
        nextCursor: 's3-next',
        lastScannedStorageKey: 'tenant-a/variants/asset-a/thumbnail.webp',
      })),
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(),
      readObject: vi.fn(),
      writeObject: vi.fn(),
      deleteObject: vi.fn(),
    };
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.listMedia(
      new Request('http://localhost/api/v1/iam/media?instanceId=tenant-a&limit=1'),
      createContext()
    );
    const body = (await response.json()) as {
      data: Array<{ storageKey: string }>;
      pagination: { nextCursor: string | null; hasNextPage: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.pagination.hasNextPage).toBe(true);
    expect(decodeMediaListingCursor(body.pagination.nextCursor ?? '', {})?.afterStorageKey).toBe(
      'tenant-a/variants/asset-a/thumbnail.webp'
    );
  });

  it('limits the first cursor page without traversing the full bucket', async () => {
    const service = createService();
    const registeredAssets = Array.from({ length: 9 }, (_, index) => {
      const assetNumber = index + 1;
      const hour = String(18 - index).padStart(2, '0');

      return {
        id: `asset-${assetNumber}`,
        instanceId: 'tenant-a',
        storageKey: `tenant-a/originals/asset-${assetNumber}.jpg`,
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 100 + assetNumber,
        visibility: 'public',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {},
        technical: {},
        updatedAt: `2026-06-11T${hour}:00:00.000Z`,
      };
    });

    service.listAssets = vi.fn(async ({ limit, offset }) =>
      registeredAssets.slice(offset ?? 0, (offset ?? 0) + (limit ?? registeredAssets.length))
    );
    service.countAssets = vi.fn(async () => registeredAssets.length);

    const storagePort = {
      listObjects: vi
        .fn()
        .mockResolvedValueOnce({
          items: [
            {
              storageKey: 'tenant-a/originals/asset-9.jpg',
              byteSize: 70,
              lastModified: '2026-06-11T19:00:00.000Z',
            },
            {
              storageKey: 'tenant-a/uploads/2026/06/photo-new.jpg',
              byteSize: 42,
              lastModified: '2026-06-11T17:30:00.000Z',
            },
          ],
          nextCursor: 'cursor-1',
        })
        .mockResolvedValueOnce({
          items: [
            {
              storageKey: 'tenant-a/uploads/2026/06/photo-old.jpg',
              byteSize: 7,
              lastModified: '2026-06-11T09:30:00.000Z',
            },
            {
              storageKey: 'tenant-a/uploads/2026/06/photo-old.jpg',
              byteSize: 7,
              lastModified: '2026-06-11T09:30:00.000Z',
            },
            {
              storageKey: 'tenant-a/uploads/2026/06/photo-older.jpg',
              byteSize: 5,
              lastModified: '2026-06-11T08:30:00.000Z',
            },
          ],
          nextCursor: null,
        }),
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(),
      readObject: vi.fn(),
      writeObject: vi.fn(),
      deleteObject: vi.fn(),
    };

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.listMedia(
      new Request('http://localhost/api/v1/iam/media?instanceId=tenant-a&limit=2'),
      createContext()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        expect.objectContaining({ id: 'asset-1' }),
        expect.objectContaining({ id: 'asset-2' }),
      ],
      pagination: {
        limit: 2,
        nextCursor: expect.any(String),
        hasNextPage: true,
      },
    });
    expect(service.listAssets).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      search: undefined,
      visibility: undefined,
      afterStorageKey: undefined,
      order: 'storageKeyAsc',
      limit: 3,
      offset: 0,
    });
    expect(storagePort.listObjects).toHaveBeenCalledTimes(1);
    expect(storagePort.listObjects).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      limit: 6,
      prefix: undefined,
      startAfter: undefined,
    });
  });

  it('applies search filtering to unregistered bucket items and returns the filtered total', async () => {
    const service = createService();
    service.listAssets = vi.fn(async () => []);
    service.countAssets = vi.fn(async () => 0);

    const storagePort = {
      listObjects: vi.fn(async () => ({
        items: [
          {
            storageKey: 'tenant-a/invoices/2026/report.pdf',
            byteSize: 18,
            lastModified: '2026-06-11T08:00:00.000Z',
          },
        ],
        nextCursor: null,
      })),
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(),
      readObject: vi.fn(),
      writeObject: vi.fn(),
      deleteObject: vi.fn(),
    };

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.listMedia(
      new Request('http://localhost/api/v1/iam/media?instanceId=tenant-a&search=invoices&limit=10'),
      createContext()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          source: 'bucket',
          registrationStatus: 'unregistered',
          storageKey: 'tenant-a/invoices/2026/report.pdf',
          fileName: 'report.pdf',
          folderPath: 'invoices/2026',
          relativePath: 'invoices/2026/report.pdf',
          byteSize: 18,
          updatedAt: '2026-06-11T08:00:00.000Z',
          lastModified: '2026-06-11T08:00:00.000Z',
          previewUrl: null,
        },
      ],
      pagination: { limit: 10, nextCursor: null, hasNextPage: false },
    });
    expect(storagePort.listObjects).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      limit: 22,
      prefix: 'invoices',
      startAfter: undefined,
    });
  });

  it('keeps filename and path search matches working after an item becomes registered', async () => {
    const service = createService();
    const registeredAssets = [
      {
        id: 'asset-1',
        instanceId: 'tenant-a',
        storageKey: 'tenant-a/invoices/2026/report.pdf',
        mediaType: 'image',
        mimeType: 'application/pdf',
        byteSize: 18,
        visibility: 'public',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {},
        technical: {},
        updatedAt: '2026-06-11T08:00:00.000Z',
      },
      {
        id: 'asset-2',
        instanceId: 'tenant-a',
        storageKey: 'tenant-a/uploads/2026/photo.jpg',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 11,
        visibility: 'public',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {},
        technical: {},
        updatedAt: '2026-06-11T07:00:00.000Z',
      },
    ] as const;
    service.listAssets = vi.fn(async ({ search }) =>
      search ? [registeredAssets[0]] : [...registeredAssets]
    );
    service.countAssets = vi.fn(async () => 2);

    const storagePort = {
      listObjects: vi.fn(async () => ({
        items: [],
        nextCursor: null,
      })),
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(),
      readObject: vi.fn(),
      writeObject: vi.fn(),
      deleteObject: vi.fn(),
    };

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.listMedia(
      new Request(
        'http://localhost/api/v1/iam/media?instanceId=tenant-a&search=invoices/2026&limit=10'
      ),
      createContext()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: 'asset-1',
          instanceId: 'tenant-a',
          storageKey: 'tenant-a/invoices/2026/report.pdf',
          mediaType: 'image',
          mimeType: 'application/pdf',
          byteSize: 18,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {},
          technical: {},
          updatedAt: '2026-06-11T08:00:00.000Z',
        },
      ],
      pagination: { limit: 10, nextCursor: null, hasNextPage: false },
    });
    expect(service.listAssets).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      search: 'invoices/2026',
      visibility: undefined,
      afterStorageKey: undefined,
      order: 'storageKeyAsc',
      limit: 11,
      offset: 0,
    });
  });

  it('excludes unregistered bucket items when visibility filtering is requested', async () => {
    const service = createService();
    service.listAssets = vi.fn(async () => [
      {
        id: 'asset-1',
        instanceId: 'tenant-a',
        storageKey: 'tenant-a/originals/asset-1.jpg',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 100,
        visibility: 'public',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {},
        technical: {},
        updatedAt: '2026-06-11T08:00:00.000Z',
      },
    ]);
    service.countAssets = vi.fn(async () => 1);

    const storagePort = {
      listObjects: vi.fn(async () => ({
        items: [
          {
            storageKey: 'tenant-a/uploads/2026/06/photo.jpg',
            byteSize: 12,
            lastModified: '2026-06-11T09:00:00.000Z',
          },
        ],
        nextCursor: null,
      })),
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(),
      readObject: vi.fn(),
      writeObject: vi.fn(),
      deleteObject: vi.fn(),
    };

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.listMedia(
      new Request(
        'http://localhost/api/v1/iam/media?instanceId=tenant-a&visibility=public&limit=10'
      ),
      createContext()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: 'asset-1',
          instanceId: 'tenant-a',
          storageKey: 'tenant-a/originals/asset-1.jpg',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 100,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {},
          technical: {},
          updatedAt: '2026-06-11T08:00:00.000Z',
        },
      ],
      pagination: { limit: 10, nextCursor: null, hasNextPage: false },
    });
    expect(service.listAssets).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      search: undefined,
      visibility: 'public',
      afterStorageKey: undefined,
      order: 'storageKeyAsc',
      limit: 11,
      offset: 0,
    });
    expect(storagePort.listObjects).not.toHaveBeenCalled();
  });

  it('keeps registered media available when storage is unavailable but visibility excludes bucket items', async () => {
    const service = createService();
    service.listAssets = vi.fn(async () => [
      {
        id: 'asset-1',
        instanceId: 'tenant-a',
        storageKey: 'tenant-a/originals/asset-1.jpg',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 100,
        visibility: 'public',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {},
        technical: {},
        updatedAt: '2026-06-11T08:00:00.000Z',
      },
    ]);
    service.countAssets = vi.fn(async () => 1);

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: {} as never,
      resolveStoragePort: vi.fn(async () => {
        throw new MediaStorageUnavailableError('storage unavailable');
      }),
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.listMedia(
      new Request(
        'http://localhost/api/v1/iam/media?instanceId=tenant-a&visibility=public&limit=10'
      ),
      createContext()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: 'asset-1',
          instanceId: 'tenant-a',
          storageKey: 'tenant-a/originals/asset-1.jpg',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 100,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {},
          technical: {},
          updatedAt: '2026-06-11T08:00:00.000Z',
        },
      ],
      pagination: { limit: 10, nextCursor: null, hasNextPage: false },
    });
  });

  it('returns invalid_request for unsupported visibility filters before touching storage', async () => {
    const service = createService();
    const storagePort = {
      listObjects: vi.fn(),
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(),
      readObject: vi.fn(),
      writeObject: vi.fn(),
      deleteObject: vi.fn(),
    };

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.listMedia(
      new Request(
        'http://localhost/api/v1/iam/media?instanceId=tenant-a&visibility=secret&page=1&pageSize=10'
      ),
      createContext()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
      },
    });
    expect(service.countAssets).not.toHaveBeenCalled();
    expect(storagePort.listObjects).not.toHaveBeenCalled();
  });

  it('rejects offset pagination and malformed cursors before querying either source', async () => {
    const service = createService();
    const storagePort = { listObjects: vi.fn() };
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const offsetResponse = await handlers.listMedia(
      new Request('http://localhost/api/v1/iam/media?instanceId=tenant-a&page=2&pageSize=25'),
      createContext()
    );
    const cursorResponse = await handlers.listMedia(
      new Request('http://localhost/api/v1/iam/media?instanceId=tenant-a&cursor=not-a-cursor'),
      createContext()
    );

    expect(offsetResponse.status).toBe(400);
    expect(cursorResponse.status).toBe(400);
    expect(service.listAssets).not.toHaveBeenCalled();
    expect(storagePort.listObjects).not.toHaveBeenCalled();
  });

  it('fails closed with internal_error when registered list results contain an unsupported visibility value', async () => {
    const service = createService();
    service.listAssets = vi.fn(async () => [
      {
        id: 'asset-1',
        instanceId: 'tenant-a',
        storageKey: 'tenant-a/originals/asset-1.jpg',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 100,
        visibility: 'secret',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {},
        technical: {},
        updatedAt: '2026-06-11T08:00:00.000Z',
      },
    ]);
    service.countAssets = vi.fn(async () => 1);

    const storagePort = {
      listObjects: vi.fn(async () => ({
        items: [],
        nextCursor: null,
      })),
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(),
      readObject: vi.fn(),
      writeObject: vi.fn(),
      deleteObject: vi.fn(),
    };

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    await expect(
      handlers.listMedia(
        new Request('http://localhost/api/v1/iam/media?instanceId=tenant-a&limit=10'),
        createContext()
      )
    ).resolves.toMatchObject({
      status: 500,
    });
  });

  it('initializes an edited local upload with a separate private foundation and create-time metadata', async () => {
    const service = createService();
    const prepareUpload = vi.fn(async ({ uploadSessionId }) => ({
      uploadUrl: `https://upload.test/${uploadSessionId}`,
      method: 'PUT',
      storageKey: `.protected/tenant-a/asset/intake/${uploadSessionId}`,
      expiresAt: '2026-10-23T12:00:00Z',
    }));
    const authorizeAction = vi.fn(allowAuthorization);
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload } as never,
      authorizeAction,
      createId: () => 'new-id',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    const document = createMediaEditingDocument({ annotations: {}, annotationIds: [] });
    const response = await handlers.initializeUpload(
      new Request('http://localhost/api/v1/iam/media/upload-sessions', {
        method: 'POST',
        body: JSON.stringify({
          mimeType: 'image/png',
          byteSize: 100,
          metadata: { title: 'Bearbeitet', altText: null, tags: [' Park '] },
          editing: { document, source: { mimeType: 'image/jpeg', byteSize: 200 } },
        }),
      }),
      createContext()
    );
    expect(response.status).toBe(201);
    expect(prepareUpload).toHaveBeenCalledTimes(2);
    expect(prepareUpload.mock.calls.every(([input]) => input.privateInput === true)).toBe(true);
    expect(service.upsertAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { title: 'Bearbeitet', tags: ['Park'] },
        editingDocument: document,
        editingSourceKey: '.protected/tenant-a/asset/intake/new-id-source',
        technical: expect.objectContaining({
          editingSourceMimeType: 'image/jpeg',
          editingSourceUploadBytes: 200,
        }),
      })
    );
    const body = await response.text();
    expect(body).toContain('"sourceUpload"');
    expect(body).not.toContain('editingDocument');
    expect(body).not.toContain('.protected/');
    expect(authorizeAction).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'media.update' })
    );
  });

  it('retries the same edited content draft and rejects reusing its identity for a changed design', async () => {
    const service = createService();
    const operationId = '123e4567-e89b-42d3-a456-426614174000';
    service.getContentSaveOperation.mockResolvedValue({ id: operationId, status: 'preparing' });
    const prepareUpload = vi.fn(async ({ uploadSessionId }) => ({
      uploadUrl: `https://upload.test/${uploadSessionId}`,
      method: 'PUT',
      storageKey: `.protected/tenant-a/new/intake/${uploadSessionId}`,
      expiresAt: '2026-10-23T12:00:00Z',
    }));
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'new-id',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    const payload = {
      mimeType: 'image/png',
      byteSize: 100,
      uploadContext: 'content-save',
      contentSaveOperationId: operationId,
      draftId: '123e4567-e89b-42d3-a456-426614174001',
      metadata: { title: 'Bearbeitet' },
      editing: {
        document: createMediaEditingDocument({}),
        source: { mimeType: 'image/png', byteSize: 200 },
      },
    };
    const request = (data = payload) =>
      new Request('http://localhost/api/v1/iam/media/upload-sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    expect((await handlers.initializeUpload(request(), createContext())).status).toBe(201);
    service.getProvisionalAssetByDraft.mockResolvedValue(service.upsertAsset.mock.calls[0][0]);
    service.getUploadSessionByAssetId.mockResolvedValue(
      service.upsertUploadSession.mock.calls[0][0]
    );
    const repeated = await handlers.initializeUpload(request(), createContext());
    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toMatchObject({
      data: { assetId: 'new-id', sourceUpload: { uploadUrl: 'https://upload.test/new-id-source' } },
    });
    const changed = {
      ...payload,
      editing: { ...payload.editing, document: createMediaEditingDocument({ filter: 'Sepia' }) },
    };
    expect((await handlers.initializeUpload(request(changed), createContext())).status).toBe(409);
    expect(prepareUpload).toHaveBeenCalledTimes(4);
  });

  it('creates a copy from the actual root while inheriting only editorial metadata from the selected copy', async () => {
    const service = createService();
    const selectedId = '123e4567-e89b-42d3-a456-426614174000';
    const rootId = '123e4567-e89b-42d3-a456-426614174001';
    const base = await service.getAssetById('tenant-a', selectedId);
    service.getAssetById.mockImplementation(async (_tenant, id) => ({
      ...base,
      id,
      ...(id === selectedId ? { editingSourceAssetId: rootId } : {}),
      metadata: {
        title: 'Vorlage',
        altText: 'Alt',
        description: 'Beschreibung',
        tags: ['Park'],
        crop: { x: 1 },
        focusPoint: { x: 1, y: 1 },
      },
    }));
    const prepareUpload = vi.fn(async () => ({
      uploadUrl: 'https://upload.test/put',
      method: 'PUT',
      storageKey: '.protected/tenant-a/new/intake',
      expiresAt: '2026-10-23T12:00:00Z',
    }));
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'new-id',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    const response = await handlers.initializeUpload(
      new Request('http://localhost/api/v1/iam/media/upload-sessions', {
        method: 'POST',
        body: JSON.stringify({
          mimeType: 'image/png',
          byteSize: 100,
          visibility: 'protected',
          metadata: { title: 'Vorlage · Bearbeitet', altText: null },
          editing: { document: createMediaEditingDocument({}), sourceAssetId: selectedId },
        }),
      }),
      createContext()
    );
    expect(response.status).toBe(201);
    expect(service.upsertAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        editingSourceAssetId: rootId,
        editingSourceKey: undefined,
        metadata: { title: 'Vorlage · Bearbeitet', description: 'Beschreibung', tags: ['Park'] },
      })
    );
    expect(prepareUpload).toHaveBeenCalledOnce();
  });

  it.each(['visibility', 'rights', 'deletion race'])(
    'rejects an unsafe editing source: %s',
    async (failure) => {
      const service = createService();
      if (failure === 'deletion race')
        service.upsertAsset.mockRejectedValue(new Error('media_editing_source_unavailable'));
      const prepareUpload = vi.fn(async () => ({
        uploadUrl: 'https://upload.test/put',
        method: 'PUT',
        storageKey: '.protected/tenant-a/new/intake',
        expiresAt: '2026-10-23T12:00:00Z',
      }));
      const handlers = createMediaHttpHandlers({
        withMediaService: async (_instanceId, work) => work(service as never),
        storagePort: { prepareUpload } as never,
        authorizeAction: async ({ action }) =>
          failure === 'rights' && action === 'media.read'
            ? ({
                ok: false,
                status: 403,
                error: 'forbidden',
                message: 'Keine Quellenberechtigung',
              } as const)
            : ({ ok: true } as const),
        createId: () => 'new-id',
        now: () => '2026-04-29T19:00:00.000Z',
        emitAuditEvent,
      });
      const response = await handlers.initializeUpload(
        new Request('http://localhost/api/v1/iam/media/upload-sessions', {
          method: 'POST',
          body: JSON.stringify({
            mimeType: 'image/png',
            byteSize: 100,
            visibility: failure === 'visibility' ? 'public' : 'protected',
            editing: {
              document: createMediaEditingDocument({}),
              sourceAssetId: '123e4567-e89b-42d3-a456-426614174000',
            },
          }),
        }),
        createContext()
      );
      expect(response.status).toBe(failure === 'rights' ? 403 : 409);
      if (failure !== 'deletion race') expect(prepareUpload).not.toHaveBeenCalled();
      expect(service.upsertUploadSession).not.toHaveBeenCalled();
    }
  );

  it('initializes uploads through the storage port after quota validation', async () => {
    const service = createService();
    const storagePort = {
      prepareUpload: vi.fn(async () => ({
        uploadUrl: 'https://uploads.example.test/put',
        method: 'PUT' as const,
        storageKey: 'tenant-a/originals/asset-1',
        expiresAt: '2026-04-29T20:00:00.000Z',
      })),
      resolveDelivery: vi.fn(),
    };
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort,
      authorizeAction: allowAuthorization,
      createId: vi.fn().mockReturnValueOnce('asset-1').mockReturnValueOnce('upload-1'),
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.initializeUpload(
      new Request('http://localhost/api/v1/iam/media/upload-sessions', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: 'tenant-a',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 200,
          visibility: 'protected',
        }),
      }),
      createContext()
    );

    expect(response.status).toBe(201);
    expect(service.wouldExceedStorageQuota).not.toHaveBeenCalled();
    expect(storagePort.prepareUpload).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      assetId: 'asset-1',
      uploadSessionId: 'upload-1',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      byteSize: 200,
    });
    expect(service.upsertAsset).toHaveBeenCalled();
    expect(service.upsertUploadSession).toHaveBeenCalled();
  });

  it('binds content-editor uploads to an owned provisional save operation', async () => {
    const service = createService();
    service.getContentSaveOperation = vi.fn(async () => ({
      id: '00000000-0000-4000-8000-000000000001',
      instanceId: 'tenant-a',
      actorSubject: 'kc-user-1',
      targetType: 'news',
      status: 'preparing',
      expiresAt: '2026-04-30T19:00:00.000Z',
    }));
    const storagePort = {
      prepareUpload: vi.fn(async () => ({
        uploadUrl: 'https://uploads.example.test/put',
        method: 'PUT' as const,
        storageKey: 'tenant-a/originals/asset-1',
        expiresAt: '2026-04-29T20:00:00.000Z',
      })),
      resolveDelivery: vi.fn(),
    };
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort,
      authorizeAction: allowAuthorization,
      createId: vi.fn().mockReturnValueOnce('asset-1').mockReturnValueOnce('upload-1'),
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.initializeUpload(
      new Request('http://localhost/api/v1/iam/media/upload-sessions', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: 'tenant-a',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 200,
          visibility: 'public',
          uploadContext: 'content-save',
          contentSaveOperationId: '00000000-0000-4000-8000-000000000001',
          draftId: '00000000-0000-4000-8000-000000000002',
        }),
      }),
      createContext()
    );

    expect(response.status).toBe(201);
    expect(service.upsertAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        lifecycleStatus: 'provisional',
        provisionalOperationId: '00000000-0000-4000-8000-000000000001',
        provisionalOwnerSubject: 'kc-user-1',
        provisionalDraftId: '00000000-0000-4000-8000-000000000002',
      })
    );
  });

  it('returns the same provisional asset and upload session when initialization is retried', async () => {
    const service = createService();
    service.getContentSaveOperation = vi.fn(async () => ({
      id: '00000000-0000-4000-8000-000000000001',
      instanceId: 'tenant-a',
      actorSubject: 'kc-user-1',
      targetType: 'news',
      status: 'uploading',
      expiresAt: '2026-04-30T19:00:00.000Z',
    }));
    service.getProvisionalAssetByDraft = vi.fn(async () => ({
      id: 'asset-1',
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/originals/asset-1',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      byteSize: 200,
      visibility: 'public',
      uploadStatus: 'pending',
      processingStatus: 'pending',
      lifecycleStatus: 'provisional',
      metadata: {},
      technical: {},
    }));
    service.getUploadSessionByAssetId = vi.fn(async () => ({
      id: 'upload-1',
      instanceId: 'tenant-a',
      assetId: 'asset-1',
      storageKey: 'tenant-a/originals/asset-1',
      mimeType: 'image/jpeg',
      byteSize: 200,
      status: 'pending',
    }));
    const storagePort = {
      prepareUpload: vi.fn(async () => ({
        uploadUrl: 'https://uploads.example.test/put-retry',
        method: 'PUT' as const,
        storageKey: 'tenant-a/originals/asset-1',
        expiresAt: '2026-04-29T20:00:00.000Z',
      })),
      resolveDelivery: vi.fn(),
    };
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort,
      authorizeAction: allowAuthorization,
      createId: vi.fn(),
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.initializeUpload(
      new Request('http://localhost/api/v1/iam/media/upload-sessions', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: 'tenant-a',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 200,
          visibility: 'public',
          uploadContext: 'content-save',
          contentSaveOperationId: '00000000-0000-4000-8000-000000000001',
          draftId: '00000000-0000-4000-8000-000000000002',
        }),
      }),
      createContext()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { assetId: 'asset-1', uploadSessionId: 'upload-1' },
    });
    expect(service.upsertAsset).not.toHaveBeenCalled();
    expect(service.wouldExceedStorageQuota).not.toHaveBeenCalled();
    expect(service.refreshPendingUploadSession).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      sessionId: 'upload-1',
      storageKey: 'tenant-a/originals/asset-1',
      expiresAt: '2026-04-29T20:00:00.000Z',
    });
  });

  it('preserves an active upload claim when draft initialization is retried', async () => {
    const service = createService();
    service.getContentSaveOperation = vi.fn(async () => ({
      id: '00000000-0000-4000-8000-000000000001',
      instanceId: 'tenant-a',
      actorSubject: 'kc-user-1',
      targetType: 'news',
      status: 'uploading',
      expiresAt: '2026-04-30T19:00:00.000Z',
    }));
    service.getProvisionalAssetByDraft = vi.fn(async () => ({
      id: 'asset-1',
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/originals/asset-1',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      byteSize: 200,
      visibility: 'public',
      uploadStatus: 'pending',
      processingStatus: 'pending',
      lifecycleStatus: 'provisional',
      metadata: {},
      technical: {},
    }));
    service.getUploadSessionByAssetId = vi.fn(async () => ({
      id: 'upload-1',
      instanceId: 'tenant-a',
      assetId: 'asset-1',
      storageKey: 'tenant-a/originals/asset-1',
      mimeType: 'image/jpeg',
      byteSize: 200,
      status: 'uploaded',
      claimToken: '00000000-0000-4000-8000-000000000099',
    }));
    const storagePort = { prepareUpload: vi.fn(), resolveDelivery: vi.fn() };
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: vi.fn(),
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.initializeUpload(
      new Request('http://localhost/api/v1/iam/media/upload-sessions', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: 'tenant-a',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 200,
          visibility: 'public',
          uploadContext: 'content-save',
          contentSaveOperationId: '00000000-0000-4000-8000-000000000001',
          draftId: '00000000-0000-4000-8000-000000000002',
        }),
      }),
      createContext()
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { details: { reason: 'content_save_upload_session_not_pending' } },
    });
    expect(storagePort.prepareUpload).not.toHaveBeenCalled();
    expect(service.refreshPendingUploadSession).not.toHaveBeenCalled();
    expect(service.upsertUploadSession).not.toHaveBeenCalled();
  });

  it('requires reference management before opening a content save operation', async () => {
    const service = createService();
    const authorizeAction = vi.fn(async ({ action }: { action: string }) =>
      action === 'media.reference.manage'
        ? ({
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'Keine Berechtigung für diese Medienoperation.',
          } as const)
        : ({ ok: true } as const)
    );
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
      authorizeAction,
      createId: () => '00000000-0000-4000-8000-000000000001',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.createContentSaveOperation(
      new Request('http://localhost/api/v1/iam/media/content-save-operations', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: 'tenant-a',
          targetType: 'news.article',
          operationId: '00000000-0000-4000-8000-000000000001',
        }),
      }),
      createContext()
    );

    expect(response.status).toBe(403);
    expect(authorizeAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'media.reference.manage' })
    );
    expect(service.createContentSaveOperation).not.toHaveBeenCalled();
  });

  it('creates a client-idempotent content save operation with persistent recovery', async () => {
    const service = createService();
    service.createContentSaveOperation = vi.fn(async (input) => ({
      ...input,
      createdAt: '2026-04-29T19:00:00.000Z',
      updatedAt: '2026-04-29T19:00:00.000Z',
    }));
    const scheduleContentSaveRecovery = vi.fn(async () => undefined);
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'unused',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
      scheduleContentSaveRecovery,
    });

    const response = await handlers.createContentSaveOperation(
      new Request('http://localhost/api/v1/iam/media/content-save-operations', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: 'tenant-a',
          targetType: 'news.article',
          operationId: '00000000-0000-4000-8000-000000000001',
        }),
      }),
      createContext()
    );

    expect(response.status).toBe(201);
    expect(service.createContentSaveOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000001',
        instanceId: 'tenant-a',
        actorSubject: 'kc-user-1',
        targetType: 'news.article',
        status: 'preparing',
      })
    );
    expect(scheduleContentSaveRecovery).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        operationId: '00000000-0000-4000-8000-000000000001',
        actorSubject: 'kc-user-1',
        expiresAt: '2026-04-30T19:00:00.000Z',
      })
    );
  });

  it('does not complete a provisional upload owned by another actor', async () => {
    const service = createService();
    service.getAssetById = vi.fn(async () => ({
      id: 'asset-1',
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/originals/asset-1.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      byteSize: 1234,
      visibility: 'public',
      uploadStatus: 'pending',
      processingStatus: 'pending',
      lifecycleStatus: 'provisional' as const,
      provisionalOperationId: '00000000-0000-4000-8000-000000000001',
      provisionalOwnerSubject: 'another-user',
      provisionalDraftId: '00000000-0000-4000-8000-000000000002',
      provisionalExpiresAt: '2026-04-30T19:00:00.000Z',
      metadata: {},
      technical: {},
    }));
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'unused',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.completeUpload(
      new Request(
        'http://localhost/api/v1/iam/media/upload-sessions/upload-1/complete?instanceId=tenant-a',
        { method: 'POST' }
      ),
      createContext()
    );

    expect(response.status).toBe(404);
    expect(service.upsertAsset).not.toHaveBeenCalled();
  });

  it('registers an existing bucket object as a managed media asset', async () => {
    const service = createService();
    service.getAssetByStorageKey = vi.fn(async () => null);
    const storagePort = {
      statObject: vi.fn(async () => ({
        byteSize: 84,
        contentType: 'image/jpeg',
      })),
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(),
    };

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'asset-registered',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.registerBucketMedia(
      new Request('http://localhost/api/v1/iam/media/register', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: 'tenant-a',
          storageKey: 'cms_uploads/photo.jpg',
          fileName: 'photo.jpg',
          byteSize: 42,
          mimeType: 'image/jpeg',
          visibility: 'public',
          metadata: { title: 'photo' },
        }),
      }),
      createContext()
    );

    expect(response.status).toBe(201);
    expect(storagePort.statObject).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      storageKey: 'cms_uploads/photo.jpg',
    });
    expect(service.wouldExceedStorageQuota).toHaveBeenCalledWith('tenant-a', 84);
    expect(service.upsertAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'asset-registered',
        storageKey: 'cms_uploads/photo.jpg',
        mimeType: 'image/jpeg',
        byteSize: 84,
        uploadStatus: 'processed',
        processingStatus: 'ready',
      })
    );
    expect(service.applyStorageUsageDelta).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      totalBytesDelta: 84,
      assetCountDelta: 1,
    });
  });

  it('returns the existing asset when the bucket object is already registered by storage key', async () => {
    const service = createService();
    service.getAssetByStorageKey = vi.fn(async () => ({
      id: 'asset-1',
      instanceId: 'tenant-a',
      storageKey: 'cms_uploads/photo.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      byteSize: 42,
      visibility: 'public',
      uploadStatus: 'processed',
      processingStatus: 'ready',
      metadata: {},
      technical: {},
      updatedAt: '2026-04-29T19:00:00.000Z',
    }));

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'asset-registered',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.registerBucketMedia(
      new Request('http://localhost/api/v1/iam/media/register', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: 'tenant-a',
          storageKey: 'cms_uploads/photo.jpg',
          fileName: 'photo.jpg',
          byteSize: 42,
          mimeType: 'image/jpeg',
          visibility: 'public',
        }),
      }),
      createContext()
    );

    expect(response.status).toBe(200);
    expect(service.upsertAsset).not.toHaveBeenCalled();
    expect(service.applyStorageUsageDelta).not.toHaveBeenCalled();
  });

  it('uses the trusted storage byte size instead of the client-provided bucket media size', async () => {
    const service = createService();
    service.getAssetByStorageKey = vi.fn(async () => null);
    const storagePort = {
      statObject: vi.fn(async () => ({
        byteSize: 512,
        contentType: 'image/jpeg',
      })),
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(),
    };

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'asset-registered',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.registerBucketMedia(
      new Request('http://localhost/api/v1/iam/media/register', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: 'tenant-a',
          storageKey: 'cms_uploads/photo.jpg',
          fileName: 'photo.jpg',
          byteSize: 1,
          mimeType: 'image/jpeg',
          visibility: 'public',
        }),
      }),
      createContext()
    );

    expect(response.status).toBe(201);
    expect(service.wouldExceedStorageQuota).toHaveBeenCalledWith('tenant-a', 512);
    expect(service.upsertAsset).toHaveBeenCalledWith(expect.objectContaining({ byteSize: 512 }));
    expect(service.applyStorageUsageDelta).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      totalBytesDelta: 512,
      assetCountDelta: 1,
    });
  });

  it('returns not found when the bucket object no longer exists during registration', async () => {
    const service = createService();
    service.getAssetByStorageKey = vi.fn(async () => null);
    const storagePort = {
      statObject: vi.fn(async () => {
        throw new MediaStorageObjectNotFoundError();
      }),
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(),
    };

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'asset-registered',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.registerBucketMedia(
      new Request('http://localhost/api/v1/iam/media/register', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: 'tenant-a',
          storageKey: 'cms_uploads/photo.jpg',
          fileName: 'photo.jpg',
          byteSize: 42,
          mimeType: 'image/jpeg',
          visibility: 'public',
        }),
      }),
      createContext()
    );

    expect(response.status).toBe(404);
    expect(service.upsertAsset).not.toHaveBeenCalled();
    expect(service.applyStorageUsageDelta).not.toHaveBeenCalled();
  });

  it('accepts tenant-like prefixes inside the externally isolated tenant bucket', async () => {
    const service = createService();

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: {
        prepareUpload: vi.fn(),
        resolveDelivery: vi.fn(),
        statObject: vi.fn(async () => ({ byteSize: 42 })),
      } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'asset-registered',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.registerBucketMedia(
      new Request('http://localhost/api/v1/iam/media/register', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: 'tenant-a',
          storageKey: 'tenant-b/originals/photo.jpg',
          fileName: 'photo.jpg',
          byteSize: 42,
          mimeType: 'image/jpeg',
          visibility: 'public',
        }),
      }),
      createContext()
    );

    expect(response.status).toBe(201);
    expect(service.upsertAsset).toHaveBeenCalledWith(
      expect.objectContaining({ storageKey: 'tenant-b/originals/photo.jpg' })
    );
  });

  it('merges a metadata patch into the current locked asset without reverting unrelated changes', async () => {
    const service = createService();
    const asset = await service.getAssetById('tenant-a', 'asset-1');
    if (!asset) throw new Error('Missing test asset');
    service.lockAssetById.mockResolvedValue({
      ...asset,
      metadata: { tags: ['Parallel gespeichert'] },
      technical: { editingSourceBytes: 500, editingDocumentBytes: 200 },
    });
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    const response = await handlers.updateMedia(
      new Request('http://localhost/api/v1/iam/media/asset-1', {
        method: 'PATCH',
        body: JSON.stringify({ metadata: { title: 'Neuer Titel' } }),
      }),
      createContext()
    );
    expect(response.status).toBe(200);
    expect(service.upsertAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { title: 'Neuer Titel', tags: ['Parallel gespeichert'] },
        technical: { editingSourceBytes: 500, editingDocumentBytes: 200 },
      })
    );
  });

  it('does not recreate an asset deleted before the metadata transaction acquires its lock', async () => {
    const service = createService();
    service.lockAssetById.mockResolvedValue(null);
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    const response = await handlers.updateMedia(
      new Request('http://localhost/api/v1/iam/media/asset-1', {
        method: 'PATCH',
        body: JSON.stringify({ metadata: { title: 'Neuer Titel' } }),
      }),
      createContext()
    );
    expect(response.status).toBe(404);
    expect(service.upsertAsset).not.toHaveBeenCalled();
  });

  it.each([
    '.protected/tenant-a/variants/asset/claim/thumb.webp',
    '.protected/tenant-b/variants/asset/claim/thumb.webp',
    '.quarantine/tenant-a/asset/session',
    '.quarantine/tenant-b/asset/session',
  ])('rejects private bucket registration with scanning disabled: %s', async (storageKey) => {
    vi.stubEnv('MEDIA_SCAN_ENABLED', 'false');
    try {
      const service = createService();
      const statObject = vi.fn(async () => ({ byteSize: 42 }));
      const handlers = createMediaHttpHandlers({
        withMediaService: async (_id, work) => work(service as never),
        storagePort: { statObject } as never,
        authorizeAction: allowAuthorization,
        createId: () => 'asset-registered',
        now: () => '2026-10-21T12:00:00.000Z',
        emitAuditEvent,
      });
      const response = await handlers.registerBucketMedia(
        new Request('http://localhost/api/v1/iam/media/register', {
          method: 'POST',
          body: JSON.stringify({
            storageKey,
            fileName: 'private.webp',
            byteSize: 42,
            mimeType: 'image/webp',
            visibility: 'public',
          }),
        }),
        createContext()
      );
      expect(response.status).toBe(400);
      expect(statObject).not.toHaveBeenCalled();
      expect(service.getAssetByStorageKey).not.toHaveBeenCalled();
      expect(service.upsertAsset).not.toHaveBeenCalled();
      expect(service.applyStorageUsageDelta).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('rejects registration of generated variant objects', async () => {
    const service = createService();

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'asset-registered',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.registerBucketMedia(
      new Request('http://localhost/api/v1/iam/media/register', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: 'tenant-a',
          storageKey: 'tenant-a/variants/asset-1/thumbnail.webp',
          fileName: 'thumbnail.webp',
          byteSize: 42,
          mimeType: 'image/webp',
          visibility: 'public',
        }),
      }),
      createContext()
    );

    expect(response.status).toBe(400);
    expect(service.upsertAsset).not.toHaveBeenCalled();
  });

  it('defers the hard storage quota decision until upload completion', async () => {
    const service = createService();
    service.wouldExceedStorageQuota = vi.fn(async () => ({
      instanceId: 'tenant-a',
      currentBytes: 100,
      additionalBytes: 2000,
      maxBytes: 1000,
      wouldExceed: true,
    }));

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: {
        prepareUpload: vi.fn(async () => ({
          uploadUrl: 'https://uploads.example.test/put',
          method: 'PUT' as const,
          storageKey: 'tenant-a/originals/id-1.jpg',
          expiresAt: '2026-04-29T20:00:00.000Z',
        })),
        resolveDelivery: vi.fn(),
      } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.initializeUpload(
      new Request('http://localhost/api/v1/iam/media/upload-sessions', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: 'tenant-a',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 2000,
        }),
      }),
      createContext()
    );

    expect(response.status).toBe(201);
    expect(service.wouldExceedStorageQuota).not.toHaveBeenCalled();
  });

  it('rejects upload initialization when the requested instance mismatches the session scope', async () => {
    const service = createService();
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.initializeUpload(
      new Request('http://localhost/api/v1/iam/media/upload-sessions', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: 'tenant-b',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 200,
        }),
      }),
      createContext('tenant-a')
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'forbidden',
      },
    });
  });

  it('resolves usage and controlled delivery for an asset', async () => {
    const service = createService();
    const storagePort = {
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(async () => ({
        deliveryUrl: 'https://download.example.test/media/asset-1',
        expiresAt: '2026-04-29T20:00:00.000Z',
      })),
    };

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const usageResponse = await handlers.getMediaUsage(
      new Request('http://localhost/api/v1/iam/media/asset-1/usage?instanceId=tenant-a'),
      createContext()
    );
    const deliveryResponse = await handlers.getMediaDelivery(
      new Request('http://localhost/api/v1/iam/media/asset-1/delivery?instanceId=tenant-a'),
      createContext()
    );

    expect(usageResponse.status).toBe(200);
    expect(deliveryResponse.status).toBe(200);
    expect(storagePort.resolveDelivery).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      assetId: 'asset-1',
      storageKey: 'tenant-a/originals/asset-1.jpg',
      visibility: 'protected',
    });
  });

  it('maps media storage delivery failures to a 503 API error', async () => {
    const service = createService();
    const storagePort = {
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(async () => {
        throw new MediaStorageUnavailableError();
      }),
    };

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.getMediaDelivery(
      new Request('http://localhost/api/v1/iam/media/asset-1/delivery?instanceId=tenant-a'),
      createContext()
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'internal_error',
      },
    });
  });

  it('fails closed when persisted delivery visibility is invalid', async () => {
    const service = createService();
    service.getAssetById = vi.fn(async () => ({
      id: 'asset-1',
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/originals/asset-1.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      byteSize: 1234,
      visibility: 'unexpected-visibility',
      uploadStatus: 'processed',
      processingStatus: 'ready',
      metadata: {},
      technical: {},
    }));
    const storagePort = {
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(async () => ({
        deliveryUrl: 'https://download.example.test/media/asset-1',
        expiresAt: '2026-04-29T20:00:00.000Z',
      })),
    };
    const authorizeAction = vi.fn(async () => ({ ok: true }) as const);

    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.getMediaDelivery(
      new Request('http://localhost/api/v1/iam/media/asset-1/delivery?instanceId=tenant-a'),
      createContext()
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'internal_error',
      },
    });
    expect(authorizeAction).not.toHaveBeenCalled();
    expect(storagePort.resolveDelivery).not.toHaveBeenCalled();
  });

  it('updates media metadata through the scoped service', async () => {
    const service = createService();
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.updateMedia(
      new Request('http://localhost/api/v1/iam/media/asset-1?instanceId=tenant-a', {
        method: 'PATCH',
        body: JSON.stringify({
          metadata: {
            title: 'Rathaus',
            altText: 'Rathaus außen',
          },
          visibility: 'public',
        }),
      }),
      createContext()
    );

    expect(response.status).toBe(200);
    expect(service.upsertAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'asset-1',
        visibility: 'public',
        metadata: {
          title: 'Rathaus',
          altText: 'Rathaus außen',
        },
      })
    );
  });

  it.each([
    ['public', false],
    ['protected', false],
    ['public', true],
    ['protected', true],
  ] as const)(
    'rejects changing %s visibility of scanned or edited media without writing any metadata',
    async (visibility, edited) => {
      const service = createService();
      const asset = await service.getAssetById('tenant-a', 'asset-1');
      if (!asset) throw new Error('Missing test asset');
      service.getAssetById.mockResolvedValue({
        ...asset,
        visibility,
        technical: edited ? {} : { scanStatus: 'clean' },
        ...(edited ? { editingSourceAssetId: 'source-1' } : {}),
      });
      const audit = vi.fn(async () => undefined);
      const handlers = createMediaHttpHandlers({
        withMediaService: async (_instanceId, work) => work(service as never),
        storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
        authorizeAction: allowAuthorization,
        createId: () => 'id-1',
        now: () => '2026-04-29T19:00:00.000Z',
        emitAuditEvent: audit,
      });
      const response = await handlers.updateMedia(
        new Request('http://localhost/api/v1/iam/media/asset-1?instanceId=tenant-a', {
          method: 'PATCH',
          body: JSON.stringify({
            visibility: visibility === 'public' ? 'protected' : 'public',
            metadata: { tags: ['changed'] },
          }),
        }),
        createContext()
      );
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'conflict', details: { reason: 'media_visibility_fixed' } },
      });
      expect(service.upsertAsset).not.toHaveBeenCalled();
      expect(service.getUsageImpact).not.toHaveBeenCalled();
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginAction: expect.objectContaining({
            reasonCode: 'media_visibility_fixed',
            result: 'denied',
          }),
          scope: expect.objectContaining({ instanceId: 'tenant-a' }),
        })
      );
    }
  );

  it.each([undefined, 'protected'])(
    'allows tag updates to scanned media with visibility %s',
    async (visibility) => {
      const service = createService();
      const asset = await service.getAssetById('tenant-a', 'asset-1');
      if (!asset) throw new Error('Missing test asset');
      service.getAssetById.mockResolvedValue({ ...asset, technical: { scanStatus: 'clean' } });
      const handlers = createMediaHttpHandlers({
        withMediaService: async (_instanceId, work) => work(service as never),
        storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
        authorizeAction: allowAuthorization,
        createId: () => 'id-1',
        now: () => '2026-04-29T19:00:00.000Z',
        emitAuditEvent,
      });
      const response = await handlers.updateMedia(
        new Request('http://localhost/api/v1/iam/media/asset-1?instanceId=tenant-a', {
          method: 'PATCH',
          body: JSON.stringify({ visibility, metadata: { tags: ['Rathaus'] } }),
        }),
        createContext()
      );
      expect(response.status).toBe(200);
      expect(service.upsertAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: 'protected',
          technical: { scanStatus: 'clean' },
          metadata: { tags: ['Rathaus'] },
        })
      );
    }
  );

  it('allows clearing existing media metadata fields with explicit null values', async () => {
    const service = createService();
    service.getAssetById = vi.fn(async () => ({
      id: 'asset-1',
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/originals/asset-1.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      byteSize: 1234,
      visibility: 'protected',
      uploadStatus: 'processed',
      processingStatus: 'ready',
      metadata: {
        title: 'Rathaus',
        altText: 'Rathaus außen',
        focusPoint: { x: 0.2, y: 0.8 },
      },
      technical: {},
    }));
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.updateMedia(
      new Request('http://localhost/api/v1/iam/media/asset-1?instanceId=tenant-a', {
        method: 'PATCH',
        body: JSON.stringify({
          metadata: {
            altText: null,
            focusPoint: null,
          },
        }),
      }),
      createContext()
    );

    expect(response.status).toBe(200);
    expect(service.upsertAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'asset-1',
        metadata: {
          title: 'Rathaus',
        },
      })
    );
  });

  it('replaces references for a target and rejects missing media permissions', async () => {
    const service = createService();
    const authorizeAction = vi.fn(async ({ action }: { action: string }) =>
      action === 'media.reference.manage'
        ? ({
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'Keine Berechtigung für diese Medienoperation.',
          } as const)
        : ({ ok: true } as const)
    );
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
      authorizeAction,
      createId: () => 'reference-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const denied = await handlers.replaceReferences(
      new Request('http://localhost/api/v1/iam/media/references', {
        method: 'PUT',
        body: JSON.stringify({
          targetType: 'news',
          targetId: 'news-1',
          references: [{ assetId: 'asset-1', role: 'teaser_image' }],
        }),
      }),
      createContext()
    );

    expect(denied.status).toBe(403);

    authorizeAction.mockResolvedValue({ ok: true } as const);

    const allowed = await handlers.replaceReferences(
      new Request('http://localhost/api/v1/iam/media/references', {
        method: 'PUT',
        body: JSON.stringify({
          targetType: 'news',
          targetId: 'news-1',
          references: [{ assetId: 'asset-1', role: 'teaser_image' }],
        }),
      }),
      createContext()
    );

    expect(allowed.status).toBe(200);
    expect(service.replaceReferences).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      targetType: 'news',
      targetId: 'news-1',
      references: [
        {
          id: 'reference-1',
          assetId: 'asset-1',
          targetType: 'news',
          targetId: 'news-1',
          role: 'teaser_image',
          sortOrder: undefined,
        },
      ],
    });
  });

  it('preserves attachment_image roles when listing references for poi targets', async () => {
    const service = createService();
    service.listReferencesByTarget = vi.fn(async () => [
      {
        id: 'reference-1',
        assetId: 'asset-1',
        targetType: 'poi',
        targetId: 'poi-1',
        role: 'attachment_image',
      },
    ]);
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.listReferences(
      new Request(
        'http://localhost/api/v1/iam/media/references?instanceId=tenant-a&targetType=poi&targetId=poi-1'
      ),
      createContext()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          id: 'reference-1',
          assetId: 'asset-1',
          targetType: 'poi',
          targetId: 'poi-1',
          role: 'attachment_image',
        },
      ],
    });
  });

  it('rejects unfinished content-save references before changing an existing reference set', async () => {
    const operationId = '00000000-0000-4000-8000-000000000001';
    const assetId = '00000000-0000-4000-8000-000000000002';
    const service = createService();
    service.getContentSaveOperation.mockResolvedValue({
      id: operationId,
      instanceId: 'tenant-a',
      actorSubject: 'kc-user-1',
      targetType: 'news',
      status: 'uploading',
    } as never);
    const existing = await service.getAssetById('tenant-a', assetId);
    if (!existing) throw new Error('fixture_asset_missing');
    service.getAssetById.mockResolvedValue({
      ...existing,
      uploadStatus: 'pending',
      processingStatus: 'pending',
    });
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: {} as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    const response = await handlers.replaceContentSaveOperationReferences(
      new Request(
        `http://localhost/api/v1/iam/media/content-save-operations/${operationId}/references`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceId: 'tenant-a',
            references: [{ assetId, role: 'teaser_image' }],
          }),
        }
      ),
      createContext()
    );
    expect(response.status).toBe(409);
    expect(service.replaceContentSaveOperationReferences).not.toHaveBeenCalled();
  });

  it('authorizes delivery before revealing whether an asset is ready', async () => {
    const service = createService();
    const existing = await service.getAssetById('tenant-a', 'asset-1');
    if (!existing) throw new Error('fixture_asset_missing');
    service.getAssetById.mockResolvedValue({
      ...existing,
      uploadStatus: 'pending',
      processingStatus: 'pending',
    });
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: {} as never,
      authorizeAction: async () => ({
        ok: false,
        error: 'forbidden',
        status: 403,
        message: 'Forbidden',
      }),
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    const response = await handlers.getMediaDelivery(
      new Request('http://localhost/api/v1/iam/media/asset-1/delivery?instanceId=tenant-a'),
      createContext()
    );
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('media_not_ready');
  });

  it('blocks delivery, metadata mutation and new references for unfinished media', async () => {
    const service = createService();
    service.getAssetById.mockResolvedValue({
      ...(await service.getAssetById('tenant-a', 'asset-1'))!,
      uploadStatus: 'pending',
      processingStatus: 'pending',
    });
    const resolveDelivery = vi.fn();
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { resolveDelivery } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    const response = await handlers.getMediaDelivery(
      new Request('http://localhost/api/v1/iam/media/asset-1/delivery?instanceId=tenant-a'),
      createContext()
    );
    expect(response.status).toBe(409);
    expect(resolveDelivery).not.toHaveBeenCalled();
    const refs = await handlers.replaceReferences(
      new Request('http://localhost/api/v1/iam/media/references', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: 'tenant-a',
          targetType: 'news',
          targetId: 'news-1',
          references: [{ assetId: 'asset-1', role: 'teaser_image' }],
        }),
      }),
      createContext()
    );
    expect(refs.status).toBe(404);
    expect(service.replaceReferences).not.toHaveBeenCalled();
    const update = await handlers.updateMedia(
      new Request('http://localhost/api/v1/iam/media/asset-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: 'tenant-a', metadata: { title: 'new' } }),
      }),
      createContext()
    );
    expect(update.status).toBe(409);
    expect(service.upsertAsset).not.toHaveBeenCalled();
  });

  it('accepts a durable media job without reading or processing storage in the request', async () => {
    const service = createService();
    const readObject = vi.fn();
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { readObject } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    const response = await handlers.completeUpload(
      new Request(
        'http://localhost/api/v1/iam/media/upload-sessions/upload-1/complete?instanceId=tenant-a',
        { method: 'POST' }
      ),
      createContext()
    );
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      data: { assetId: 'asset-1', status: 'processing' },
    });
    expect(scheduleUploadProcessing).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'tenant-a', uploadSessionId: 'upload-1' })
    );
    expect(readObject).not.toHaveBeenCalled();
    expect(service.claimUploadSession).not.toHaveBeenCalled();
  });

  it('returns a redacted error when media job acceptance fails', async () => {
    scheduleUploadProcessing.mockRejectedValue(new Error('private queue details'));
    const service = createService();
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: {} as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    const response = await handlers.completeUpload(
      new Request(
        'http://localhost/api/v1/iam/media/upload-sessions/upload-1/complete?instanceId=tenant-a',
        { method: 'POST' }
      ),
      createContext()
    );
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toContain('media_processing_enqueue_failed');
    expect(body).not.toContain('private queue details');
  });

  it('returns completed uploads idempotently without scheduling another job', async () => {
    const service = createService();
    service.getUploadSessionById.mockResolvedValue({
      ...(await service.getUploadSessionById('tenant-a', 'upload-1')),
      status: 'validated',
    });
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: {} as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    const response = await handlers.completeUpload(
      new Request(
        'http://localhost/api/v1/iam/media/upload-sessions/upload-1/complete?instanceId=tenant-a',
        { method: 'POST' }
      ),
      createContext()
    );
    expect(response.status).toBe(200);
    expect(scheduleUploadProcessing).not.toHaveBeenCalled();
  });

  it('passes the resolved request instance into media reference authorization when no session instance is active', async () => {
    const service = createService();
    const authorizeAction = vi.fn(async () => ({ ok: true }) as const);
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
      authorizeAction,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.listReferences(
      new Request(
        'http://localhost/api/v1/iam/media/references?instanceId=tenant-a&targetType=poi&targetId=1517831'
      ),
      createContext(undefined)
    );

    expect(response.status).toBe(200);
    expect(authorizeAction).toHaveBeenCalledWith({
      ctx: expect.objectContaining({
        user: expect.objectContaining({
          instanceId: undefined,
        }),
      }),
      instanceId: 'tenant-a',
      action: 'media.reference.manage',
      resource: {
        targetType: 'poi',
        targetId: '1517831',
      },
    });
  });

  it('keeps editing dependencies distinct from content references and filters unreadable copy details', async () => {
    const service = createService();
    service.listEditingCopies.mockResolvedValue([
      { id: 'visible-copy', metadata: { title: 'Bearbeitet' } },
      { id: 'hidden-copy', metadata: { title: 'Privater Titel' } },
    ]);
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: {} as never,
      authorizeAction: async ({ resource }) =>
        resource?.assetId === 'hidden-copy'
          ? ({ ok: false, status: 403, error: 'forbidden', message: 'Verboten' } as const)
          : ({ ok: true } as const),
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    const response = await handlers.getMediaUsage(
      new Request('http://localhost/api/v1/iam/media/asset-1/usage?instanceId=tenant-a'),
      createContext()
    );
    const data = await response.json();
    expect(data).toMatchObject({
      data: {
        totalReferences: 1,
        editingDependencies: {
          total: 2,
          items: [{ assetId: 'visible-copy', title: 'Bearbeitet' }],
        },
      },
    });
    expect(JSON.stringify(data)).not.toContain('Privater Titel');
  });

  it.each([true, false])(
    'discloses the editing foundation only with its own read authorization: %s',
    async (allowed) => {
      const service = createService();
      const asset = await service.getAssetById('tenant-a', 'asset-1');
      service.getAssetById.mockImplementation(async (_instance, id) =>
        id === 'source-1'
          ? { ...asset, id, metadata: { title: 'Quellbild' } }
          : { ...asset, editingSourceAssetId: 'source-1' }
      );
      const handlers = createMediaHttpHandlers({
        withMediaService: async (_instance, work) => work(service as never),
        storagePort: {} as never,
        authorizeAction: async ({ resource }) =>
          !allowed && resource?.assetId === 'source-1'
            ? ({ ok: false, status: 403, error: 'forbidden', message: 'Verboten' } as const)
            : ({ ok: true } as const),
        createId: () => 'id-1',
        now: () => '2026-04-29T19:00:00.000Z',
        emitAuditEvent,
      });
      const response = await handlers.getMediaUsage(
        new Request('http://localhost/api/v1/iam/media/asset-1/usage?instanceId=tenant-a'),
        createContext()
      );
      const { data } = await response.json();
      expect(data.editingSource).toEqual(
        allowed ? { assetId: 'source-1', title: 'Quellbild' } : undefined
      );
      if (!allowed) expect(JSON.stringify(data)).not.toContain('source-1');
    }
  );

  it('reports a reference/deletion race as conflict without claiming success', async () => {
    const service = createService();
    service.replaceReferences.mockRejectedValue(new Error('media_reference_asset_unavailable'));
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: {} as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    const response = await handlers.replaceReferences(
      new Request('http://localhost/api/v1/iam/media/references', {
        method: 'PUT',
        body: JSON.stringify({
          targetType: 'news',
          targetId: 'news-1',
          references: [{ assetId: '123e4567-e89b-42d3-a456-426614174000', role: 'teaser_image' }],
        }),
      }),
      createContext()
    );
    expect(response.status).toBe(409);
  });

  it('loads the authorized private foundation and portable state only through the editor endpoint', async () => {
    const service = createService();
    const root = await service.getAssetById('tenant-a', 'source-1');
    const document = createMediaEditingDocument({ annotations: {}, annotationIds: [] });
    service.getAssetById.mockImplementation(async (_instanceId, id) =>
      id === 'copy-1'
        ? { ...root, id, editingSourceAssetId: 'source-1', editingDocument: document }
        : { ...root, id, editingSourceKey: '.protected/tenant-a/source-1/source.jpg' }
    );
    const resolveDelivery = vi.fn(async () => ({
      deliveryUrl: 'https://private.test/signed',
      expiresAt: '2026-10-23T12:00:00Z',
    }));
    const authorizeAction = vi.fn(allowAuthorization);
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { resolveDelivery } as never,
      authorizeAction,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    const response = await handlers.getMediaEditing(
      new Request('http://localhost/api/v1/iam/media/copy-1/editing?instanceId=tenant-a'),
      createContext()
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toMatchObject({
      data: {
        sourceAssetId: 'source-1',
        sourceUrl: 'https://private.test/signed',
        document,
      },
    });
    expect(resolveDelivery).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      assetId: 'source-1',
      storageKey: '.protected/tenant-a/source-1/source.jpg',
      visibility: 'protected',
    });
    for (const id of ['copy-1', 'source-1']) {
      expect(authorizeAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'media.read', resource: { assetId: id } })
      );
      expect(authorizeAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'media.deliver.protected', resource: { assetId: id } })
      );
    }
  });

  it.each([
    ['missing', null, 404],
    ['foreign draft', { lifecycleStatus: 'provisional', provisionalOwnerSubject: 'other' }, 404],
    ['pending', { uploadStatus: 'pending' }, 409],
    ['deleting', { deletionPending: true }, 409],
    ['invalid visibility', { visibility: 'unexpected' }, 500],
    ['incompatible state', { editingDocument: { version: 99 } }, 409],
  ])('does not deliver editor resources for %s', async (_label, override, status) => {
    const service = createService();
    const asset = await service.getAssetById('tenant-a', 'asset-1');
    service.getAssetById.mockResolvedValue(override === null ? null : { ...asset, ...override });
    const resolveDelivery = vi.fn();
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { resolveDelivery } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    expect(
      (
        await handlers.getMediaEditing(
          new Request('http://localhost/api/v1/iam/media/asset-1/editing?instanceId=tenant-a'),
          createContext()
        )
      ).status
    ).toBe(status);
    expect(resolveDelivery).not.toHaveBeenCalled();
  });

  it('checks actual source rights before releasing a copy design or signed foundation', async () => {
    const service = createService();
    const asset = await service.getAssetById('tenant-a', 'asset-1');
    service.getAssetById.mockResolvedValue({ ...asset, editingSourceAssetId: 'source-1' });
    const resolveDelivery = vi.fn();
    const authorizeAction = vi.fn(async ({ resource }) =>
      resource?.assetId === 'source-1'
        ? ({
            ok: false,
            error: 'forbidden',
            status: 403,
            message: 'Keine Quellenberechtigung.',
          } as const)
        : ({ ok: true } as const)
    );
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { resolveDelivery } as never,
      authorizeAction,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    expect(
      (
        await handlers.getMediaEditing(
          new Request('http://localhost/api/v1/iam/media/asset-1/editing?instanceId=tenant-a'),
          createContext()
        )
      ).status
    ).toBe(403);
    expect(resolveDelivery).not.toHaveBeenCalled();
    expect(service.getAssetById).not.toHaveBeenCalledWith('tenant-a', 'source-1');
  });

  it('redacts editing sources and documents from the ordinary detail response', async () => {
    const service = createService();
    const asset = await service.getAssetById('tenant-a', 'asset-1');
    service.getAssetById.mockResolvedValue({
      ...asset,
      editingSourceAssetId: 'source-private',
      editingSourceKey: '.protected/tenant-a/private-source.jpg',
      editingDocument: { version: 1, state: { annotations: { secret: 'private design' } } },
      technical: {
        width: 100,
        editingSourceIntakeKey: '.quarantine/tenant-a/private-source',
        uploadDraftFingerprint: 'internal-fingerprint',
      },
    });
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: {} as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    const response = await handlers.getMedia(
      new Request('http://localhost/api/v1/iam/media/asset-1?instanceId=tenant-a'),
      createContext()
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('"hasEditingDocument":true');
    for (const value of [
      'editingDocument',
      'editingSource',
      'private-source',
      'private design',
      'internal-fingerprint',
    ])
      expect(body).not.toContain(value);
  });

  it('blocks a copy or reference race before touching storage', async () => {
    const service = createService();
    service.claimAssetDeletion.mockResolvedValue(false);
    const storagePort = { deleteObject: vi.fn() };
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    const response = await handlers.deleteMedia(
      new Request('http://localhost/api/v1/iam/media/asset-1?instanceId=tenant-a', {
        method: 'DELETE',
      }),
      createContext()
    );
    expect(response.status).toBe(409);
    expect(storagePort.deleteObject).not.toHaveBeenCalled();
    expect(service.finalizeAssetDeletion).not.toHaveBeenCalled();
  });

  it('retains a deletion claim on storage failure and can finish on retry', async () => {
    const service = createService();
    const deleteObject = vi
      .fn()
      .mockRejectedValueOnce(new MediaStorageUnavailableError())
      .mockResolvedValue(undefined);
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { deleteObject } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });
    const request = () =>
      new Request('http://localhost/api/v1/iam/media/asset-1?instanceId=tenant-a', {
        method: 'DELETE',
      });
    expect((await handlers.deleteMedia(request(), createContext())).status).toBe(503);
    expect(service.finalizeAssetDeletion).not.toHaveBeenCalled();
    expect((await handlers.deleteMedia(request(), createContext())).status).toBe(200);
    expect(service.finalizeAssetDeletion).toHaveBeenCalledOnce();
  });

  it('blocks deletion when an asset still has active references', async () => {
    const service = createService();
    service.listReferencesByAssetId = vi.fn(async () => [
      {
        id: 'reference-1',
        assetId: 'asset-1',
        targetType: 'news',
        targetId: 'news-1',
        role: 'teaser_image',
      },
    ]);
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.deleteMedia(
      new Request('http://localhost/api/v1/iam/media/asset-1?instanceId=tenant-a', {
        method: 'DELETE',
      }),
      createContext()
    );

    expect(response.status).toBe(409);
    expect(service.deleteAsset).not.toHaveBeenCalled();
  });

  it('deletes media blobs and decrements storage usage on successful deletion', async () => {
    const service = createService();
    service.getAssetById = vi.fn(async () => ({
      id: 'asset-1',
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/originals/asset-1.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      byteSize: 1234,
      visibility: 'protected',
      uploadStatus: 'processed',
      processingStatus: 'ready',
      metadata: {},
      technical: {
        variantBytes: 456,
      },
    }));
    service.listReferencesByAssetId = vi.fn(async () => []);
    service.listVariantsByAssetId = vi.fn(async () => [
      {
        id: 'variant-1',
        assetId: 'asset-1',
        variantKey: 'thumbnail',
        presetKey: 'thumbnail',
        format: 'webp',
        width: 320,
        storageKey: 'tenant-a/variants/asset-1/thumbnail.webp',
        generationStatus: 'ready',
      },
    ]);
    const storagePort = {
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(),
      deleteObject: vi.fn(async () => undefined),
    };
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.deleteMedia(
      new Request('http://localhost/api/v1/iam/media/asset-1?instanceId=tenant-a', {
        method: 'DELETE',
      }),
      createContext()
    );

    expect(response.status).toBe(200);
    expect(storagePort.deleteObject).toHaveBeenNthCalledWith(1, {
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/originals/asset-1.jpg',
    });
    expect(storagePort.deleteObject).toHaveBeenNthCalledWith(2, {
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/variants/asset-1/thumbnail.webp',
    });
    expect(service.claimAssetDeletion).toHaveBeenCalledWith('tenant-a', 'asset-1');
    expect(service.finalizeAssetDeletion).toHaveBeenCalledWith('tenant-a', 'asset-1');
    expect(service.applyStorageUsageDelta).not.toHaveBeenCalled();
  });

  it('deletes a private local editing source before finalizing its asset', async () => {
    const service = createService();
    service.getAssetById = vi.fn(async () => ({
      id: 'asset-1',
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/originals/asset-1.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      byteSize: 1234,
      visibility: 'protected',
      uploadStatus: 'processed',
      processingStatus: 'ready',
      editingSourceKey: '.protected/tenant-a/asset-1/source.jpg',
      metadata: {},
      technical: {
        variantTotalBytes: 789,
      },
    }));
    service.listReferencesByAssetId = vi.fn(async () => []);
    service.listVariantsByAssetId = vi.fn(async () => []);
    const storagePort = {
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(),
      deleteObject: vi.fn(async () => undefined),
    };
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
      emitAuditEvent,
    });

    const response = await handlers.deleteMedia(
      new Request('http://localhost/api/v1/iam/media/asset-1?instanceId=tenant-a', {
        method: 'DELETE',
      }),
      createContext()
    );

    expect(response.status).toBe(200);
    expect(storagePort.deleteObject).toHaveBeenLastCalledWith({
      instanceId: 'tenant-a',
      storageKey: '.protected/tenant-a/asset-1/source.jpg',
    });
    expect(service.finalizeAssetDeletion).toHaveBeenCalledWith('tenant-a', 'asset-1');
  });
});
