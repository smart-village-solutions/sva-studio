import { asApiItem, createApiError } from '../shared/request-helpers.js';
import { jsonResponse } from '../db.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import type { MediaService } from './service.js';
import {
  getMediaRequestId as getRequestId,
  readMediaUploadSessionId as readUploadSessionId,
  resolveScopedMediaInstanceId as resolveScopedInstanceId,
} from './request-context.js';
import {
  emitMediaAuditEvent,
  mapMediaAuthorizationFailure as mapAuthorizationFailure,
  resolveMediaStoragePort,
  withMediaStorageGuard,
  type MediaHttpHandlerDeps,
} from './http-support.js';
import { createMediaUploadProcessingService } from './processing.js';
import { canAccessMediaAsset } from './asset-support.js';
import { failClaimedUpload, finalizeProcessedUpload } from './upload-finalization.js';

type UploadState = Readonly<{
  uploadSession: Awaited<ReturnType<MediaService['getUploadSessionById']>>;
  asset: Awaited<ReturnType<MediaService['getAssetById']>>;
}>;

const loadUploadState = async (
  deps: MediaHttpHandlerDeps,
  instanceId: string,
  uploadSessionId: string
): Promise<UploadState> =>
  deps.withMediaService(instanceId, async (service) => {
    const uploadSession = await service.getUploadSessionById(instanceId, uploadSessionId);
    const asset = uploadSession
      ? await service.getAssetById(instanceId, uploadSession.assetId)
      : null;
    return { uploadSession, asset };
  });

const getCompletedUploadAsset = (
  state: UploadState,
  actorSubject: string
): NonNullable<UploadState['asset']> | null => {
  if (
    state.uploadSession?.status !== 'validated' ||
    state.asset?.uploadStatus !== 'processed' ||
    state.asset.processingStatus !== 'ready' ||
    !canAccessMediaAsset(state.asset, actorSubject)
  ) {
    return null;
  }
  return state.asset;
};
const createCompletedUploadResponse = async (input: {
  deps: MediaHttpHandlerDeps;
  ctx: AuthenticatedRequestContext;
  instanceId: string;
  uploadSessionId: string;
  asset: NonNullable<UploadState['asset']>;
}): Promise<Response> => {
  await emitMediaAuditEvent({
    deps: input.deps,
    ctx: input.ctx,
    instanceId: input.instanceId,
    actionId: 'media.uploadComplete',
    result: 'success',
    reasonCode: 'already_processed',
    resourceType: 'media_asset',
    resourceId: input.asset.id,
  });
  return jsonResponse(
    200,
    asApiItem(
      {
        assetId: input.asset.id,
        uploadSessionId: input.uploadSessionId,
        status: 'processed',
      },
      getRequestId()
    )
  );
};

const createProcessingService = (deps: MediaHttpHandlerDeps) => ({
  getUploadSessionById: (instanceId: string, sessionId: string) =>
    deps.withMediaService(instanceId, (service) =>
      service.getUploadSessionById(instanceId, sessionId)
    ),
  getAssetById: (instanceId: string, assetId: string) =>
    deps.withMediaService(instanceId, (service) => service.getAssetById(instanceId, assetId)),
});

const processingFailureMessage = (errorCode: string): string => {
  const messages: Readonly<Record<string, string>> = {
    storage_quota_exceeded: 'Speicherkontingent der Instanz wurde überschritten.',
    upload_processing_superseded:
      'Die Upload-Verarbeitung wurde durch einen neuen Versuch ersetzt.',
    upload_size_exceeded: 'Das hochgeladene Medium überschreitet die erlaubte Größe.',
    invalid_media_content: 'Das hochgeladene Medium konnte nicht validiert werden.',
    upload_session_not_found: 'Upload-Session wurde nicht gefunden.',
  };
  return messages[errorCode] ?? 'Medienobjekt wurde nicht gefunden.';
};

