import { createSdkLogger } from '@sva/server-runtime';

import {
  asApiItem,
  createApiError,
  parseRequestBody,
  readPathSegment,
} from '../iam-account-management/api-helpers.js';
import { jsonResponse } from '../db.js';
import { validateCsrf } from '../iam-account-management/csrf.js';

import { validateContentTypePayload } from './content-type-registry.js';
import { authorizeUpdateContentActions } from './mutation-authorization.js';
import {
  createFailureResponse,
  logCreateFailure,
  parseCreateRequest,
  reserveCreateIdempotency,
  completeCreateIdempotency,
} from './mutation-helpers.js';
import type { ResolvedContentActor } from './request-context.js';
import { authorizeContentAction, resolveContentAccess } from './request-context.js';
import { createContent, deleteContent, loadContentById, loadContentDetail, loadContentRowById, updateContent } from './repository.js';
import { mapContentListItem } from './repository-mappers.js';
import { isContentStateValidationError } from './repository-state-validation.js';
import { updateContentSchema } from './schemas.js';

const logger = createSdkLogger({ component: 'iam-contents', level: 'info' });

const createContentStateValidationResponse = (
  error: unknown,
  requestId?: string
): Response | null => {
  if (!isContentStateValidationError(error)) {
    return null;
  }
  if (error.code === 'content_published_at_required') {
    return createApiError(
      400,
      'invalid_request',
      'Veröffentlichungsdatum ist für veröffentlichte Inhalte erforderlich.',
      requestId,
      { reason_code: error.code }
    );
  }

  return createApiError(
    400,
    'invalid_request',
    'Das Veröffentlichungsfenster ist ungültig.',
    requestId,
    { reason_code: error.code }
  );
};

export const createContentResponse = async (
  request: Request,
  actor: ResolvedContentActor['actor']
): Promise<Response> => {
  const prepared = await parseCreateRequest(request, actor);
  if (prepared instanceof Response) {
    return prepared;
  }
  const parsedData = {
    ...prepared.parsedData,
    organizationId: prepared.parsedData.organizationId ?? actor.activeOrganizationId,
  };

  const authorizationError = await authorizeContentAction(actor, 'content.create', {
    contentType: parsedData.contentType,
    domainCapability: 'content.create',
    organizationId: parsedData.organizationId,
  });
  if (authorizationError) {
    return createFailureResponse(
      actor,
      prepared.idempotencyKey,
      authorizationError.status,
      'forbidden',
      'Keine Berechtigung für diese Inhaltsoperation.'
    );
  }

  const replayOrConflict = await reserveCreateIdempotency(actor, prepared.idempotencyKey, prepared.rawBody);
  if (replayOrConflict) {
    return replayOrConflict;
  }

  try {
    const createdId = await createContent({
      instanceId: actor.instanceId,
      actorAccountId: actor.actorAccountId!,
      actorDisplayName: actor.actorDisplayName,
      requestId: actor.requestId,
      traceId: actor.traceId,
      ...parsedData,
      payload: prepared.payload,
    });
    const item = await loadContentDetail(actor.instanceId, createdId);
    if (!item) {
      throw new Error('created_content_not_found');
    }

    const access = await resolveContentAccess(actor);
    const responseBody = asApiItem({ ...item, access }, actor.requestId);
    await completeCreateIdempotency(actor, prepared.idempotencyKey, 201, responseBody);
    return jsonResponse(201, responseBody);
  } catch (error) {
    const validationResponse = createContentStateValidationResponse(error, actor.requestId);
    if (validationResponse) {
      return createFailureResponse(
        actor,
        prepared.idempotencyKey,
        validationResponse.status,
        'invalid_request',
        isContentStateValidationError(error) && error.code === 'content_publication_window_invalid'
          ? 'Das Veröffentlichungsfenster ist ungültig.'
          : 'Veröffentlichungsdatum ist für veröffentlichte Inhalte erforderlich.'
      );
    }
    logCreateFailure(actor, error);

    return createFailureResponse(
      actor,
      prepared.idempotencyKey,
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

  const authorizationError = await authorizeUpdateContentActions(actor, contentId, currentContent, parsed.data);
  if (authorizationError) {
    return authorizationError;
  }

  try {
    const updatedId = await updateContent({
      instanceId: actor.instanceId,
      actorAccountId: actor.actorAccountId!,
      actorDisplayName: actor.actorDisplayName,
      requestId: actor.requestId,
      traceId: actor.traceId,
      contentId,
      ...parsed.data,
      ...(payloadValidation.payload === undefined ? {} : { payload: payloadValidation.payload }),
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
    const validationResponse = createContentStateValidationResponse(error, actor.requestId);
    if (validationResponse) {
      return validationResponse;
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
    const currentRow = await loadContentRowById(actor.instanceId, contentId);
    if (!currentRow) {
      return createApiError(404, 'not_found', 'Inhalt wurde nicht gefunden.', actor.requestId);
    }
    const currentContent = mapContentListItem(currentRow);

    const authorizationError = await authorizeContentAction(actor, 'content.delete', {
      contentId,
      contentType: currentContent.contentType,
      domainCapability: 'content.delete',
      organizationId: currentContent.organizationId,
    });
    if (authorizationError) {
      return authorizationError;
    }

    const deletedId = await deleteContent({
      instanceId: actor.instanceId,
      actorAccountId: actor.actorAccountId!,
      actorDisplayName: actor.actorDisplayName,
      requestId: actor.requestId,
      traceId: actor.traceId,
      contentId,
      currentContent: currentRow,
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
