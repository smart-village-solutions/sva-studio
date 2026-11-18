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
const importErrorCodes = {
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  413: 'invalid_request',
  415: 'invalid_request',
  503: 'internal_error',
} as const;
type ImportErrorStatus = keyof typeof importErrorCodes;
const importError = (reason: string, status: ImportErrorStatus = 409) =>
  createApiError(
    status,
    importErrorCodes[status],
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
type Registration = {
  deps: MediaHttpHandlerDeps;
  ctx: AuthenticatedRequestContext;
  instanceId: string;
  data: BucketRegistration;
};
// Bound memory occupied by source bytes while a private intake is being staged.
const maxActiveSnapshots = 8;
let activeSnapshots = 0;
type Storage = Awaited<ReturnType<typeof resolveMediaStoragePort>>;
type SourceStat = Awaited<ReturnType<Storage['statObject']>>;
const readImportSnapshot = async (
  storage: Storage,
  objectInput: Parameters<Storage['statObject']>[0],
  stat: SourceStat
) => {
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
  return { object, mimeType: detected.mime };
};

const persistImportSnapshot = async (
  input: Registration,
  storage: Storage,
  source: NonNullable<Storage['importSource']>,
  stat: SourceStat,
  assetId: string,
  { object, mimeType }: Exclude<Awaited<ReturnType<typeof readImportSnapshot>>, Response>
): Promise<Response> => {
  const sessionId = input.deps.createId();
  const upload = await storage.prepareUpload({
    instanceId: input.instanceId,
    assetId,
    uploadSessionId: sessionId,
    mediaType: 'image',
    mimeType,
    byteSize: object.byteSize,
    privateInput: true,
  });
  const readIntakeOwner = () =>
    input.deps.withMediaService(input.instanceId, (service) =>
      service.getAssetByStorageKey(input.instanceId, upload.storageKey)
    );
  if (await readIntakeOwner()) return importError('media_import_storage_conflict');
  let cleanupSafe = true;
  try {
    await storage.writeObject({
      instanceId: input.instanceId,
      storageKey: upload.storageKey,
      body: object.body,
      contentType: mimeType,
    });
    const asset: MediaAssetRecord = {
      id: assetId,
      instanceId: input.instanceId,
      storageKey: upload.storageKey,
      mediaType: 'image',
      mimeType,
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
        mimeType,
        byteSize: object.byteSize,
        status: 'pending',
        expiresAt: upload.expiresAt,
      });
      return true;
    });
    if (!inserted && (await readIntakeOwner())) return importError('media_import_storage_conflict');
    cleanupSafe = !inserted;
    const saved = inserted
      ? asset
      : await input.deps.withMediaService(input.instanceId, (service) =>
          service.getAssetById(input.instanceId, assetId)
        );
    if (!saved) return importError('media_import_storage_conflict');
    if (!sourceMatches(saved, source.id, stat)) return importError('media_import_source_changed');
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

const sourceMatches = (asset: MediaAssetRecord, sourceId: string, stat: SourceStat) =>
  asset.technical.importSourceId === sourceId &&
  asset.technical.importSourceEtag === stat.etag &&
  asset.technical.importSourceBytes === stat.byteSize;

const registerAuthorizedBucketMedia = async (input: Registration): Promise<Response> => {
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
    if (!sourceMatches(imported, source.id, stat)) return importError('media_import_source_changed');
    return acceptImportProcessing(input, imported);
  }
  const quota = await input.deps.withMediaService(input.instanceId, (service) =>
    service.wouldExceedStorageQuota(input.instanceId, stat.byteSize)
  );
  if (quota.wouldExceed) return importError('storage_quota_exceeded');
  if (activeSnapshots >= maxActiveSnapshots) return importError('media_import_processing_unavailable', 503);
  activeSnapshots++;
  try {
    const snapshot = await readImportSnapshot(storage, objectInput, stat);
    if (snapshot instanceof Response) return snapshot;
    return await persistImportSnapshot(input, storage, source, stat, assetId, snapshot);
  } finally {
    activeSnapshots--;
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