const processClaimedUpload = async (input: {
  deps: MediaHttpHandlerDeps;
  ctx: AuthenticatedRequestContext;
  instanceId: string;
  uploadSessionId: string;
  claimToken: string;
}): Promise<Response> => {
  const storagePort = await resolveMediaStoragePort(input.deps, input.instanceId);
  const result = await createMediaUploadProcessingService({
    service: createProcessingService(input.deps),
    storagePort,
    createId: input.deps.createId,
    finalizeUpload: (finalization) => finalizeProcessedUpload(input.deps, finalization),
    failUpload: (failure) => failClaimedUpload(input.deps, failure),
  }).completeUpload({
    instanceId: input.instanceId,
    uploadSessionId: input.uploadSessionId,
    claimToken: input.claimToken,
  });

  if (!result.ok) {
    await emitMediaAuditEvent({
      deps: input.deps,
      ctx: input.ctx,
      instanceId: input.instanceId,
      actionId: 'media.uploadComplete',
      result: 'failure',
      reasonCode: result.errorCode,
      resourceType: 'media_upload_session',
      resourceId: input.uploadSessionId,
    });
    const isNotFound = ['upload_session_not_found', 'asset_not_found'].includes(result.errorCode);
    const isConflict = [
      'upload_size_exceeded',
      'storage_quota_exceeded',
      'upload_processing_superseded',
    ].includes(result.errorCode);
    return createApiError(
      result.status,
      isNotFound ? 'not_found' : isConflict ? 'conflict' : 'invalid_request',
      processingFailureMessage(result.errorCode),
      getRequestId(),
      { reason: result.errorCode }
    );
  }

  await emitMediaAuditEvent({
    deps: input.deps,
    ctx: input.ctx,
    instanceId: input.instanceId,
    actionId:
      result.asset.lifecycleStatus === 'provisional'
        ? 'media.contentDraftUploaded'
        : 'media.uploadComplete',
    result: 'success',
    reasonCode: 'variants_generated',
    resourceType: 'media_asset',
    resourceId: String(result.asset.id),
  });
  return jsonResponse(
    200,
    asApiItem(
      {
        assetId: result.asset.id,
        uploadSessionId: result.uploadSessionId,
        status: 'processed',
      },
      getRequestId()
    )
  );
};

const completeUploadWithStorage = async (input: {
  deps: MediaHttpHandlerDeps;
  ctx: AuthenticatedRequestContext;
  instanceId: string;
  uploadSessionId: string;
}): Promise<Response> => {
  const initialState = await loadUploadState(input.deps, input.instanceId, input.uploadSessionId);
  if (!initialState.uploadSession) {
    return createApiError(
      404,
      'not_found',
      'Upload-Session wurde nicht gefunden.',
      getRequestId(),
      { reason: 'upload_session_not_found' }
    );
  }
  if (!initialState.asset || !canAccessMediaAsset(initialState.asset, input.ctx.user.id)) {
    return createApiError(404, 'not_found', 'Medienobjekt wurde nicht gefunden.', getRequestId(), {
      reason: 'asset_not_found',
    });
  }

  const completedAsset = getCompletedUploadAsset(initialState, input.ctx.user.id);
  if (completedAsset) {
    return createCompletedUploadResponse({ ...input, asset: completedAsset });
  }
  const claimableStatus = ['pending', 'uploaded'].includes(initialState.uploadSession.status);
  if (!claimableStatus) {
    return createApiError(
      409,
      'conflict',
      'Die Upload-Session kann nicht mehr verarbeitet werden.',
      getRequestId(),
      { reason: 'upload_session_not_processable' }
    );
  }

  const claimedSession = await input.deps.withMediaService(input.instanceId, (service) =>
    service.claimUploadSession(input.instanceId, input.uploadSessionId)
  );
  if (claimedSession) {
    if (!claimedSession.claimToken) throw new Error('media_upload_claim_token_missing');
    return processClaimedUpload({ ...input, claimToken: claimedSession.claimToken });
  }

  const completedAfterClaim = getCompletedUploadAsset(
    await loadUploadState(input.deps, input.instanceId, input.uploadSessionId),
    input.ctx.user.id
  );
  if (completedAfterClaim) {
    return createCompletedUploadResponse({ ...input, asset: completedAfterClaim });
  }
  return createApiError(
    409,
    'conflict',
    'Die Upload-Session wird bereits verarbeitet oder ist abgelaufen.',
    getRequestId(),
    { reason: 'upload_processing_in_progress' }
  );
};

export const completeUpload = async (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const instanceId = resolveScopedInstanceId(request, ctx.user.instanceId);
  if (instanceId instanceof Response) {
    return instanceId;
  }
  const uploadSessionId = readUploadSessionId(request);
  if (uploadSessionId instanceof Response) {
    return uploadSessionId;
  }

  const authorization = await deps.authorizeAction({ ctx, instanceId, action: 'media.create' });
  if (!authorization.ok) {
    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.uploadComplete',
      result: 'denied',
      reasonCode: authorization.error,
      resourceType: 'media_upload_session',
      resourceId: uploadSessionId,
    });
    return mapAuthorizationFailure(authorization);
  }

  return withMediaStorageGuard(
    () =>
      completeUploadWithStorage({
        deps,
        ctx,
        instanceId,
        uploadSessionId,
      }),
    {
      deps,
      ctx,
      instanceId,
      actionId: 'media.uploadComplete',
      resourceType: 'media_upload_session',
      resourceId: uploadSessionId,
    }
  );
};
