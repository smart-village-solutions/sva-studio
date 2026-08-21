import { describe, expect, it, vi } from 'vitest';

import type { MediaUploadFinalization } from './processing.js';
import { finalizeProcessedUpload } from './upload-finalization.js';

const finalization: MediaUploadFinalization = {
  instanceId: 'tenant-a',
  claimToken: '00000000-0000-4000-8000-000000000099',
  asset: {
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
  },
  uploadSession: {
    id: 'upload-1',
    instanceId: 'tenant-a',
    assetId: 'asset-1',
    storageKey: 'tenant-a/originals/asset-1.jpg',
    mimeType: 'image/jpeg',
    byteSize: 100,
    status: 'validated',
  },
  variants: [],
  totalBytes: 100,
};

const createService = () => ({
  lockUploadSessionClaim: vi.fn(async () => true),
  tryApplyStorageUsageWithinQuota: vi.fn(async () => true),
  upsertVariant: vi.fn(async () => undefined),
  upsertAsset: vi.fn(async () => undefined),
  upsertUploadSession: vi.fn(async () => undefined),
});

describe('finalizeProcessedUpload', () => {
  it('rejects a superseded claim before quota or persistence changes', async () => {
    const service = createService();
    service.lockUploadSessionClaim.mockResolvedValue(false);

    await expect(
      finalizeProcessedUpload(
        { withMediaService: async (_instanceId, work) => work(service as never) } as never,
        finalization
      )
    ).resolves.toBe('claim_superseded');

    expect(service.tryApplyStorageUsageWithinQuota).not.toHaveBeenCalled();
    expect(service.upsertAsset).not.toHaveBeenCalled();
    expect(service.upsertUploadSession).not.toHaveBeenCalled();
  });

  it('persists quota failure while holding the current claim lock', async () => {
    const service = createService();
    service.tryApplyStorageUsageWithinQuota.mockResolvedValue(false);

    await expect(
      finalizeProcessedUpload(
        { withMediaService: async (_instanceId, work) => work(service as never) } as never,
        finalization
      )
    ).resolves.toBe('quota_exceeded');

    expect(service.upsertAsset).toHaveBeenCalledWith(
      expect.objectContaining({ uploadStatus: 'failed', processingStatus: 'failed' })
    );
    expect(service.upsertUploadSession).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
  });
});
