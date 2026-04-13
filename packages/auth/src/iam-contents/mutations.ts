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

import type { ResolvedContentActor } from './request-context.js';
import { validateContentTypePayload } from './content-type-registry.js';
import { resolveContentAccess } from './request-context.js';
import { createContent, deleteContent, loadContentById, loadContentDetail, updateContent } from './repository.js';
import { createContentSchema, updateContentSchema } from './schemas.js';

const logger = createSdkLogger({ component: 'iam-contents', level: 'info' });

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const completeCreateIdempotency = async (
  actor: ResolvedContentActor['actor'],
  idempotencyKey: string,
  responseStatus: number,
  responseBody: Record<string, unknown>
) =>
  completeIdempotency({
    instanceId: actor.instanceId,
    actorAccountId: actor.actorAccountId!,
    endpoint: 'POST:/api/v1/iam/contents',
    idempotencyKey,
    status: responseStatus >= 400 ? 'FAILED' : 'COMPLETED',
    responseStatus,
    responseBody,
  });

const createFailureResponse = async (
  actor: ResolvedContentActor['actor'],
  idempotencyKey: string,
  status: number,
  code: string,
  message: string
) => {
  const responseBody = {
    error: { code, message },
    ...(actor.requestId ? { requestId: actor.requestId } : {}),
  };
  await completeCreateIdempotency(actor, idempotencyKey, status, responseBody);
  return jsonResponse(status, responseBody);
};

export const createContentResponse = async (
  request: Request,
  actor: ResolvedContentActor['actor']
): Promise<Response> => {
  const csrfError = validateCsrf(request, actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const idempotencyKey = requireIdempotencyKey(request, actor.requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }

  const parsed = await parseRequestBody(request, createContentSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, actor.requestId);
  }

  const payloadValidation = validateContentTypePayload(parsed.data.contentType, parsed.data.payload);
  if (!payloadValidation.ok) {
    return createApiError(400, 'invalid_request', payloadValidation.message, actor.requestId);
  }

  const reserve = await reserveIdempotency({
    instanceId: actor.instanceId,
    actorAccountId: actor.actorAccountId!,
    endpoint: 'POST:/api/v1/iam/contents',
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
    const createdId = await createContent({
      instanceId: actor.instanceId,
      actorAccountId: actor.actorAccountId!,
      actorDisplayName: actor.actorDisplayName,
      requestId: actor.requestId,
      traceId: actor.traceId,
      ...parsed.data,
      payload: payloadValidation.payload,
    });
    const item = await loadContentDetail(actor.instanceId, createdId);
    if (!item) {
      throw new Error('created_content_not_found');
    }

    const access = await resolveContentAccess(actor);
    const responseBody = asApiItem({ ...item, access }, actor.requestId);
    await completeCreateIdempotency(actor, idempotencyKey.key, 201, responseBody);
    return jsonResponse(201, responseBody);
  } catch (error) {
    if (error instanceof Error && error.message === 'content_published_at_required') {
      return createFailureResponse(
        actor,
        idempotencyKey.key,
        400,
        'invalid_request',
        'Veröffentlichungsdatum ist für veröffentlichte Inhalte erforderlich.'
      );
    }
    logger.error('Content create failed', {
      operation: 'content_create',
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
      'Inhalt konnte nicht gespeichert werden.'
    );
  }
};

export const updateContentResponse = async (
  request: Request,
  actor: ResolvedContentActor['actor']
): Promise<Response> => {
  const csrfError = validateCsrf(request, actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const contentId = readPathSegment(request, 4);
  if (!contentId) {
    return createApiError(400, 'invalid_request', 'Inhalts-ID fehlt.', actor.requestId);
  }

  const parsed = await parseRequestBody(request, updateContentSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, actor.requestId);
  }

  const currentContent = await loadContentById(actor.instanceId, contentId);
  if (!currentContent) {
    return createApiError(404, 'not_found', 'Inhalt wurde nicht gefunden.', actor.requestId);
  }

  const payloadValidation =
    parsed.data.payload === undefined
      ? { ok: true as const, payload: undefined }
      : validateContentTypePayload(currentContent.contentType, parsed.data.payload);

  if (!payloadValidation.ok) {
    return createApiError(400, 'invalid_request', payloadValidation.message, actor.requestId);
  }

  try {
    const updatedId = await updateContent({
      instanceId: actor.instanceId,
      actorAccountId: actor.actorAccountId!,
      actorDisplayName: actor.actorDisplayName,
      requestId: actor.requestId,
      traceId: actor.traceId,
      contentId,
      ...(payloadValidation.payload === undefined ? {} : { payload: payloadValidation.payload }),
      ...parsed.data,
    });
    if (!updatedId) {
      return createApiError(404, 'not_found', 'Inhalt wurde nicht gefunden.', actor.requestId);
    }

    const item = await loadContentDetail(actor.instanceId, updatedId);
    const access = await resolveContentAccess(actor);
    return item
      ? jsonResponse(200, asApiItem({ ...item, access }, actor.requestId))
      : createApiError(404, 'not_found', 'Inhalt wurde nicht gefunden.', actor.requestId);
  } catch (error) {
    if (error instanceof Error && error.message === 'content_published_at_required') {
      return createApiError(
        400,
        'invalid_request',
        'Veröffentlichungsdatum ist für veröffentlichte Inhalte erforderlich.',
        actor.requestId
      );
    }
    logger.error('Content update failed', {
      operation: 'content_update',
      instance_id: actor.instanceId,
      request_id: actor.requestId,
      trace_id: actor.traceId,
      content_id: contentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(503, 'database_unavailable', 'Inhalt konnte nicht aktualisiert werden.', actor.requestId);
  }
};

export const deleteContentResponse = async (
  request: Request,
  actor: ResolvedContentActor['actor']
): Promise<Response> => {
  const csrfError = validateCsrf(request, actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const contentId = readPathSegment(request, 4);
  if (!contentId) {
    return createApiError(400, 'invalid_request', 'Inhalts-ID fehlt.', actor.requestId);
  }

  try {
    const deletedId = await deleteContent({
      instanceId: actor.instanceId,
      actorAccountId: actor.actorAccountId!,
      actorDisplayName: actor.actorDisplayName,
      requestId: actor.requestId,
      traceId: actor.traceId,
      contentId,
    });

    return deletedId
      ? jsonResponse(200, asApiItem({ id: deletedId }, actor.requestId))
      : createApiError(404, 'not_found', 'Inhalt wurde nicht gefunden.', actor.requestId);
  } catch (error) {
    logger.error('Content delete failed', {
      operation: 'content_delete',
      instance_id: actor.instanceId,
      request_id: actor.requestId,
      trace_id: actor.traceId,
      content_id: contentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(503, 'database_unavailable', 'Inhalt konnte nicht gelöscht werden.', actor.requestId);
  }
};
