import { asApiItem, createApiError, parseRequestBody } from '../shared/request-helpers.js';
import { jsonResponse } from '../db.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import {
  contentSaveOperationCommandSchema,
  contentSaveOperationContentSavedSchema,
  contentSaveOperationReferencesSchema,
} from './schemas.js';
import { getMediaRequestId as getRequestId } from './request-context.js';
import {
  emitMediaAuditEvent,
  mapMediaAuthorizationFailure as mapAuthorizationFailure,
  type MediaHttpHandlerDeps,
} from './http-support.js';
import {
  resolveContentSaveOperationContext,
  type ContentSaveOperationContext,
} from './content-save-support.js';

const authorizeOperation = async (
  deps: MediaHttpHandlerDeps,
  ctx: AuthenticatedRequestContext,
  operationContext: ContentSaveOperationContext,
  targetId = operationContext.operation.targetId
): Promise<Response | null> => {
  const authorization = await deps.authorizeAction({
    ctx,
    instanceId: operationContext.instanceId,
    action: 'media.reference.manage',
    resource: { targetType: operationContext.operation.targetType, targetId },
  });
  return authorization.ok ? null : mapAuthorizationFailure(authorization);
};

export const replaceContentSaveOperationReferences = async (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const parsed = await parseRequestBody(request, contentSaveOperationReferencesSchema);
  if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, getRequestId());
  const operationContext = await resolveContentSaveOperationContext({
    deps,
    request,
    ctx,
    bodyInstanceId: parsed.data.instanceId,
  });
  if (operationContext instanceof Response) return operationContext;
  const denied = await authorizeOperation(deps, ctx, operationContext);
  if (denied) return denied;
  const references = parsed.data.references.map((reference) => ({
    ...reference,
    id: reference.id ?? deps.createId(),
  }));
  const successful = await deps.withMediaService(operationContext.instanceId, (service) =>
    service.replaceContentSaveOperationReferences({
      instanceId: operationContext.instanceId,
      operationId: operationContext.operationId,
      actorSubject: ctx.user.id,
      references,
    })
  );
  return successful
    ? jsonResponse(
        200,
        asApiItem({ operationId: operationContext.operationId, references }, getRequestId())
      )
    : createApiError(
        409,
        'conflict',
        'Die Referenzen konnten der Speicheroperation nicht zugeordnet werden.',
        getRequestId(),
        { reason: 'content_save_operation_reference_rejected' }
      );
};

export const markContentSaveOperationContentSaved = async (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const parsed = await parseRequestBody(request, contentSaveOperationContentSavedSchema);
  if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, getRequestId());
  const operationContext = await resolveContentSaveOperationContext({
    deps,
    request,
    ctx,
    bodyInstanceId: parsed.data.instanceId,
  });
  if (operationContext instanceof Response) return operationContext;
  const denied = await authorizeOperation(deps, ctx, operationContext, parsed.data.targetId);
  if (denied) return denied;
  const successful = await deps.withMediaService(operationContext.instanceId, (service) =>
    service.markContentSaveOperationContentSaved({
      instanceId: operationContext.instanceId,
      operationId: operationContext.operationId,
      actorSubject: ctx.user.id,
      targetId: parsed.data.targetId,
    })
  );
  return successful
    ? jsonResponse(
        200,
        asApiItem(
          { operationId: operationContext.operationId, targetId: parsed.data.targetId },
          getRequestId()
        )
      )
    : createApiError(
        409,
        'conflict',
        'Content-Speicheroperation hat einen ungültigen Zustand.',
        getRequestId()
      );
};

type OperationCommand = 'saving' | 'unknown' | 'commit';

const executeOperationCommand = async (input: {
  deps: MediaHttpHandlerDeps;
  ctx: AuthenticatedRequestContext;
  operationContext: ContentSaveOperationContext;
  command: OperationCommand;
  errorCode?: string;
}): Promise<boolean> => {
  const common = {
    instanceId: input.operationContext.instanceId,
    operationId: input.operationContext.operationId,
    actorSubject: input.ctx.user.id,
  };
  return input.deps.withMediaService(input.operationContext.instanceId, (service) => {
    if (input.command === 'saving') return service.markContentSaveOperationSavingContent(common);
    if (input.command === 'commit') return service.commitContentSaveOperation(common);
    return service.markContentSaveOperationOutcomeUnknown({
      ...common,
      errorCode: input.errorCode ?? 'content_save_outcome_unknown',
    });
  });
};

const commandResponse = (operationId: string, command: OperationCommand, successful: boolean) => {
  const config = {
    saving: ['saving_content', 'Content-Speicheroperation kann nicht gestartet werden.'],
    unknown: [
      'outcome_unknown',
      'Content-Speicheroperation kann nicht als unklar markiert werden.',
    ],
    commit: ['committed', 'Content-Speicheroperation kann nicht aktiviert werden.'],
  } as const;
  const [status, message] = config[command];
  return successful
    ? jsonResponse(200, asApiItem({ operationId, status }, getRequestId()))
    : createApiError(409, 'conflict', message, getRequestId());
};

const handleOperationCommand = async (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext,
  command: OperationCommand
): Promise<Response> => {
  const parsed = await parseRequestBody(request, contentSaveOperationCommandSchema);
  if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, getRequestId());
  const operationContext = await resolveContentSaveOperationContext({
    deps,
    request,
    ctx,
    bodyInstanceId: parsed.data.instanceId,
  });
  if (operationContext instanceof Response) return operationContext;
  const denied = await authorizeOperation(deps, ctx, operationContext);
  if (denied) return denied;
  const successful = await executeOperationCommand({
    deps,
    ctx,
    operationContext,
    command,
    errorCode: parsed.data.errorCode,
  });
  if (successful && command !== 'saving') {
    await emitMediaAuditEvent({
      deps,
      ctx,
      instanceId: operationContext.instanceId,
      actionId:
        command === 'commit'
          ? 'media.contentDraftCommitted'
          : 'media.contentDraftReconciliationRequired',
      result: command === 'commit' ? 'success' : 'failure',
      reasonCode:
        command === 'unknown'
          ? (parsed.data.errorCode ?? 'content_save_outcome_unknown')
          : undefined,
      resourceType: 'media_content_save_operation',
      resourceId: operationContext.operationId,
    });
  }
  return commandResponse(operationContext.operationId, command, successful);
};

export const markContentSaveOperationSavingContent = (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
) => handleOperationCommand(deps, request, ctx, 'saving');

export const markContentSaveOperationOutcomeUnknown = (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
) => handleOperationCommand(deps, request, ctx, 'unknown');

export const commitContentSaveOperation = (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
) => handleOperationCommand(deps, request, ctx, 'commit');
