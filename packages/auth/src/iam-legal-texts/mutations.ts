import { createSdkLogger } from '@sva/sdk/server';

import {
  asApiItem,
  createApiError,
  parseRequestBody,
  readPathSegment,
  requireIdempotencyKey,
  toPayloadHash,
} from '../iam-account-management/api-helpers.js';
import { validateCsrf } from '../iam-account-management/csrf.js';
import { completeIdempotency, reserveIdempotency } from '../iam-account-management/shared.js';
import { UUID_LIKE_PATTERN } from '../shared/validators.js';

import type { ResolvedLegalTextsActor } from './request-context.js';
import { createLegalTextVersion, LegalTextDeleteConflictError, loadLegalTextById, updateLegalTextVersion } from './repository.js';
import { createLegalTextSchema, updateLegalTextSchema } from './schemas.js';

const logger = createSdkLogger({ component: 'iam-legal-texts', level: 'info' });

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const withRequestId = (requestId: string | undefined, body: Record<string, unknown>) => ({
  ...body,
  ...(requestId ? { requestId } : {}),
});

const completeCreateIdempotency = async (
  actor: ResolvedLegalTextsActor['actor'],
  idempotencyKey: string,
  responseStatus: number,
  responseBody: Record<string, unknown>
) =>
  completeIdempotency({
    instanceId: actor.instanceId,
    actorAccountId: actor.actorAccountId!,
    endpoint: 'POST:/api/v1/iam/legal-texts',
    idempotencyKey,
    status: responseStatus >= 400 ? 'FAILED' : 'COMPLETED',
    responseStatus,
    responseBody,
  });

const createFailureResponse = async (
  actor: ResolvedLegalTextsActor['actor'],
  idempotencyKey: string,
  status: number,
  code: string,
  message: string
) => {
  const responseBody = withRequestId(actor.requestId, { error: { code, message } });
  await completeCreateIdempotency(actor, idempotencyKey, status, responseBody);
  return jsonResponse(status, responseBody);
};

