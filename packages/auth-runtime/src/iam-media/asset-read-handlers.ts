import { asApiItem, createApiError } from '../shared/request-helpers.js';
import { jsonResponse } from '../db.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import {
  getMediaRequestId as getRequestId,
  readMediaAssetId as readAssetId,
  resolveScopedMediaInstanceId as resolveScopedInstanceId,
} from './request-context.js';
import { canAccessMediaAsset } from './asset-support.js';
import {
  emitMediaAuditEvent,
  mapMediaAuthorizationFailure as mapAuthorizationFailure,
  resolveMediaStoragePort,
  withMediaStorageGuard,
  type MediaHttpHandlerDeps,
} from './http-support.js';
import { isMediaVisibility } from './asset-record-support.js';

export const getMedia = async (
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
    action: 'media.read',
    resource: { assetId },
  });
  if (!authorization.ok) {
    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.read',
      result: 'denied',
      reasonCode: authorization.error,
      resourceType: 'media_asset',
      resourceId: assetId,
    });
    return mapAuthorizationFailure(authorization);
  }

  const asset = await deps.withMediaService(instanceId, (service) =>
    service.getAssetById(instanceId, assetId)
  );
  if (!asset || !canAccessMediaAsset(asset, ctx.user.id)) {
    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.read',
      result: 'failure',
      reasonCode: 'asset_not_found',
      resourceType: 'media_asset',
      resourceId: assetId,
    });
    return createApiError(404, 'not_found', 'Medienobjekt nicht gefunden.', getRequestId());
  }

  await emitMediaAuditEvent({
    deps,
    ctx,
    instanceId,
    actionId: 'media.read',
    result: 'success',
    resourceType: 'media_asset',
    resourceId: assetId,
  });

  return jsonResponse(200, asApiItem(asset, getRequestId()));
};

export const getMediaUsage = async (
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
    action: 'media.read',
    resource: { assetId },
  });
  if (!authorization.ok) {
    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.readUsage',
      result: 'denied',
      reasonCode: authorization.error,
      resourceType: 'media_asset',
      resourceId: assetId,
    });
    return mapAuthorizationFailure(authorization);
  }

  const usage = await deps.withMediaService(instanceId, (service) =>
    service.getUsageImpact(instanceId, assetId)
  );
  await emitMediaAuditEvent({
    deps,
    ctx,
    instanceId,
    actionId: 'media.readUsage',
    result: 'success',
    reasonCode: usage.totalReferences > 0 ? 'active_references' : undefined,
    resourceType: 'media_asset',
    resourceId: assetId,
  });
  return jsonResponse(200, asApiItem(usage, getRequestId()));
};

const rejectMediaDelivery = async (input: {
  deps: MediaHttpHandlerDeps;
  ctx: AuthenticatedRequestContext;
  instanceId: string;
  assetId: string;
  reasonCode: 'asset_not_found' | 'invalid_visibility';
}): Promise<Response> => {
  await emitMediaAuditEvent({
    ...input,
    actionId: 'media.deliveryResolve',
    result: 'failure',
    resourceType: 'media_asset',
    resourceId: input.assetId,
  });
  return input.reasonCode === 'asset_not_found'
    ? createApiError(404, 'not_found', 'Medienobjekt nicht gefunden.', getRequestId())
    : createApiError(
        500,
        'internal_error',
        'Medienobjekt kann derzeit nicht ausgeliefert werden.',
        getRequestId()
      );
};

export const getMediaDelivery = async (
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

  return withMediaStorageGuard(
    async () => {
      const storagePort = await resolveMediaStoragePort(deps, instanceId);
      const asset = await deps.withMediaService(instanceId, (service) =>
        service.getAssetById(instanceId, assetId)
      );
      if (!asset || !canAccessMediaAsset(asset, ctx.user.id)) {
        return rejectMediaDelivery({
          deps,
          ctx,
          instanceId,
          assetId,
          reasonCode: 'asset_not_found',
        });
      }
      if (!isMediaVisibility(asset.visibility)) {
        return rejectMediaDelivery({
          deps,
          ctx,
          instanceId,
          assetId,
          reasonCode: 'invalid_visibility',
        });
      }
      const visibility = asset.visibility;
      const authorization = await deps.authorizeAction({
        ctx,
        instanceId,
        action: visibility === 'protected' ? 'media.deliver.protected' : 'media.read',
        resource: {
          assetId,
          visibility,
        },
      });
      if (!authorization.ok) {
        await emitMediaAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'media.deliveryResolve',
          result: 'denied',
          reasonCode: authorization.error,
          resourceType: 'media_asset',
          resourceId: assetId,
        });
        return mapAuthorizationFailure(authorization);
      }

      const delivery = await storagePort.resolveDelivery({
        instanceId,
        assetId,
        storageKey: asset.storageKey,
        visibility,
      });

      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.deliveryResolve',
        result: 'success',
        reasonCode: visibility === 'protected' ? 'protected_delivery' : 'public_delivery',
        resourceType: 'media_asset',
        resourceId: assetId,
      });

      return jsonResponse(200, asApiItem(delivery, getRequestId()));
    },
    {
      deps,
      ctx,
      instanceId,
      actionId: 'media.deliveryResolve',
      resourceType: 'media_asset',
      resourceId: assetId,
    }
  );
};
