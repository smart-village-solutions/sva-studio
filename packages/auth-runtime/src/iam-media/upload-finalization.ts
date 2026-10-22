import type { MediaService } from './service.js';
import { getMediaEditingIntakeKeys } from './processing-editing.js';
import type { MediaHttpHandlerDeps } from './http-support.js';
import type {
  MediaUploadFailure,
  MediaUploadProcessingFailureCode,
  MediaUploadProcessingResult,
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
    // Terminal failures cannot be resumed and must not keep the original locked forever.
    editingSourceAssetId: undefined,
    editingDocument: undefined,
    uploadStatus: failure.errorCode === 'media_scan_infected' ? 'blocked' : 'failed',
    processingStatus: 'failed',
    technical: {
      ...(failure.asset.technical ?? {}),
      lastError: { code: failure.errorCode },
    },
  });
  await service.upsertUploadSession({ ...failure.uploadSession, status: 'failed' });
};

export const failClaimedUpload = (
  deps: Pick<MediaHttpHandlerDeps, 'withMediaService'>,
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
  deps: Pick<MediaHttpHandlerDeps, 'withMediaService'>,
  finalization: MediaUploadFinalization
): Promise<MediaUploadFinalizationResult> =>
  deps.withMediaService(finalization.instanceId, async (service) => {
    const ownsClaim = await service.lockUploadSessionClaim({
      instanceId: finalization.instanceId,
      sessionId: finalization.uploadSession.id,
      claimToken: finalization.claimToken,
    });
    if (!ownsClaim) return 'claim_superseded';

    if (finalization.asset.provisionalOperationId) {
      const operationOpen = await service.lockOpenContentSaveOperationForUpload({
        instanceId: finalization.instanceId,
        operationId: finalization.asset.provisionalOperationId,
      });
      if (!operationOpen) return 'claim_superseded';
    }

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

export const markProcessingFailure = async (input: {
  readonly deps: {
    readonly storagePort: Pick<
      {
        deleteObject: (input: {
          readonly instanceId: string;
          readonly storageKey: string;
        }) => Promise<void>;
      },
      'deleteObject'
    >;
    readonly failUpload: (failure: MediaUploadFailure) => Promise<MediaUploadFailureResult>;
  };
  readonly claimToken: string;
  readonly asset: Awaited<ReturnType<MediaService['getAssetById']>>;
  readonly uploadSession: Awaited<ReturnType<MediaService['getUploadSessionById']>>;
  readonly errorCode: MediaUploadProcessingFailureCode;
}): Promise<Extract<MediaUploadProcessingResult, { ok: false }>> => {
  if (!input.asset || !input.uploadSession) {
    return { ok: false, status: 404, errorCode: 'asset_not_found' };
  }

  const failureResult = await input.deps.failUpload({
    instanceId: String(input.uploadSession.instanceId),
    claimToken: input.claimToken,
    asset: input.asset,
    uploadSession: input.uploadSession,
    errorCode: input.errorCode,
  });
  if (failureResult === 'claim_superseded') {
    return { ok: false, status: 409, errorCode: 'upload_processing_superseded' };
  }

  const instanceId = String(input.uploadSession.instanceId);
  await Promise.allSettled(
    [
      ...new Set([
        String(input.uploadSession.storageKey),
        ...getMediaEditingIntakeKeys(input.asset),
      ]),
    ].map((storageKey) =>
      input.deps.storagePort.deleteObject({
        instanceId,
        storageKey,
      })
    )
  );

  return {
    ok: false,
    status:
      input.errorCode === 'upload_size_exceeded'
        ? 413
        : input.errorCode === 'storage_quota_exceeded'
          ? 409
          : 422,
    errorCode: input.errorCode,
  };
};
