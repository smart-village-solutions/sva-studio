import { describe, expect, it, vi } from 'vitest';

import { createMediaHttpHandlers } from './core.js';

const allowAuthorization = vi.fn(async () => ({ ok: true } as const));

const createContext = (instanceId = 'tenant-a') =>
  ({
    user: {
      id: 'kc-user-1',
      instanceId,
      requestId: 'req-1',
    },
  }) as never;

const createService = () => ({
  listAssets: vi.fn(async () => [{ id: 'asset-1' }]),
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
  getUsageImpact: vi.fn(async (_instanceId: string, assetId: string) => ({
    assetId,
    totalReferences: 1,
    references: [],
  })),
  wouldExceedStorageQuota: vi.fn(async () => ({
    instanceId: 'tenant-a',
    currentBytes: 100,
    additionalBytes: 200,
    maxBytes: 1000,
    wouldExceed: false,
  })),
  upsertAsset: vi.fn(async () => undefined),
  upsertUploadSession: vi.fn(async () => undefined),
  replaceReferences: vi.fn(async () => undefined),
});

describe('media http handlers', () => {
  it('lists media for the authenticated instance', async () => {
    const service = createService();
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
    });

    const response = await handlers.listMedia(
      new Request('http://localhost/api/v1/iam/media?instanceId=tenant-a&page=2&pageSize=10&search=townhall'),
      createContext()
    );

    expect(response.status).toBe(200);
    expect(service.listAssets).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      search: 'townhall',
      visibility: undefined,
      limit: 10,
      offset: 10,
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
    expect(service.wouldExceedStorageQuota).toHaveBeenCalledWith('tenant-a', 200);
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

  it('returns a conflict when the upload would exceed the storage quota', async () => {
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
      storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
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

    expect(response.status).toBe(409);
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

  it('updates media metadata through the scoped service', async () => {
    const service = createService();
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
      authorizeAction: allowAuthorization,
      createId: () => 'id-1',
      now: () => '2026-04-29T19:00:00.000Z',
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

  it('replaces references for a target and rejects missing media permissions', async () => {
    const service = createService();
    const authorizeAction = vi
      .fn(async ({ action }: { action: string }) =>
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
});