export const createLegalTextResponse = async (
  request: Request,
  actor: ResolvedLegalTextsActor['actor']
): Promise<Response> => {
  const csrfError = validateCsrf(request, actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const idempotencyKey = requireIdempotencyKey(request, actor.requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }

  const parsed = await parseRequestBody(request, createLegalTextSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, actor.requestId);
  }

  const reserve = await reserveIdempotency({
    instanceId: actor.instanceId,
    actorAccountId: actor.actorAccountId!,
    endpoint: 'POST:/api/v1/iam/legal-texts',
    idempotencyKey: idempotencyKey.key,
    payloadHash: toPayloadHash(parsed.rawBody),
  });
  if (reserve.status === 'replay') {
    return jsonResponse(reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return createApiError(409, 'idempotency_key_reuse', reserve.message, actor.requestId);
  }

  try {
    const createdId = await createLegalTextVersion({
      instanceId: actor.instanceId,
      actorAccountId: actor.actorAccountId!,
      requestId: actor.requestId,
      traceId: actor.traceId,
      ...parsed.data,
    });
    if (!createdId) {
      return createFailureResponse(actor, idempotencyKey.key, 409, 'conflict', 'Diese Rechtstext-Version existiert bereits.');
    }

    const item = await loadLegalTextById(actor.instanceId, createdId);
    if (!item) {
      throw new Error('created_legal_text_not_found');
    }

    const responseBody = asApiItem(item, actor.requestId);
    await completeCreateIdempotency(actor, idempotencyKey.key, 201, responseBody);
    return jsonResponse(201, responseBody);
  } catch (error) {
    if (error instanceof Error && error.message === 'legal_text_published_at_required') {
      return createFailureResponse(
        actor,
        idempotencyKey.key,
        400,
        'invalid_request',
        'Veröffentlichungsdatum ist für gültige Rechtstexte erforderlich.'
      );
    }
    logger.error('Legal text create failed', {
      operation: 'legal_text_create',
      instance_id: actor.instanceId,
      request_id: actor.requestId,
      trace_id: actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createFailureResponse(
      actor,
      idempotencyKey.key,
      503,
      'database_unavailable',
      'Rechtstext konnte nicht gespeichert werden.'
    );
  }
};

export const updateLegalTextResponse = async (
  request: Request,
  actor: ResolvedLegalTextsActor['actor']
): Promise<Response> => {
  const csrfError = validateCsrf(request, actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const legalTextVersionId = readPathSegment(request, 4);
  if (!legalTextVersionId) {
    return createApiError(400, 'invalid_request', 'Rechtstext-ID fehlt.', actor.requestId);
  }

  const parsed = await parseRequestBody(request, updateLegalTextSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, actor.requestId);
  }

  try {
    const updatedId = await updateLegalTextVersion({
      instanceId: actor.instanceId,
      actorAccountId: actor.actorAccountId!,
      requestId: actor.requestId,
      traceId: actor.traceId,
      legalTextVersionId,
      ...parsed.data,
    });
    if (!updatedId) {
      return createApiError(404, 'not_found', 'Rechtstext-Version wurde nicht gefunden.', actor.requestId);
    }

    const item = await loadLegalTextById(actor.instanceId, updatedId);
    return item
      ? jsonResponse(200, asApiItem(item, actor.requestId))
      : createApiError(404, 'not_found', 'Rechtstext-Version wurde nicht gefunden.', actor.requestId);
  } catch (error) {
    if (error instanceof Error && error.message === 'legal_text_published_at_required') {
      return createApiError(
        400,
        'invalid_request',
        'Veröffentlichungsdatum ist für gültige Rechtstexte erforderlich.',
        actor.requestId
      );
    }
    logger.error('Legal text update failed', {
      operation: 'legal_text_update',
      instance_id: actor.instanceId,
      request_id: actor.requestId,
      trace_id: actor.traceId,
      legal_text_version_id: legalTextVersionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(503, 'database_unavailable', 'Rechtstext konnte nicht aktualisiert werden.', actor.requestId);
  }
};

export const deleteLegalTextResponse = async (
  request: Request,
  actor: ResolvedLegalTextsActor['actor']
): Promise<Response> => {
  const csrfError = validateCsrf(request, actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const legalTextVersionId = readPathSegment(request, 4);
  if (!legalTextVersionId) {
    return createApiError(400, 'invalid_request', 'Rechtstext-ID fehlt.', actor.requestId);
  }
  if (!UUID_LIKE_PATTERN.test(legalTextVersionId)) {
    return createApiError(400, 'invalid_request', 'Rechtstext-ID ist ungültig.', actor.requestId);
  }

  try {
    const { deleteLegalTextVersion } = await import('./repository.js');
    const deletedId = await deleteLegalTextVersion({
      instanceId: actor.instanceId,
      actorAccountId: actor.actorAccountId!,
      requestId: actor.requestId,
      traceId: actor.traceId,
      legalTextVersionId,
    });

    return deletedId
      ? jsonResponse(200, asApiItem({ id: deletedId }, actor.requestId))
      : createApiError(404, 'not_found', 'Rechtstext-Version wurde nicht gefunden.', actor.requestId);
  } catch (error) {
    if (error instanceof LegalTextDeleteConflictError) {
      return createApiError(
        409,
        'conflict',
        'Rechtstext-Version kann nicht gelöscht werden, weil bereits Zustimmungen vorliegen.',
        actor.requestId
      );
    }
    logger.error('Legal text delete failed', {
      operation: 'legal_text_delete',
      instance_id: actor.instanceId,
      request_id: actor.requestId,
      trace_id: actor.traceId,
      legal_text_version_id: legalTextVersionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(503, 'database_unavailable', 'Rechtstext konnte nicht gelöscht werden.', actor.requestId);
  }
};
