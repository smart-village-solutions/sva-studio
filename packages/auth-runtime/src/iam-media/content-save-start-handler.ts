import { asApiItem, createApiError, parseRequestBody } from '../shared/request-helpers.js';
import { jsonResponse } from '../db.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { contentSaveOperationCreateSchema } from './schemas.js';
import {
  getMediaRequestId as getRequestId,
  resolveBodyScopedMediaInstanceId as resolveBodyScopedInstanceId,
} from './request-context.js';
import {
  emitMediaAuditEvent,
  mapMediaAuthorizationFailure as mapAuthorizationFailure,
  type MediaHttpHandlerDeps,
} from './http-support.js';

const recoverFromSchedulingFailure = async (
  deps: MediaHttpHandlerDeps,
  instanceId: string,
  operationId: string,
  actorSubject: string
): Promise<Response> => {
  await deps.withMediaService(instanceId, async (service) => {
    await service.markContentSaveOperationAbandonPending({
      instanceId,
      operationId,
      actorSubject,
      errorCode: 'recovery_schedule_failed',
    });
    await service.finalizeContentSaveOperationCleanup({ instanceId, operationId, actorSubject });
  });
  return createApiError(
    503,
    'internal_error',
    'Die Medien-Speicheroperation konnte nicht sicher vorbereitet werden.',
    getRequestId(),
    { reason: 'content_save_recovery_unavailable' }
  );
};

export const createContentSaveOperation = async (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const parsed = await parseRequestBody(request, contentSaveOperationCreateSchema);
  if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, getRequestId());
  const scope = resolveBodyScopedInstanceId(parsed.data.instanceId, ctx.user.instanceId);
  if (!scope.ok) return scope.response;
  const { instanceId } = scope;
  const createAuthorization = await deps.authorizeAction({
    ctx,
    instanceId,
    action: 'media.create',
  });
  if (!createAuthorization.ok) return mapAuthorizationFailure(createAuthorization);
  const referenceAuthorization = await deps.authorizeAction({
    ctx,
    instanceId,
    action: 'media.reference.manage',
    resource: { targetType: parsed.data.targetType },
  });
  if (!referenceAuthorization.ok) return mapAuthorizationFailure(referenceAuthorization);

  const operation = await deps.withMediaService(instanceId, (service) =>
    service.createContentSaveOperation({
      id: parsed.data.operationId,
      instanceId,
      actorSubject: ctx.user.id,
      targetType: parsed.data.targetType,
      status: 'preparing',
      expiresAt: new Date(Date.parse(deps.now()) + 24 * 60 * 60 * 1000).toISOString(),
    })
  );
  if (deps.scheduleContentSaveRecovery) {
    try {
      await deps.scheduleContentSaveRecovery({
        instanceId,
        operationId: operation.id,
        actorSubject: ctx.user.id,
        expiresAt: operation.expiresAt,
        requestId: getRequestId(),
      });
    } catch {
      return recoverFromSchedulingFailure(deps, instanceId, operation.id, ctx.user.id);
    }
  }
  await emitMediaAuditEvent({
    deps,
    ctx,
    instanceId,
    actionId: 'media.contentDraftStarted',
    result: 'success',
    resourceType: 'media_content_save_operation',
    resourceId: operation.id,
  });
  return jsonResponse(201, asApiItem(operation, getRequestId()));
};
