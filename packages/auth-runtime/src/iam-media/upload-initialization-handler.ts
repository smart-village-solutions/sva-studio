import type { MediaUploadSessionRecord } from '@sva/data-repositories';

import { asApiItem, createApiError, parseRequestBody } from '../shared/request-helpers.js';
import { jsonResponse } from '../db.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { uploadInitializationSchema } from './schemas.js';
import {
  getMediaRequestId as getRequestId,
  resolveBodyScopedMediaInstanceId as resolveBodyScopedInstanceId,
} from './request-context.js';
import {
  emitMediaAuditEvent,
  mapMediaAuthorizationFailure as mapAuthorizationFailure,
  resolveMediaStoragePort,
  withMediaStorageGuard,
  type MediaHttpHandlerDeps,
} from './http-support.js';

type UploadInitialization = ReturnType<(typeof uploadInitializationSchema)['parse']>;

const prepareExistingContentSaveUpload = async (input: {
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
    asset.mediaType === input.data.mediaType;
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

  return withMediaStorageGuard(() => retryExistingUpload(input, asset.id, uploadSession), {
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
  assetId: string,
  uploadSession: MediaUploadSessionRecord
): Promise<Response> => {
  const storagePort = await resolveMediaStoragePort(input.deps, input.instanceId);
  const upload = await storagePort.prepareUpload({
    instanceId: input.instanceId,
    assetId,
    uploadSessionId: uploadSession.id,
    mediaType: input.data.mediaType,
    mimeType: input.data.mimeType,
    byteSize: input.data.byteSize,
  });
  await input.deps.withMediaService(input.instanceId, (service) =>
    service.upsertUploadSession({
      ...uploadSession,
      storageKey: upload.storageKey,
      status: 'pending',
      expiresAt: upload.expiresAt,
    })
  );
  return jsonResponse(
    200,
    asApiItem(
      {
        assetId,
        uploadSessionId: uploadSession.id,
        uploadUrl: upload.uploadUrl,
        method: upload.method,
        headers: upload.headers ?? {},
        expiresAt: upload.expiresAt,
        status: 'pending',
        initializedAt: input.deps.now(),
      },
      getRequestId()
    )
  );
};

const initializeNewUpload = async (input: {
  deps: MediaHttpHandlerDeps;
  ctx: AuthenticatedRequestContext;
  instanceId: string;
  data: UploadInitialization;
  contentSaveOperationId?: string;
}): Promise<Response> => {
  const storagePort = await resolveMediaStoragePort(input.deps, input.instanceId);
  const assetId = input.deps.createId();
  const uploadSessionId = input.deps.createId();
  const upload = await storagePort.prepareUpload({
    instanceId: input.instanceId,
    assetId,
    uploadSessionId,
    mediaType: input.data.mediaType,
    mimeType: input.data.mimeType,
    byteSize: input.data.byteSize,
  });
  await input.deps.withMediaService(input.instanceId, async (service) => {
    await service.upsertAsset({
      id: assetId,
      instanceId: input.instanceId,
      storageKey: upload.storageKey,
      mediaType: input.data.mediaType,
      mimeType: input.data.mimeType,
      byteSize: input.data.byteSize,
      visibility: input.data.visibility,
      uploadStatus: 'pending',
      processingStatus: 'pending',
      lifecycleStatus: input.contentSaveOperationId ? 'provisional' : 'active',
      provisionalOperationId: input.contentSaveOperationId,
      provisionalOwnerSubject: input.contentSaveOperationId ? input.ctx.user.id : undefined,
      provisionalDraftId: input.data.draftId,
      provisionalExpiresAt: input.contentSaveOperationId
        ? new Date(Date.parse(input.deps.now()) + 24 * 60 * 60 * 1000).toISOString()
        : undefined,
      metadata: {},
      technical: {},
    });
    await service.upsertUploadSession({
      id: uploadSessionId,
      instanceId: input.instanceId,
      assetId,
      storageKey: upload.storageKey,
      mimeType: input.data.mimeType,
      byteSize: input.data.byteSize,
      status: 'pending',
      expiresAt: upload.expiresAt,
    });
  });
  await emitMediaAuditEvent({
    deps: input.deps,
    ctx: input.ctx,
    instanceId: input.instanceId,
    actionId: 'media.uploadInitialize',
    result: 'success',
    resourceType: 'media_asset',
    resourceId: assetId,
  });
  return jsonResponse(
    201,
    asApiItem(
      {
        assetId,
        uploadSessionId,
        uploadUrl: upload.uploadUrl,
        method: upload.method,
        headers: upload.headers ?? {},
        expiresAt: upload.expiresAt,
        status: 'pending',
        initializedAt: input.deps.now(),
      },
      getRequestId()
    )
  );
};

export const initializeUpload = async (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const parsed = await parseRequestBody(request, uploadInitializationSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, getRequestId());
  }

  const instanceScope = resolveBodyScopedInstanceId(parsed.data.instanceId, ctx.user.instanceId);
  if (!instanceScope.ok) {
    return instanceScope.response;
  }
  const { instanceId } = instanceScope;
  const authorization = await deps.authorizeAction({ ctx, instanceId, action: 'media.create' });
  if (!authorization.ok) {
    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.uploadInitialize',
      result: 'denied',
      reasonCode: authorization.error,
      resourceType: 'media_asset',
    });
    return mapAuthorizationFailure(authorization);
  }

  const contentSaveOperationId = parsed.data.contentSaveOperationId;
  if (contentSaveOperationId) {
    const existingUpload = await prepareExistingContentSaveUpload({
      deps,
      ctx,
      instanceId,
      data: parsed.data,
      contentSaveOperationId,
    });
    if (existingUpload) return existingUpload;
  }

  return withMediaStorageGuard(
    () => initializeNewUpload({ deps, ctx, instanceId, data: parsed.data, contentSaveOperationId }),
    {
      deps,
      ctx,
      instanceId,
      actionId: 'media.uploadInitialize',
      resourceType: 'media_asset',
    }
  );
};
