import type { MediaAssetRecord, MediaUploadSessionRecord } from '@sva/data-repositories';
import { asApiItem, createApiError, toPayloadHash } from '../shared/request-helpers.js';
import { jsonResponse } from '../db.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { uploadInitializationSchema } from './schemas.js';
import type { MediaStoragePort, MediaUploadPreparation } from './storage-port.js';
import { getMediaRequestId as getRequestId } from './request-context.js';
import {
  resolveMediaStoragePort,
  withMediaStorageGuard,
  type MediaHttpHandlerDeps,
} from './http-support.js';

type UploadInitialization = ReturnType<(typeof uploadInitializationSchema)['parse']>;

export const uploadFingerprint = (data: UploadInitialization): string =>
  toPayloadHash(JSON.stringify({ metadata: data.metadata, editing: data.editing }));

export const prepareSourceUpload = async (
  storage: MediaStoragePort,
  data: UploadInitialization,
  instanceId: string,
  assetId: string,
  sessionId: string
): Promise<MediaUploadPreparation | undefined> =>
  data.editing?.source
    ? storage.prepareUpload({
        instanceId,
        assetId,
        uploadSessionId: `${sessionId}-source`,
        mediaType: 'image',
        ...data.editing.source,
        privateInput: true,
      })
    : undefined;

export const uploadResponse = (upload: MediaUploadPreparation | undefined) =>
  upload
    ? {
        uploadUrl: upload.uploadUrl,
        method: upload.method,
        headers: upload.headers ?? {},
        expiresAt: upload.expiresAt,
      }
    : undefined;

export const prepareExistingContentSaveUpload = async (input: {
  deps: MediaHttpHandlerDeps;
  ctx: AuthenticatedRequestContext;
  instanceId: string;
  data: UploadInitialization;
  contentSaveOperationId: string;
}): Promise<Response | null> => {
  const draftId = input.data.draftId;
  if (!draftId) {
    return createApiError(
      400,
      'invalid_request',
      'Eine Content-Speicheroperation benötigt eine Draft-ID.',
      getRequestId()
    );
  }
  const operation = await input.deps.withMediaService(input.instanceId, (service) =>
    service.getContentSaveOperation({
      instanceId: input.instanceId,
      operationId: input.contentSaveOperationId,
      actorSubject: input.ctx.user.id,
    })
  );
  if (!operation || !['preparing', 'uploading'].includes(operation.status)) {
    return createApiError(
      409,
      'conflict',
      'Die Content-Speicheroperation ist nicht mehr für Uploads geöffnet.',
      getRequestId(),
      { reason: 'content_save_operation_not_open' }
    );
  }

  const asset = await input.deps.withMediaService(input.instanceId, (service) =>
    service.getProvisionalAssetByDraft({
      instanceId: input.instanceId,
      operationId: input.contentSaveOperationId,
      draftId,
      actorSubject: input.ctx.user.id,
    })
  );
  if (!asset) return null;
  const draftMatches =
    asset.mimeType === input.data.mimeType &&
    asset.byteSize === input.data.byteSize &&
    asset.visibility === input.data.visibility &&
    asset.mediaType === input.data.mediaType &&
    (asset.technical.uploadDraftFingerprint === uploadFingerprint(input.data) ||
      (asset.technical.uploadDraftFingerprint === undefined &&
        !input.data.editing &&
        !input.data.metadata));
  if (!draftMatches) {
    return createApiError(
      409,
      'conflict',
      'Die Draft-ID wurde bereits für eine andere Datei verwendet.',
      getRequestId(),
      { reason: 'content_save_draft_reuse' }
    );
  }

  const uploadSession = await input.deps.withMediaService(input.instanceId, (service) =>
    service.getUploadSessionByAssetId(input.instanceId, asset.id)
  );
  if (!uploadSession) {
    return createApiError(
      409,
      'conflict',
      'Die Upload-Session des Medienentwurfs fehlt.',
      getRequestId(),
      { reason: 'content_save_upload_session_missing' }
    );
  }

  return withMediaStorageGuard(() => retryExistingUpload(input, asset, uploadSession), {
    deps: input.deps,
    ctx: input.ctx,
    instanceId: input.instanceId,
    actionId: 'media.uploadInitializeRetry',
    resourceType: 'media_asset',
    resourceId: asset.id,
  });
};

const retryExistingUpload = async (
  input: Parameters<typeof prepareExistingContentSaveUpload>[0],
  asset: MediaAssetRecord,
  uploadSession: MediaUploadSessionRecord
): Promise<Response> => {
  if (uploadSession.status !== 'pending') {
    return createApiError(
      409,
      'conflict',
      'Die Upload-Session wird bereits verarbeitet oder ist abgeschlossen.',
      getRequestId(),
      { reason: 'content_save_upload_session_not_pending' }
    );
  }
  const storagePort = await resolveMediaStoragePort(input.deps, input.instanceId);
  const upload = await storagePort.prepareUpload({
    instanceId: input.instanceId,
    assetId: asset.id,
    uploadSessionId: uploadSession.id,
    mediaType: input.data.mediaType,
    mimeType: input.data.mimeType,
    byteSize: input.data.byteSize,
    ...(input.data.editing ? { privateInput: true } : {}),
  });
  const sourceUpload = await prepareSourceUpload(
    storagePort,
    input.data,
    input.instanceId,
    asset.id,
    uploadSession.id
  );
  const refreshed = await input.deps.withMediaService(input.instanceId, async (service) => {
    const pending = await service.refreshPendingUploadSession({
      instanceId: input.instanceId,
      sessionId: uploadSession.id,
      storageKey: upload.storageKey,
      expiresAt: upload.expiresAt,
    });
    if (pending && input.data.editing)
      await service.upsertAsset({
        ...asset,
        editingSourceKey: sourceUpload?.storageKey,
        technical: {
          ...asset.technical,
          editingOutputIntakeKey: upload.storageKey,
          ...(sourceUpload ? { editingSourceIntakeKey: sourceUpload.storageKey } : {}),
        },
      });
    return pending;
  });
  if (!refreshed) {
    return createApiError(
      409,
      'conflict',
      'Die Upload-Session wird bereits verarbeitet oder ist abgeschlossen.',
      getRequestId(),
      { reason: 'content_save_upload_session_not_pending' }
    );
  }
  return jsonResponse(
    200,
    asApiItem(
      {
        assetId: asset.id,
        uploadSessionId: uploadSession.id,
        uploadUrl: upload.uploadUrl,
        method: upload.method,
        headers: upload.headers ?? {},
        expiresAt: upload.expiresAt,
        sourceUpload: uploadResponse(sourceUpload),
        status: 'pending',
        initializedAt: input.deps.now(),
      },
      getRequestId()
    )
  );
};
