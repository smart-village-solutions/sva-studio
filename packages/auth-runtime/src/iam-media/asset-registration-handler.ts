import { asApiItem, createApiError, parseRequestBody } from '../shared/request-helpers.js';
import { jsonResponse } from '../db.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { MediaStorageObjectNotFoundError, MediaStorageUnavailableError } from './storage-port.js';
import { registerBucketMediaSchema } from './schemas.js';
import {
  getMediaRequestId as getRequestId,
  resolveBodyScopedMediaInstanceId as resolveBodyScopedInstanceId,
} from './request-context.js';
import {
  emitMediaAuditEvent,
  handleMediaStorageUnavailable,
  mapMediaAuthorizationFailure as mapAuthorizationFailure,
  readTrustedBucketObjectMetadata,
  type MediaHttpHandlerDeps,
} from './http-support.js';
import {
  assertSupportedListAssetVisibility,
  isGeneratedVariantStorageKey,
} from './asset-record-support.js';

type BucketRegistration = ReturnType<(typeof registerBucketMediaSchema)['parse']>;

const readRegistrationObject = async (input: {
  deps: MediaHttpHandlerDeps;
  ctx: AuthenticatedRequestContext;
  instanceId: string;
  storageKey: string;
}): Promise<Response | { byteSize: number }> => {
  try {
    return await readTrustedBucketObjectMetadata(input.deps, input.instanceId, input.storageKey);
  } catch (error) {
    if (error instanceof MediaStorageObjectNotFoundError) {
      return createApiError(404, 'not_found', 'Bucket-Objekt nicht gefunden.', getRequestId());
    }
    if (error instanceof MediaStorageUnavailableError) {
      return handleMediaStorageUnavailable({
        ...input,
        actionId: 'media.create',
        resourceType: 'media_asset',
      });
    }
    throw error;
  }
};

const registerAuthorizedBucketMedia = async (input: {
  deps: MediaHttpHandlerDeps;
  ctx: AuthenticatedRequestContext;
  instanceId: string;
  data: BucketRegistration;
}): Promise<Response> => {
  if (isGeneratedVariantStorageKey(input.instanceId, input.data.storageKey)) {
    return createApiError(
      400,
      'invalid_request',
      'Generierte Varianten koennen nicht als eigenstaendige Medienobjekte registriert werden.',
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
      asApiItem(assertSupportedListAssetVisibility(existing), getRequestId())
    );
  }
  const bucketObject = await readRegistrationObject({
    deps: input.deps,
    ctx: input.ctx,
    instanceId: input.instanceId,
    storageKey: input.data.storageKey,
  });
  if (bucketObject instanceof Response) return bucketObject;
  const quota = await input.deps.withMediaService(input.instanceId, (service) =>
    service.wouldExceedStorageQuota(input.instanceId, bucketObject.byteSize)
  );
  if (quota.wouldExceed) {
    return createApiError(
      409,
      'conflict',
      'Speicherkontingent der Instanz würde überschritten.',
      getRequestId(),
      { reason: 'storage_quota_exceeded', maxBytes: quota.maxBytes }
    );
  }
  const assetId = input.deps.createId();
  const now = input.deps.now();
  const asset = {
    id: assetId,
    instanceId: input.instanceId,
    storageKey: input.data.storageKey,
    mediaType: 'image',
    mimeType: input.data.mimeType,
    byteSize: bucketObject.byteSize,
    visibility: input.data.visibility,
    uploadStatus: 'processed',
    processingStatus: 'ready',
    metadata: input.data.metadata ? { ...input.data.metadata } : {},
    technical: {
      importSource: 'bucket_unregistered',
      importedAt: now,
      originalFileName: input.data.fileName,
    },
    createdAt: now,
    updatedAt: now,
  } as const;
  await input.deps.withMediaService(input.instanceId, async (service) => {
    await service.upsertAsset(asset);
    await service.applyStorageUsageDelta({
      instanceId: input.instanceId,
      totalBytesDelta: bucketObject.byteSize,
      assetCountDelta: 1,
    });
  });
  await emitMediaAuditEvent({
    ...input,
    actionId: 'media.create',
    result: 'success',
    resourceType: 'media_asset',
    resourceId: assetId,
  });
  return jsonResponse(201, asApiItem(asset, getRequestId()));
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

  return registerAuthorizedBucketMedia({ deps, ctx, instanceId, data: parsed.data });
};
