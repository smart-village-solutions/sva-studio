import {
  prepareExistingContentSaveUpload,
  prepareSourceUpload,
  uploadResponse,
  uploadFingerprint,
} from './upload-preparation.js';
import type { MediaAssetRecord } from '@sva/data-repositories';

import { mediaMetadataTextFields } from '@sva/media';
import { asApiItem, createApiError, parseRequestBody } from '../shared/request-helpers.js';
import { jsonResponse } from '../db.js';
import { getMediaScanEnabled } from '../runtime-secrets.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { uploadInitializationSchema } from './schemas.js';
import { readAuthorizedMediaEditingAsset } from './asset-editing-handler.js';
import { mergeMediaMetadata } from './metadata.js';
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

const resolveEditingSource = async (
  deps: MediaHttpHandlerDeps,
  ctx: AuthenticatedRequestContext,
  instanceId: string,
  data: UploadInitialization
): Promise<
  { root: MediaAssetRecord; metadata: Readonly<Record<string, unknown>> } | Response | undefined
> => {
  if (!data.editing?.sourceAssetId) return undefined;
  const selected = await readAuthorizedMediaEditingAsset(
    deps,
    ctx,
    instanceId,
    data.editing.sourceAssetId
  );
  if (selected instanceof Response) return selected;
  const root = selected.editingSourceAssetId
    ? await readAuthorizedMediaEditingAsset(deps, ctx, instanceId, selected.editingSourceAssetId)
    : selected;
  if (root instanceof Response) return root;
  if (
    root.editingSourceAssetId ||
    root.lifecycleStatus === 'provisional' ||
    root.visibility !== data.visibility
  ) {
    return createApiError(
      409,
      'conflict',
      'Die Bearbeitungsgrundlage ist für diese Kopie nicht verfügbar.',
      getRequestId(),
      { reason: 'media_editing_source_unavailable' }
    );
  }
  const metadata = Object.fromEntries(
    [...mediaMetadataTextFields, 'tags'].flatMap((key) =>
      selected.metadata[key] === undefined ? [] : [[key, selected.metadata[key]]]
    )
  );
  return { root, metadata };
};

const initializeNewUpload = async (input: {
  deps: MediaHttpHandlerDeps;
  ctx: AuthenticatedRequestContext;
  instanceId: string;
  data: UploadInitialization;
  contentSaveOperationId?: string;
  source?: { root: MediaAssetRecord; metadata: Readonly<Record<string, unknown>> };
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
    ...(input.data.editing ? { privateInput: true } : {}),
  });
  const sourceUpload = await prepareSourceUpload(
    storagePort,
    input.data,
    input.instanceId,
    assetId,
    uploadSessionId
  );
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
      metadata: mergeMediaMetadata(input.source?.metadata ?? {}, input.data.metadata ?? {}),
      editingSourceAssetId: input.source?.root.id,
      editingSourceKey: sourceUpload?.storageKey,
      editingDocument: input.data.editing?.document,
      technical: {
        uploadDraftFingerprint: uploadFingerprint(input.data),
        ...(input.data.editing ? { editingOutputIntakeKey: upload.storageKey } : {}),
        ...(input.data.editing?.source
          ? {
              editingSourceMimeType: input.data.editing.source.mimeType,
              editingSourceUploadBytes: input.data.editing.source.byteSize,
              editingSourceIntakeKey: sourceUpload?.storageKey,
            }
          : {}),
      },
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
        sourceUpload: uploadResponse(sourceUpload),
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

  if ((getMediaScanEnabled() || parsed.data.editing) && parsed.data.byteSize > 64 * 1024 * 1024) {
    return createApiError(
      413,
      'invalid_request',
      'Die Datei überschreitet das Scan-Limit von 64 MiB.',
      getRequestId(),
      { reason: 'upload_size_exceeded', maxBytes: 64 * 1024 * 1024 }
    );
  }
  const source = await resolveEditingSource(deps, ctx, instanceId, parsed.data);
  if (source instanceof Response) return source;
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
    async () => {
      try {
        return await initializeNewUpload({
          deps,
          ctx,
          instanceId,
          data: parsed.data,
          contentSaveOperationId,
          source,
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'media_editing_source_unavailable') {
          return createApiError(
            409,
            'conflict',
            'Die Bearbeitungsgrundlage wird gelöscht oder ist nicht mehr verfügbar.',
            getRequestId(),
            { reason: 'media_editing_source_unavailable' }
          );
        }
        throw error;
      }
    },
    {
      deps,
      ctx,
      instanceId,
      actionId: 'media.uploadInitialize',
      resourceType: 'media_asset',
    }
  );
};
