import { asApiItem, createApiError, parseRequestBody } from '../shared/request-helpers.js';
import { jsonResponse } from '../db.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { contentSaveOperationCommandSchema } from './schemas.js';
import {
  getMediaRequestId as getRequestId,
  readMediaContentSaveOperationId as readContentSaveOperationId,
  resolveBodyScopedMediaInstanceId as resolveBodyScopedInstanceId,
} from './request-context.js';
import {
  emitMediaAuditEvent,
  mapMediaAuthorizationFailure as mapAuthorizationFailure,
  resolveMediaStoragePort,
  withMediaStorageGuard,
  type MediaHttpHandlerDeps,
} from './http-support.js';

const cleanupContentSaveAssets = async (input: {
  deps: MediaHttpHandlerDeps;
  ctx: AuthenticatedRequestContext;
  instanceId: string;
  operationId: string;
}): Promise<Response> => {
  const storagePort = await resolveMediaStoragePort(input.deps, input.instanceId);
  const assets = await input.deps.withMediaService(input.instanceId, (service) =>
    service.listAssetsByOperation({
      instanceId: input.instanceId,
      operationId: input.operationId,
      actorSubject: input.ctx.user.id,
    })
  );
  for (const asset of assets) {
    const variants = await input.deps.withMediaService(input.instanceId, (service) =>
      service.listVariantsByAssetId(input.instanceId, asset.id)
    );
    await storagePort.deleteObject({ instanceId: input.instanceId, storageKey: asset.storageKey });
    for (const variant of variants) {
      await storagePort.deleteObject({
        instanceId: input.instanceId,
        storageKey: variant.storageKey,
      });
    }
  }
  const finalized = await input.deps.withMediaService(input.instanceId, (service) =>
    service.finalizeContentSaveOperationCleanup({
      instanceId: input.instanceId,
      operationId: input.operationId,
      actorSubject: input.ctx.user.id,
    })
  );
  if (!finalized) throw new Error('media_content_save_cleanup_not_finalized');
  await emitMediaAuditEvent({
    deps: input.deps,
    ctx: input.ctx,
    instanceId: input.instanceId,
    actionId: 'media.contentDraftAbandoned',
    result: 'success',
    resourceType: 'media_content_save_operation',
    resourceId: input.operationId,
  });
  return jsonResponse(
    200,
    asApiItem({ operationId: input.operationId, status: 'abandoned' }, getRequestId())
  );
};

export const abandonContentSaveOperation = async (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const parsed = await parseRequestBody(request, contentSaveOperationCommandSchema);
  if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, getRequestId());
  const operationId = readContentSaveOperationId(request);
  if (operationId instanceof Response) return operationId;
  const scope = resolveBodyScopedInstanceId(parsed.data.instanceId, ctx.user.instanceId);
  if (!scope.ok) return scope.response;
  const { instanceId } = scope;
  const authorization = await deps.authorizeAction({ ctx, instanceId, action: 'media.create' });
  if (!authorization.ok) return mapAuthorizationFailure(authorization);
  const marked = await deps.withMediaService(instanceId, (service) =>
    service.markContentSaveOperationAbandonPending({
      instanceId,
      operationId,
      actorSubject: ctx.user.id,
      errorCode: parsed.data.errorCode,
    })
  );
  if (!marked) {
    return createApiError(
      409,
      'conflict',
      'Content-Speicheroperation kann nicht verworfen werden.',
      getRequestId()
    );
  }
  return withMediaStorageGuard(
    () => cleanupContentSaveAssets({ deps, ctx, instanceId, operationId }),
    {
      deps,
      ctx,
      instanceId,
      actionId: 'media.contentDraftCleanupFailed',
      resourceType: 'media_content_save_operation',
      resourceId: operationId,
    }
  );
};
