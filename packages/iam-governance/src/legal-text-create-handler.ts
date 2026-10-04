import { createLegalTextSchema } from './legal-text-schemas.js';
import type { CreateLegalTextInput } from './legal-text-repository-shared.js';
import type {
  LegalTextMutationActor,
  LegalTextMutationHandlerDeps,
} from './legal-text-mutation-handlers.js';

const CREATE_LEGAL_TEXT_ENDPOINT = 'POST:/api/v1/iam/legal-texts';

const withRequestId = (requestId: string | undefined, body: Record<string, unknown>) => ({
  ...body,
  ...(requestId ? { requestId } : {}),
});

export const requireActorAccountId = (
  deps: LegalTextMutationHandlerDeps,
  actor: LegalTextMutationActor
): string | Response =>
  actor.actorAccountId ??
  deps.createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actor.requestId);

const completeCreateIdempotency = async (
  deps: LegalTextMutationHandlerDeps,
  actor: LegalTextMutationActor,
  actorAccountId: string,
  idempotencyKey: string,
  responseStatus: number,
  responseBody: Record<string, unknown>
) =>
  deps.completeIdempotency({
    instanceId: actor.instanceId,
    actorAccountId,
    endpoint: CREATE_LEGAL_TEXT_ENDPOINT,
    idempotencyKey,
    status: responseStatus >= 400 ? 'FAILED' : 'COMPLETED',
    responseStatus,
    responseBody,
  });

const createFailureResponse = async (
  deps: LegalTextMutationHandlerDeps,
  actor: LegalTextMutationActor,
  actorAccountId: string,
  idempotencyKey: string,
  status: number,
  code: string,
  message: string
) => {
  const responseBody = withRequestId(actor.requestId, { error: { code, message } });
  await completeCreateIdempotency(
    deps,
    actor,
    actorAccountId,
    idempotencyKey,
    status,
    responseBody
  );
  return deps.jsonResponse(status, responseBody);
};

const persistCreatedLegalTextResponse = async (
  deps: LegalTextMutationHandlerDeps,
  actor: LegalTextMutationActor,
  actorAccountId: string,
  idempotencyKey: string,
  data: Omit<CreateLegalTextInput, 'instanceId' | 'actorAccountId' | 'requestId' | 'traceId'>
): Promise<Response> => {
  const createdId = await deps.repository.createLegalTextVersion({
    instanceId: actor.instanceId,
    actorAccountId,
    requestId: actor.requestId,
    traceId: actor.traceId,
    ...data,
  });
  if (!createdId) {
    return createFailureResponse(
      deps,
      actor,
      actorAccountId,
      idempotencyKey,
      409,
      'conflict',
      'Diese Rechtstext-Version existiert bereits.'
    );
  }

  const item = await deps.repository.loadLegalTextById(actor.instanceId, createdId);
  if (!item) {
    throw new Error('created_legal_text_not_found');
  }

  const responseBody = deps.asApiItem(item, actor.requestId);
  await completeCreateIdempotency(deps, actor, actorAccountId, idempotencyKey, 201, responseBody);
  return deps.jsonResponse(201, responseBody);
};

export const createLegalTextResponse = async (
  deps: LegalTextMutationHandlerDeps,
  request: Request,
  actor: LegalTextMutationActor
): Promise<Response> => {
  const csrfError = deps.validateCsrf(request, actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const idempotencyKey = deps.requireIdempotencyKey(request, actor.requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }
  const actorAccountId = requireActorAccountId(deps, actor);
  if (actorAccountId instanceof Response) {
    return actorAccountId;
  }

  const parsed = await deps.parseRequestBody<
    Omit<CreateLegalTextInput, 'instanceId' | 'actorAccountId' | 'requestId' | 'traceId'>
  >(request, createLegalTextSchema);
  if (!parsed.ok) {
    return deps.createApiError(400, 'invalid_request', parsed.message, actor.requestId);
  }

  const reserve = await deps.reserveIdempotency({
    instanceId: actor.instanceId,
    actorAccountId,
    endpoint: CREATE_LEGAL_TEXT_ENDPOINT,
    idempotencyKey: idempotencyKey.key,
    payloadHash: deps.toPayloadHash(parsed.rawBody),
  });
  if (reserve.status === 'replay') {
    return deps.jsonResponse(reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return deps.createApiError(409, 'idempotency_key_reuse', reserve.message, actor.requestId);
  }

  try {
    return await persistCreatedLegalTextResponse(
      deps,
      actor,
      actorAccountId,
      idempotencyKey.key,
      parsed.data
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'legal_text_published_at_required') {
      return createFailureResponse(
        deps,
        actor,
        actorAccountId,
        idempotencyKey.key,
        400,
        'invalid_request',
        'Veröffentlichungsdatum ist für gültige Rechtstexte erforderlich.'
      );
    }
    deps.logError('Legal text create failed', {
      operation: 'legal_text_create',
      instance_id: actor.instanceId,
      request_id: actor.requestId,
      trace_id: actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createFailureResponse(
      deps,
      actor,
      actorAccountId,
      idempotencyKey.key,
      503,
      'database_unavailable',
      'Rechtstext konnte nicht gespeichert werden.'
    );
  }
};
