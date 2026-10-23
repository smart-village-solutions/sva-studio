import { canDeleteMediaAsset } from '@sva/media';

import { asApiItem, createApiError, parseRequestBody } from '../shared/request-helpers.js';
import { jsonResponse } from '../db.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { metadataUpdateSchema } from './schemas.js';
import {
  getMediaRequestId as getRequestId,
  readMediaAssetId as readAssetId,
  resolveBodyScopedMediaInstanceId as resolveBodyScopedInstanceId,
  resolveScopedMediaInstanceId as resolveScopedInstanceId,
} from './request-context.js';
import {
  canAccessMediaAsset,
  toMediaAssetResponse,
  persistMediaMetadataUpdate,
} from './asset-support.js';
import {
  emitMediaAuditEvent,
  mapMediaAuthorizationFailure as mapAuthorizationFailure,
  resolveMediaStoragePort,
  withMediaStorageGuard,
  type MediaHttpHandlerDeps,
} from './http-support.js';
import { deleteMediaEditingObjects } from './processing-editing.js';
import { asMediaAsset, asMediaReferences } from './asset-record-support.js';

export const updateMedia = async (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const parsed = await parseRequestBody(request, metadataUpdateSchema);
  if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, getRequestId());

  const instanceScope = resolveBodyScopedInstanceId(parsed.data.instanceId, ctx.user.instanceId);
  if (!instanceScope.ok) {
    return instanceScope.response;
  }
  const { instanceId } = instanceScope;

  const assetId = readAssetId(request);
  if (assetId instanceof Response) {
    return assetId;
  }

  const authorization = await deps.authorizeAction({
    ctx,
    instanceId,
    action: 'media.update',
    resource: { assetId },
  });
  if (!authorization.ok) {
    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.metadataUpdate',
      result: 'denied',
      reasonCode: authorization.error,
      resourceType: 'media_asset',
      resourceId: assetId,
    });
    return mapAuthorizationFailure(authorization);
  }

  const updatedAsset = await persistMediaMetadataUpdate(deps, ctx, instanceId, assetId, parsed.data);
  if (updatedAsset instanceof Response) return updatedAsset;

  const usageImpact = await deps.withMediaService(instanceId, (service) =>
    service.getUsageImpact(instanceId, assetId)
  );

  await emitMediaAuditEvent({
    deps,
    ctx,
    instanceId,
    actionId: 'media.metadataUpdate',
    result: 'success',
    reasonCode:
      parsed.data.metadata.crop || parsed.data.metadata.focusPoint
        ? 'image_edit_applied'
        : usageImpact.totalReferences > 0
          ? 'referenced_asset_updated'
          : undefined,
    resourceType: 'media_asset',
    resourceId: assetId,
  });

  return jsonResponse(
    200,
    asApiItem({ ...toMediaAssetResponse(updatedAsset), usageImpact }, getRequestId())
  );
};

const deleteAuthorizedAsset = async (input: {
  deps: MediaHttpHandlerDeps;
  ctx: AuthenticatedRequestContext;
  instanceId: string;
  assetId: string;
}): Promise<Response> => {
  const storagePort = await resolveMediaStoragePort(input.deps, input.instanceId);
  const asset = await input.deps.withMediaService(input.instanceId, (service) =>
    service.getAssetById(input.instanceId, input.assetId)
  );
  if (!asset || !canAccessMediaAsset(asset, input.ctx.user.id)) {
    await emitMediaAuditEvent({
      ...input,
      actionId: 'media.delete',
      result: 'failure',
      reasonCode: 'asset_not_found',
      resourceType: 'media_asset',
      resourceId: input.assetId,
    });
    return createApiError(404, 'not_found', 'Medienobjekt nicht gefunden.', getRequestId());
  }
  const references = await input.deps.withMediaService(input.instanceId, (service) =>
    service.listReferencesByAssetId(input.instanceId, input.assetId)
  );
  const decision = canDeleteMediaAsset({
    asset: asMediaAsset(asset)!,
    references: asMediaReferences(references),
  });
  if (!decision.allowed) {
    await emitMediaAuditEvent({
      ...input,
      actionId: 'media.delete',
      result: 'failure',
      reasonCode: decision.reason ?? 'delete_blocked',
      resourceType: 'media_asset',
      resourceId: input.assetId,
    });
    return createApiError(
      409,
      'conflict',
      'Das Medienobjekt kann derzeit nicht gelöscht werden.',
      getRequestId(),
      {
        reason: decision.reason,
        usage: { assetId: input.assetId, totalReferences: references.length },
      }
    );
  }
  const claimed = await input.deps.withMediaService(input.instanceId, (service) =>
    service.claimAssetDeletion(input.instanceId, input.assetId)
  );
  if (!claimed) {
    return createApiError(
      409,
      'conflict',
      'Das Medium wird noch für Inhalte oder die Bildbearbeitung benötigt.',
      getRequestId(),
      {
        reason: 'media_delete_blocked',
      }
    );
  }
  const variants = await input.deps.withMediaService(input.instanceId, (service) =>
    service.listVariantsByAssetId(input.instanceId, input.assetId)
  );
  await storagePort.deleteObject({ instanceId: input.instanceId, storageKey: asset.storageKey });
  for (const variant of variants) {
    await storagePort.deleteObject({
      instanceId: input.instanceId,
      storageKey: variant.storageKey,
    });
  }
  await deleteMediaEditingObjects(storagePort, input.instanceId, asset);
  await input.deps.withMediaService(input.instanceId, (service) =>
    service.finalizeAssetDeletion(input.instanceId, input.assetId)
  );
  await emitMediaAuditEvent({
    ...input,
    actionId: 'media.delete',
    result: 'success',
    resourceType: 'media_asset',
    resourceId: input.assetId,
  });
  return jsonResponse(200, asApiItem({ assetId: input.assetId, deleted: true }, getRequestId()));
};

export const deleteMedia = async (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const instanceId = resolveScopedInstanceId(request, ctx.user.instanceId);
  if (instanceId instanceof Response) {
    return instanceId;
  }
  const assetId = readAssetId(request);
  if (assetId instanceof Response) {
    return assetId;
  }

  const authorization = await deps.authorizeAction({
    ctx,
    instanceId,
    action: 'media.delete',
    resource: { assetId },
  });
  if (!authorization.ok) {
    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.delete',
      result: 'denied',
      reasonCode: authorization.error,
      resourceType: 'media_asset',
      resourceId: assetId,
    });
    return mapAuthorizationFailure(authorization);
  }

  return withMediaStorageGuard(() => deleteAuthorizedAsset({ deps, ctx, instanceId, assetId }), {
    deps,
    ctx,
    instanceId,
    actionId: 'media.delete',
    resourceType: 'media_asset',
    resourceId: assetId,
  });
};
