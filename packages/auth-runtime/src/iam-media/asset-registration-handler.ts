import { asApiItem, createApiError, parseRequestBody } from '../shared/request-helpers.js';
import { jsonResponse } from '../db.js';
import { fileTypeFromBuffer } from 'file-type';
import { mediaScanLimits } from '@sva/media';
import type { MediaAssetRecord } from '@sva/data-repositories';
import { scheduleMediaUploadProcessing } from './upload-processing-job.js';
import { deriveMediaImportAssetId, isPrivateMediaStorageKey } from './storage-key-paths.js';
import { toMediaAssetResponse } from './asset-support.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { MediaStorageObjectNotFoundError } from './storage-port.js';
import { registerBucketMediaSchema } from './schemas.js';
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
import {
  assertSupportedListAssetVisibility,
  isGeneratedVariantStorageKey,
} from './asset-record-support.js';

type BucketRegistration = ReturnType<(typeof registerBucketMediaSchema)['parse']>;

const importError = (reason: string, status = 409): Response =>
  createApiError(
    status,
    status === 403
      ? 'forbidden'
      : status === 404
        ? 'not_found'
        : status === 413 || status === 415
          ? 'invalid_request'
          : status === 503
            ? 'internal_error'
            : 'conflict',
    reason,
    getRequestId(),
    { reason }
  );

const acceptImportProcessing = async (
  input: { deps: MediaHttpHandlerDeps; instanceId: string },
  asset: MediaAssetRecord
): Promise<Response> => {
  if (asset.deletionPending) return importError('media_import_unavailable');
  if (
    asset.processingStatus === 'failed' ||
    asset.uploadStatus === 'blocked' ||
    asset.uploadStatus === 'failed'
  )
    return importError('media_import_failed');
  if (asset.uploadStatus === 'processed' && asset.processingStatus === 'ready')
    return jsonResponse(
      200,
      asApiItem(toMediaAssetResponse(assertSupportedListAssetVisibility(asset)), getRequestId())
    );
  const session = await input.deps.withMediaService(input.instanceId, (service) =>
    service.getUploadSessionByAssetId(input.instanceId, asset.id)
  );
  if (!session) return importError('media_import_session_missing');
  try {
    await (input.deps.scheduleUploadProcessing ?? scheduleMediaUploadProcessing)({
      instanceId: input.instanceId,
      uploadSessionId: session.id,
      requestId: getRequestId(),
    });
  } catch {
    // The committed private snapshot and session are retained; retry accepts the same durable job.
    return importError('media_import_processing_unavailable', 503);
  }
  return jsonResponse(202, asApiItem(toMediaAssetResponse(asset), getRequestId()));
};

