import { describe, expect, it, vi } from 'vitest';

import { createMediaHttpHandlers } from './core.js';

const createContext = (instanceId = 'tenant-a') =>
  ({
    user: {
      instanceId,
      requestId: 'req-1',
    },
  }) as never;

const createService = () => ({
  listAssets: vi.fn(async () => [{ id: 'asset-1' }]),
  getAssetById: vi.fn(async (_instanceId: string, assetId: string) =>
    assetId === 'missing' ? null : { id: assetId, visibility: 'protected' }
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
});

describe('media http handlers', () => {
  it('lists media for the authenticated instance', async () => {
    const service = createService();
    const handlers = createMediaHttpHandlers({
      withMediaService: async (_instanceId, work) => work(service as never),
      storagePort: { prepareUpload: vi.fn(), resolveDelivery: vi.fn() } as never,
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
      visibility: 'protected',
    });
  });
});
