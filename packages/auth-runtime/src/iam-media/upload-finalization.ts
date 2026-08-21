import type { MediaHttpHandlerDeps } from './http-support.js';
import type { MediaUploadFinalization, MediaUploadFinalizationResult } from './processing.js';

export const finalizeProcessedUpload = (
  deps: MediaHttpHandlerDeps,
  finalization: MediaUploadFinalization
): Promise<MediaUploadFinalizationResult> =>
  deps.withMediaService(finalization.instanceId, async (service) => {
    const ownsClaim = await service.lockUploadSessionClaim({
      instanceId: finalization.instanceId,
      sessionId: finalization.uploadSession.id,
      claimToken: finalization.claimToken,
    });
    if (!ownsClaim) return 'claim_superseded';

    const quotaClaimed = await service.tryApplyStorageUsageWithinQuota({
      instanceId: finalization.instanceId,
      totalBytes: finalization.totalBytes,
      assetCount: 1,
    });
    if (!quotaClaimed) {
      await service.upsertAsset({
        ...finalization.asset,
        uploadStatus: 'failed',
        processingStatus: 'failed',
        technical: {
          ...(finalization.asset.technical ?? {}),
          lastError: { code: 'storage_quota_exceeded' },
        },
      });
      await service.upsertUploadSession({ ...finalization.uploadSession, status: 'failed' });
      return 'quota_exceeded';
    }

    for (const variant of finalization.variants) {
      await service.upsertVariant(finalization.instanceId, variant);
    }
    await service.upsertAsset(finalization.asset);
    await service.upsertUploadSession(finalization.uploadSession);
    return 'finalized';
  });
