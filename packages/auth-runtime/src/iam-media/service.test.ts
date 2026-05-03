import { describe, expect, it, vi } from 'vitest';

import { createMediaService } from './service.js';

const createRepository = () => ({
  listAssets: vi.fn(async () => [{ id: 'asset-1' }]),
  countAssets: vi.fn(async () => 1),
  getAssetById: vi.fn(async () => ({ id: 'asset-1' })),
  listVariantsByAssetId: vi.fn(async () => [{ id: 'variant-1' }]),
  getUsageImpact: vi.fn(async () => ({ assetId: 'asset-1', totalReferences: 1, references: [] })),
  getStorageUsage: vi.fn(async () => ({ instanceId: 'tenant-a', totalBytes: 1024, assetCount: 1 })),
  getStorageQuota: vi.fn(async () => ({ instanceId: 'tenant-a', maxBytes: 2048 })),
  wouldExceedStorageQuota: vi.fn(async () => ({
    instanceId: 'tenant-a',
    currentBytes: 1024,
    additionalBytes: 2000,
    maxBytes: 2048,
    wouldExceed: true,
  })),
  upsertAsset: vi.fn(async () => undefined),
  upsertVariant: vi.fn(async () => undefined),
  upsertUploadSession: vi.fn(async () => undefined),
  getUploadSessionById: vi.fn(async () => ({ id: 'upload-1' })),
  upsertStorageUsage: vi.fn(async () => undefined),
  applyStorageUsageDelta: vi.fn(async () => undefined),
  upsertStorageQuota: vi.fn(async () => undefined),
  replaceReferences: vi.fn(async () => undefined),
  listReferencesByAssetId: vi.fn(async () => []),
});

describe('media auth runtime service', () => {
  it('delegates read operations to the repository', async () => {
    const repository = createRepository();
    const service = createMediaService(repository);

    await expect(service.listAssets({ instanceId: 'tenant-a' })).resolves.toEqual([{ id: 'asset-1' }]);
    await expect(service.countAssets({ instanceId: 'tenant-a' })).resolves.toBe(1);
    await expect(service.getAssetById('tenant-a', 'asset-1')).resolves.toEqual({ id: 'asset-1' });
    await expect(service.listVariantsByAssetId('tenant-a', 'asset-1')).resolves.toEqual([{ id: 'variant-1' }]);
    await expect(service.getUsageImpact('tenant-a', 'asset-1')).resolves.toEqual({
      assetId: 'asset-1',
      totalReferences: 1,
      references: [],
    });

    expect(repository.listAssets).toHaveBeenCalledWith({ instanceId: 'tenant-a' });
    expect(repository.countAssets).toHaveBeenCalledWith({ instanceId: 'tenant-a' });
    expect(repository.getAssetById).toHaveBeenCalledWith('tenant-a', 'asset-1');
  });

  it('delegates upload, quota, and reference mutations to the repository', async () => {
    const repository = createRepository();
    const service = createMediaService(repository);

    await service.upsertStorageQuota({ instanceId: 'tenant-a', maxBytes: 2048 });
    await service.applyStorageUsageDelta({ instanceId: 'tenant-a', totalBytesDelta: 512, assetCountDelta: 1 });
    await service.wouldExceedStorageQuota('tenant-a', 2000);
    await service.replaceReferences({
      instanceId: 'tenant-a',
      targetType: 'news',
      targetId: 'news-1',
      references: [],
    });

    expect(repository.upsertStorageQuota).toHaveBeenCalledWith({ instanceId: 'tenant-a', maxBytes: 2048 });
    expect(repository.applyStorageUsageDelta).toHaveBeenCalledWith({ instanceId: 'tenant-a', totalBytesDelta: 512, assetCountDelta: 1 });
    expect(repository.wouldExceedStorageQuota).toHaveBeenCalledWith('tenant-a', 2000);
    expect(repository.replaceReferences).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      targetType: 'news',
      targetId: 'news-1',
      references: [],
    });
  });
});
