import type { MediaHttpHandlerDeps } from './http-support.js';
import type {
  MediaUploadFailure,
  MediaUploadFailureResult,
  MediaUploadFinalization,
  MediaUploadFinalizationResult,
} from './processing.js';

type FailurePersistenceService = Pick<
  Parameters<Parameters<MediaHttpHandlerDeps['withMediaService']>[1]>[0],
  'upsertAsset' | 'upsertUploadSession'
>;

const persistUploadFailure = async (
  service: FailurePersistenceService,
  failure: Pick<MediaUploadFailure, 'asset' | 'uploadSession' | 'errorCode'>
): Promise<void> => {
  await service.upsertAsset({
    ...failure.asset,
    uploadStatus: 'failed',
    processingStatus: 'failed',
    technical: {
      ...(failure.asset.technical ?? {}),
      lastError: { code: failure.errorCode },
    },
  });
  await service.upsertUploadSession({ ...failure.uploadSession, status: 'failed' });
};

export const failClaimedUpload = (
  deps: MediaHttpHandlerDeps,
  failure: MediaUploadFailure
): Promise<MediaUploadFailureResult> =>
  deps.withMediaService(failure.instanceId, async (service) => {
    const ownsClaim = await service.lockUploadSessionClaim({
      instanceId: failure.instanceId,
      sessionId: failure.uploadSession.id,
      claimToken: failure.claimToken,
    });
    if (!ownsClaim) return 'claim_superseded';

    await persistUploadFailure(service, failure);
    return 'failed';
  });

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
      await persistUploadFailure(service, {
        asset: finalization.asset,
        uploadSession: finalization.uploadSession,
        errorCode: 'storage_quota_exceeded',
      });
      return 'quota_exceeded';
    }

    for (const variant of finalization.variants) {
      await service.upsertVariant(finalization.instanceId, variant);
    }
    await service.upsertAsset(finalization.asset);
    await service.upsertUploadSession(finalization.uploadSession);
    return 'finalized';
  });
