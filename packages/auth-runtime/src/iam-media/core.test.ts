import { describe, expect, it, vi } from 'vitest';

import { createMediaHttpHandlers } from './core.js';
import { decodeMediaListingCursor } from './listing-cursor.js';
import { MediaStorageObjectNotFoundError, MediaStorageUnavailableError } from './storage-port.js';

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

const createService = () => ({
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
  })),
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
  upsertVariant: vi.fn(async () => undefined),
  upsertStorageUsage: vi.fn(async () => undefined),
  applyStorageUsageDelta: vi.fn(async () => undefined),
  tryApplyStorageUsageWithinQuota: vi.fn(async () => true),
  deleteVariantsByAssetId: vi.fn(async () => undefined),
  deleteAsset: vi.fn(async () => undefined),
  replaceReferences: vi.fn(async () => undefined),
});

describe('media http handlers', () => {
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
    expect(service.upsertUploadSession).toHaveBeenCalledOnce();
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

  it('completes an uploaded media session through the processing service', async () => {
    const service = createService();
    const storagePort = {
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(),
      readObject: vi.fn(async () => ({
        body: await import('sharp').then((module) =>
          module
            .default({
              create: {
                width: 1200,
                height: 800,
                channels: 3,
                background: { r: 20, g: 20, b: 20 },
              },
            })
            .jpeg()
            .toBuffer()
        ),
        byteSize: 1024,
        contentType: 'image/jpeg',
      })),
      writeObject: vi.fn(async ({ body }: { body: Uint8Array }) => ({
        byteSize: body.byteLength,
      })),
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

    const response = await handlers.completeUpload(
      new Request(
        'http://localhost/api/v1/iam/media/upload-sessions/upload-1/complete?instanceId=tenant-a',
        {
          method: 'POST',
        }
      ),
      createContext()
    );

    expect(response.status).toBe(200);
  });

  it('retries a stale uploaded claim after processing throws instead of leaving it stuck', async () => {
    const service = createService();
    service.getUploadSessionById = vi.fn(async () => ({
      id: 'upload-1',
      instanceId: 'tenant-a',
      assetId: 'asset-1',
      storageKey: 'tenant-a/originals/asset-1.jpg',
      mimeType: 'image/jpeg',
      byteSize: 1234,
      status: 'uploaded',
    }));
    const storagePort = {
      readObject: vi.fn(async () => {
        throw new MediaStorageUnavailableError('storage unavailable');
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
    const request = () =>
      new Request(
        'http://localhost/api/v1/iam/media/upload-sessions/upload-1/complete?instanceId=tenant-a',
        { method: 'POST' }
      );

    expect((await handlers.completeUpload(request(), createContext())).status).toBe(503);
    expect((await handlers.completeUpload(request(), createContext())).status).toBe(503);
    expect(service.claimUploadSession).toHaveBeenCalledTimes(2);
    expect(storagePort.readObject).toHaveBeenCalledTimes(2);
  });

  it('keeps a fresh uploaded claim exclusive when it cannot be reclaimed', async () => {
    const service = createService();
    service.getUploadSessionById = vi.fn(async () => ({
      id: 'upload-1',
      instanceId: 'tenant-a',
      assetId: 'asset-1',
      storageKey: 'tenant-a/originals/asset-1.jpg',
      mimeType: 'image/jpeg',
      byteSize: 1234,
      status: 'uploaded',
    }));
    service.claimUploadSession = vi.fn(async () => null);
    const storagePort = { readObject: vi.fn() };
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
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

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { details: { reason: 'upload_processing_in_progress' } },
    });
    expect(service.claimUploadSession).toHaveBeenCalledTimes(1);
    expect(storagePort.readObject).not.toHaveBeenCalled();
  });

  it('returns the completed result when another request wins the upload claim', async () => {
    const service = createService();
    service.getUploadSessionById = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'upload-1',
        instanceId: 'tenant-a',
        assetId: 'asset-1',
        storageKey: 'tenant-a/originals/asset-1.jpg',
        mimeType: 'image/jpeg',
        byteSize: 1234,
        status: 'pending',
      })
      .mockResolvedValueOnce({
        id: 'upload-1',
        instanceId: 'tenant-a',
        assetId: 'asset-1',
        storageKey: 'tenant-a/originals/asset-1.jpg',
        mimeType: 'image/jpeg',
        byteSize: 1234,
        status: 'validated',
      });
    service.claimUploadSession = vi.fn(async () => null);
    const storagePort = { readObject: vi.fn() };
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: storagePort as never,
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
    await expect(response.json()).resolves.toMatchObject({
      data: { assetId: 'asset-1', uploadSessionId: 'upload-1', status: 'processed' },
    });
    expect(storagePort.readObject).not.toHaveBeenCalled();
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

  it('returns a server error when upload completion hits infrastructure failures after persistence starts', async () => {
    const service = createService();
    const storagePort = {
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(),
      readObject: vi.fn(async () => ({
        body: await import('sharp').then((module) =>
          module
            .default({
              create: {
                width: 1200,
                height: 800,
                channels: 3,
                background: { r: 20, g: 20, b: 20 },
              },
            })
            .jpeg()
            .toBuffer()
        ),
        byteSize: 1024,
        contentType: 'image/jpeg',
      })),
      writeObject: vi
        .fn()
        .mockResolvedValueOnce({ byteSize: 256 })
        .mockRejectedValueOnce(new Error('s3_write_failed')),
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

    await expect(
      handlers.completeUpload(
        new Request(
          'http://localhost/api/v1/iam/media/upload-sessions/upload-1/complete?instanceId=tenant-a',
          {
            method: 'POST',
          }
        ),
        createContext()
      )
    ).rejects.toThrow('s3_write_failed');
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
    expect(service.deleteAsset).toHaveBeenCalledWith('tenant-a', 'asset-1');
    expect(service.applyStorageUsageDelta).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      totalBytesDelta: -(1234 + 456),
      assetCountDelta: -1,
    });
  });

  it('falls back to legacy variantTotalBytes when deleting existing media assets', async () => {
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
    expect(service.applyStorageUsageDelta).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      totalBytesDelta: -(1234 + 789),
      assetCountDelta: -1,
    });
  });
});
