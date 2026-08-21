import { asApiItem, createApiError, parseRequestBody } from '../shared/request-helpers.js';
import { jsonResponse } from '../db.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { replaceReferencesSchema } from './schemas.js';
import {
  getMediaRequestId as getRequestId,
  resolveBodyScopedMediaInstanceId as resolveBodyScopedInstanceId,
  resolveScopedMediaInstanceId as resolveScopedInstanceId,
} from './request-context.js';
import {
  emitMediaAuditEvent,
  mapMediaAuthorizationFailure as mapAuthorizationFailure,
  type MediaHttpHandlerDeps,
} from './http-support.js';

const findMissingAssetIds = (
  deps: MediaHttpHandlerDeps,
  instanceId: string,
  assetIds: readonly string[]
): Promise<string[]> =>
  deps.withMediaService(instanceId, async (service) => {
    const missing: string[] = [];
    for (const assetId of assetIds) {
      const asset = await service.getAssetById(instanceId, assetId);
      if (!asset || asset.lifecycleStatus === 'provisional') missing.push(assetId);
    }
    return missing;
  });

const replaceReferences = async (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const parsed = await parseRequestBody(request, replaceReferencesSchema);
  if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, getRequestId());
  const scope = resolveBodyScopedInstanceId(parsed.data.instanceId, ctx.user.instanceId);
  if (!scope.ok) return scope.response;
  const { instanceId } = scope;
  const authorization = await deps.authorizeAction({
    ctx,
    instanceId,
    action: 'media.reference.manage',
    resource: { targetType: parsed.data.targetType, targetId: parsed.data.targetId },
  });
  if (!authorization.ok) {
    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.reference.manage',
      result: 'denied',
      reasonCode: authorization.error,
      resourceType: parsed.data.targetType,
      resourceId: parsed.data.targetId,
    });
    return mapAuthorizationFailure(authorization);
  }
  const missingAssetIds = await findMissingAssetIds(
    deps,
    instanceId,
    parsed.data.references.map(({ assetId }) => assetId)
  );
  if (missingAssetIds.length > 0) {
    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.reference.manage',
      result: 'failure',
      reasonCode: 'asset_not_found',
      resourceType: parsed.data.targetType,
      resourceId: parsed.data.targetId,
    });
    return createApiError(
      404,
      'not_found',
      'Mindestens ein referenziertes Medienobjekt wurde nicht gefunden.',
      getRequestId(),
      { missingAssetIds }
    );
  }
  const references = parsed.data.references.map((reference) => ({
    id: reference.id ?? deps.createId(),
    assetId: reference.assetId,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    role: reference.role,
    sortOrder: reference.sortOrder,
  }));
  await deps.withMediaService(instanceId, (service) =>
    service.replaceReferences({
      instanceId,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      references,
    })
  );
  await emitMediaAuditEvent({
    deps,
    ctx,
    instanceId,
    actionId: 'media.reference.manage',
    result: 'success',
    reasonCode: references.length > 0 ? 'references_replaced' : 'references_cleared',
    resourceType: parsed.data.targetType,
    resourceId: parsed.data.targetId,
  });
  return jsonResponse(
    200,
    asApiItem(
      {
        instanceId,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        references,
      },
      getRequestId()
    )
  );
};

const listReferences = async (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const instanceId = resolveScopedInstanceId(request, ctx.user.instanceId);
  if (instanceId instanceof Response) return instanceId;
  const url = new URL(request.url);
  const targetType = url.searchParams.get('targetType')?.trim();
  const targetId = url.searchParams.get('targetId')?.trim();
  if (!targetType || !targetId) {
    return createApiError(
      400,
      'invalid_request',
      'Zieltyp und Ziel-ID sind erforderlich.',
      getRequestId()
    );
  }
  const authorization = await deps.authorizeAction({
    ctx,
    instanceId,
    action: 'media.reference.manage',
    resource: { targetType, targetId },
  });
  if (!authorization.ok) {
    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'media.referenceList',
      result: 'denied',
      reasonCode: authorization.error,
      resourceType: targetType,
      resourceId: targetId,
    });
    return mapAuthorizationFailure(authorization);
  }
  const references = await deps.withMediaService(instanceId, (service) =>
    service.listReferencesByTarget(instanceId, targetType, targetId)
  );
  await emitMediaAuditEvent({
    deps,
    ctx,
    instanceId,
    actionId: 'media.referenceList',
    result: 'success',
    reasonCode: references.length > 0 ? 'active_references' : undefined,
    resourceType: targetType,
    resourceId: targetId,
  });
  return jsonResponse(200, asApiItem(references, getRequestId()));
};

export const createMediaReferenceHandlers = (deps: MediaHttpHandlerDeps) => ({
  replaceReferences: (request: Request, ctx: AuthenticatedRequestContext) =>
    replaceReferences(deps, request, ctx),
  listReferences: (request: Request, ctx: AuthenticatedRequestContext) =>
    listReferences(deps, request, ctx),
});