const registerAuthorizedBucketMedia = async (input: {
  deps: MediaHttpHandlerDeps;
  ctx: AuthenticatedRequestContext;
  instanceId: string;
  data: BucketRegistration;
}): Promise<Response> => {
  if (
    isPrivateMediaStorageKey(input.data.storageKey) ||
    isGeneratedVariantStorageKey(input.instanceId, input.data.storageKey)
  ) {
    return createApiError(
      400,
      'invalid_request',
      'Interne Storage-Objekte können nicht als eigenständige Medienobjekte registriert werden.',
      getRequestId()
    );
  }
  const existing = await input.deps.withMediaService(input.instanceId, (service) =>
    service.getAssetByStorageKey(input.instanceId, input.data.storageKey)
  );
  if (existing) {
    await emitMediaAuditEvent({
      ...input,
      actionId: 'media.create',
      result: 'success',
      reasonCode: 'already_registered',
      resourceType: 'media_asset',
      resourceId: existing.id,
    });
    return jsonResponse(
      200,
      asApiItem(toMediaAssetResponse(assertSupportedListAssetVisibility(existing)), getRequestId())
    );
  }
  const storage = await resolveMediaStoragePort(input.deps, input.instanceId);
  const source = storage.importSource;
  if (!source || source.instanceId !== input.instanceId)
    return importError('media_import_source_untrusted');
  if (!input.data.storageKey.startsWith(source.prefix))
    return importError('media_import_source_out_of_scope', 403);
  const objectInput = { instanceId: input.instanceId, storageKey: input.data.storageKey };
  let stat;
  try {
    stat = await storage.statObject(objectInput);
  } catch (error) {
    if (error instanceof MediaStorageObjectNotFoundError)
      return importError('media_import_source_missing', 404);
    throw error;
  }
  if (!stat.etag) return importError('media_import_source_identity_unavailable');
  if (stat.byteSize <= 0 || stat.byteSize > mediaScanLimits.maxBytes)
    return importError('upload_size_exceeded', 413);
  const assetId = deriveMediaImportAssetId(input.instanceId, source.id, input.data.storageKey);
  const imported = await input.deps.withMediaService(input.instanceId, (service) =>
    service.getAssetById(input.instanceId, assetId)
  );
  if (imported) {
    if (
      imported.technical.importSourceId !== source.id ||
      imported.technical.importSourceEtag !== stat.etag ||
      imported.technical.importSourceBytes !== stat.byteSize
    )
      return importError('media_import_source_changed');
    return acceptImportProcessing(input, imported);
  }
  const quota = await input.deps.withMediaService(input.instanceId, (service) =>
    service.wouldExceedStorageQuota(input.instanceId, stat.byteSize)
  );
  if (quota.wouldExceed) return importError('storage_quota_exceeded');
  const object = await storage.readObject({ ...objectInput, maxBytes: mediaScanLimits.maxBytes });
  const after = await storage.statObject(objectInput);
  if (
    object.etag !== stat.etag ||
    after.etag !== stat.etag ||
    object.byteSize !== stat.byteSize ||
    object.body.byteLength !== stat.byteSize ||
    after.byteSize !== stat.byteSize
  )
    return importError('media_import_source_changed');
  const detected = await fileTypeFromBuffer(object.body);
  if (!detected || !['image/png', 'image/jpeg', 'image/webp'].includes(detected.mime))
    return importError('invalid_media_content', 415);
  const sessionId = input.deps.createId();
  const upload = await storage.prepareUpload({
    instanceId: input.instanceId,
    assetId,
    uploadSessionId: sessionId,
    mediaType: 'image',
    mimeType: detected.mime,
    byteSize: object.byteSize,
    privateInput: true,
  });
  let cleanupSafe = true;
  try {
    await storage.writeObject({
      instanceId: input.instanceId,
      storageKey: upload.storageKey,
      body: object.body,
      contentType: detected.mime,
    });
    const asset: MediaAssetRecord = {
      id: assetId,
      instanceId: input.instanceId,
      storageKey: upload.storageKey,
      mediaType: 'image',
      mimeType: detected.mime,
      byteSize: object.byteSize,
      visibility: source.visibility,
      uploadStatus: 'pending',
      processingStatus: 'pending',
      lifecycleStatus: 'active',
      metadata: input.data.metadata ? { ...input.data.metadata } : {},
      technical: {
        importSource: 'bucket_unregistered',
        importSourceId: source.id,
        importSourceKey: input.data.storageKey,
        importSourceEtag: stat.etag,
        importSourceBytes: stat.byteSize,
        importedAt: input.deps.now(),
        originalFileName: input.data.storageKey.split('/').pop(),
      },
    };
    cleanupSafe = false; // A lost commit acknowledgement must not delete a possibly committed snapshot.
    const inserted = await input.deps.withMediaService(input.instanceId, async (service) => {
      if (!(await service.createAssetIfAbsent(asset))) return false;
      await service.upsertUploadSession({
        id: sessionId,
        instanceId: input.instanceId,
        assetId,
        storageKey: upload.storageKey,
        mimeType: detected.mime,
        byteSize: object.byteSize,
        status: 'pending',
        expiresAt: upload.expiresAt,
      });
      return true;
    });
    cleanupSafe = !inserted;
    const saved = inserted
      ? asset
      : await input.deps.withMediaService(input.instanceId, (service) =>
          service.getAssetById(input.instanceId, assetId)
        );
    if (
      !saved ||
      saved.technical.importSourceEtag !== stat.etag ||
      saved.technical.importSourceBytes !== stat.byteSize
    )
      return importError('media_import_source_changed');
    await emitMediaAuditEvent({
      ...input,
      actionId: 'media.create',
      result: 'success',
      reasonCode: inserted ? 'import_prepared' : 'already_registered',
      resourceType: 'media_asset',
      resourceId: assetId,
    });
    return acceptImportProcessing(input, saved);
  } finally {
    if (cleanupSafe)
      await storage.deleteObject({ instanceId: input.instanceId, storageKey: upload.storageKey });
  }
};

export const registerBucketMedia = async (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const parsed = await parseRequestBody(request, registerBucketMediaSchema);
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
      actionId: 'media.create',
      result: 'denied',
      reasonCode: authorization.error,
      resourceType: 'media_asset',
    });
    return mapAuthorizationFailure(authorization);
  }

  const readAuthorization = await deps.authorizeAction({ ctx, instanceId, action: 'media.read' });
  if (!readAuthorization.ok) return mapAuthorizationFailure(readAuthorization);
  return withMediaStorageGuard(
    () => registerAuthorizedBucketMedia({ deps, ctx, instanceId, data: parsed.data }),
    {
      deps,
      ctx,
      instanceId,
      actionId: 'media.create',
      resourceType: 'media_asset',
    }
  );
};
