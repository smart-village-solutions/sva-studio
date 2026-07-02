import {
  authorizeContentPrimitiveForUser,
  validateCsrf,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type { SvaMainserverSurveyInput } from '../types.js';
import {
  createSvaMainserverSurvey,
  deleteSvaMainserverSurvey,
  getSvaMainserverSurvey,
  getSvaMainserverSurveyResults,
  listSvaMainserverSurveys,
  releaseSvaMainserverSurveyFreeTextResponse,
  updateSvaMainserverSurvey,
} from './service.js';
import {
  errorJson,
  isResponse,
  isRecord,
  json,
  matchRequestRoute,
  parseJsonObjectBody,
  type RouteMatch as SharedRouteMatch,
} from './content-route-core.js';
import { SvaMainserverError } from './errors.js';
import { parseMainserverListQuery } from './list-pagination.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';

const SURVEYS_CONTENT_TYPE = 'surveys.survey';
const SURVEYS_COLLECTION_PATH = '/api/v1/mainserver/surveys';
const logger = createSdkLogger({ component: 'sva-mainserver-surveys-route', level: 'info' });

type ContentKind = 'surveys';
type RouteMatch =
  | SharedRouteMatch<ContentKind>
  | {
      readonly kind: 'freeTextResponse';
      readonly contentKind: ContentKind;
      readonly surveyId: string;
      readonly freeTextResponseId: string;
    };

type ContentActor = Readonly<{
  instanceId: string;
  keycloakSubject: string;
  activeOrganizationId?: string;
}>;

type SurveyMutationPayload = Awaited<ReturnType<typeof createSvaMainserverSurvey>>;
type AuthorizationDecision = Awaited<ReturnType<typeof authorizeContentPrimitiveForUser>>;
type AuthorizationFailure = Extract<AuthorizationDecision, { readonly ok: false }>;

const decodePathSegment = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

const matchRoute = (request: Request): RouteMatch | null => {
  const pathname = new URL(request.url).pathname;
  const freeTextResponsePrefix = `${SURVEYS_COLLECTION_PATH}/`;

  if (pathname.startsWith(freeTextResponsePrefix)) {
    const segments = pathname.slice(freeTextResponsePrefix.length).split('/');
    if (segments.length === 3 && segments[1] === 'free-text-responses') {
      const surveyId = decodePathSegment(segments[0] ?? '');
      const freeTextResponseId = decodePathSegment(segments[2] ?? '');
      if (
        surveyId &&
        freeTextResponseId &&
        surveyId.includes('/') === false &&
        freeTextResponseId.includes('/') === false
      ) {
        return {
          kind: 'freeTextResponse',
          contentKind: 'surveys',
          surveyId,
          freeTextResponseId,
        };
      }
    }
  }

  return matchRequestRoute(request, SURVEYS_COLLECTION_PATH, 'surveys');
};

const validateMutationRequest = (request: Request, requestId?: string): Response | null => {
  const csrfError = validateCsrf(request, requestId);
  return csrfError ? errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.') : null;
};
const authorizeOrResponse = async (
  ctx: AuthenticatedRequestContext,
  action: 'read' | 'create' | 'update' | 'delete' | 'moderate',
  contentId?: string
): Promise<ContentActor | Response> => {
  if (!ctx.user.instanceId) {
    return errorJson(400, 'invalid_instance_id', 'Kein Instanzkontext für Umfragen vorhanden.');
  }

  const result = await authorizeContentPrimitiveForUser({
    ctx,
    action: `surveys.${action}`,
    resource: {
      contentType: SURVEYS_CONTENT_TYPE,
      ...(contentId ? { contentId } : {}),
    },
  });

  if (!result.ok) {
    const workspaceContext = getWorkspaceContext();
    logger.warn('Mainserver survey local authorization denied', {
      operation: 'mainserver_survey_authorize',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: SURVEYS_CONTENT_TYPE,
      content_id: contentId,
      action,
      error_code: result.error,
    });
    return errorJson(result.status, result.error, result.message);
  }
  return {
    instanceId: result.actor.instanceId,
    keycloakSubject: result.actor.keycloakSubject,
    ...(result.actor.organizationId ?? ctx.activeOrganizationId
      ? { activeOrganizationId: result.actor.organizationId ?? ctx.activeOrganizationId }
      : {}),
  };
};

const validateLocalizedTextShape = (value: unknown, message: string): Response | null => {
  if (value === undefined) {
    return null;
  }

  return isRecord(value) ? null : errorJson(400, 'invalid_request', message);
};

const validateStringArrayShape = (value: unknown, message: string): Response | null => {
  if (value === undefined) {
    return null;
  }

  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? null
    : errorJson(400, 'invalid_request', message);
};

const validateObjectArrayShape = (
  value: unknown,
  collectionMessage: string,
  itemMessage: string
): Response | null => {
  if (value === undefined) {
    return null;
  }
  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', collectionMessage);
  }
  return value.every((entry) => isRecord(entry)) ? null : errorJson(400, 'invalid_request', itemMessage);
};

const validateSurveyInputShape = (body: Record<string, unknown>): Response | null => {
  if (Array.isArray(body.questions)) {
    for (const question of body.questions) {
      const optionsValidation = validateObjectArrayShape(
        isRecord(question) ? question.options : undefined,
        'Frageoptionen müssen als Liste gesendet werden.',
        'Frageoptionen müssen Objekte sein.'
      );
      if (optionsValidation) {
        return optionsValidation;
      }
    }
  }

  return (
    validateLocalizedTextShape(body.title, 'Der Umfrage-Titel muss als Objekt gesendet werden.') ??
    validateLocalizedTextShape(body.shortDescription, 'Die Kurzbeschreibung muss als Objekt gesendet werden.') ??
    validateLocalizedTextShape(body.description, 'Die Beschreibung muss als Objekt gesendet werden.') ??
    validateLocalizedTextShape(body.privacyNotice, 'Der Datenschutzhinweis muss als Objekt gesendet werden.') ??
    validateLocalizedTextShape(body.transparencyNotice, 'Der Transparenzhinweis muss als Objekt gesendet werden.') ??
    validateStringArrayShape(body.targetAreaIds, 'Die Zielgebiete müssen als Liste von Strings gesendet werden.') ??
    validateObjectArrayShape(body.questions, 'Fragen müssen als Liste gesendet werden.', 'Fragen müssen Objekte sein.') ??
    validateObjectArrayShape(
      body.freeTextResponses,
      'Freitextantworten müssen als Liste gesendet werden.',
      'Freitextantworten müssen Objekte sein.'
    )
  );
};

const parseSurveyInput = async (request: Request): Promise<SvaMainserverSurveyInput | Response> =>
  parseJsonObjectBody(request, 'Umfrage-Daten müssen als Objekt gesendet werden.').then((body) => {
    if (isResponse(body)) {
      return body;
    }

    return validateSurveyInputShape(body) ?? (body as SvaMainserverSurveyInput);
  });
const toUnexpectedRouteError = (message: string) =>
  toMainserverErrorResponse(
    new SvaMainserverError({
      code: 'invalid_response',
      message,
      statusCode: 500,
    }),
    message
  );

const handleRouteError = (error: unknown) =>
  error instanceof SvaMainserverError
    ? toMainserverErrorResponse(error, 'Umfragen konnten nicht verarbeitet werden.')
    : toUnexpectedRouteError('Unbekannter Fehler für Umfragen.');

const isAuthorizationDenial = (result: AuthorizationFailure): boolean => result.status === 403 && result.error === 'forbidden';
const toAuthorizationFailureResponse = (result: AuthorizationFailure): Response => errorJson(result.status, result.error, result.message);

const authorizeMutation = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  action: 'create' | 'update' | 'delete' | 'moderate',
  contentId?: string
): Promise<ContentActor | Response> => {
  const csrfError = validateMutationRequest(request, getWorkspaceContext().requestId);
  if (csrfError) {
    return csrfError;
  }
  return authorizeOrResponse(ctx, action, contentId);
};
const toMutationFailureResponse = (
  payload: SurveyMutationPayload,
  fallbackMessage: string
): Response => {
  const firstError = payload.errors[0];
  const errorCode = firstError?.code?.toLowerCase() ?? 'survey_mutation_failed';
  const message = firstError?.message ?? fallbackMessage;
  const status =
    firstError?.code === 'FORBIDDEN'
      ? 403
      : firstError?.code === 'SURVEY_NOT_FOUND'
        ? 404
        : firstError?.code === 'INTERNAL_ERROR'
          ? 500
          : 422;
  return errorJson(status, errorCode, message);
};
const handleList = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const actor = await authorizeOrResponse(ctx, 'read');
  if (actor instanceof Response) {
    return actor;
  }
  const pagination = parseMainserverListQuery(request);
  return json(
    await listSvaMainserverSurveys({
      ...actor,
      ...pagination,
    })
  );
};

const handleCreate = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const actor = await authorizeMutation(request, ctx, 'create');
  if (actor instanceof Response) {
    return actor;
  }

  const survey = await parseSurveyInput(request);
  if (survey instanceof Response) {
    return survey;
  }
  const created = await createSvaMainserverSurvey({ ...actor, survey });
  if (!created.success || created.errors.length > 0 || !created.survey) {
    return toMutationFailureResponse(created, 'Umfrage konnte nicht angelegt werden.');
  }
  return json({ data: created.survey ?? null }, 201);
};

const handleGetItem = async (
  ctx: AuthenticatedRequestContext,
  surveyId: string
): Promise<Response> => {
  const actor = await authorizeOrResponse(ctx, 'read', surveyId);
  if (actor instanceof Response) {
    return actor;
  }

  const survey = await getSvaMainserverSurvey({
    ...actor,
    surveyId,
  });
  const [moderationAccess, exportAccess] = await Promise.all([
    authorizeContentPrimitiveForUser({
      ctx,
      action: 'surveys.moderate',
      resource: {
        contentType: SURVEYS_CONTENT_TYPE,
        contentId: surveyId,
      },
    }),
    authorizeContentPrimitiveForUser({
      ctx,
      action: 'surveys.export',
      resource: {
        contentType: SURVEYS_CONTENT_TYPE,
        contentId: surveyId,
      },
    }),
  ]);
  const secondaryOperationalFailure = [moderationAccess, exportAccess].find(
    (result): result is AuthorizationFailure => !result.ok && !isAuthorizationDenial(result)
  );
  if (secondaryOperationalFailure) {
    return toAuthorizationFailureResponse(secondaryOperationalFailure);
  }
  if (!moderationAccess.ok && !exportAccess.ok) {
    return json({ data: survey });
  }
  const results = await getSvaMainserverSurveyResults({
    ...actor,
    surveyId,
  });
  return json({ data: { ...survey, results } });
};

const handleReleaseFreeTextResponse = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  surveyId: string,
  freeTextResponseId: string
): Promise<Response> => {
  const actor = await authorizeMutation(request, ctx, 'moderate', surveyId);
  if (actor instanceof Response) {
    return actor;
  }

  const released = await releaseSvaMainserverSurveyFreeTextResponse({
    ...actor,
    surveyId,
    freeTextResponseId,
  });
  if (!released.success || released.errors.length > 0) {
    return toMutationFailureResponse(released, 'Freitextantwort konnte nicht freigegeben werden.');
  }
  return json({ data: { id: freeTextResponseId, status: 'PUBLIC' } });
};

const handleDeleteFreeTextResponse = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  surveyId: string,
  freeTextResponseId: string
): Promise<Response> => {
  const actor = await authorizeMutation(request, ctx, 'moderate', surveyId);
  if (actor instanceof Response) {
    return actor;
  }

  const deleted = await updateSvaMainserverSurvey({
    ...actor,
    surveyId,
    survey: {
      freeTextResponses: [{ id: freeTextResponseId, delete: true }],
    },
  });
  if (!deleted.success || deleted.errors.length > 0) {
    return toMutationFailureResponse(deleted, 'Freitextantwort konnte nicht gelöscht werden.');
  }
  return json({ data: { id: freeTextResponseId } });
};

const handleUpdate = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  surveyId: string
): Promise<Response> => {
  const actor = await authorizeMutation(request, ctx, 'update', surveyId);
  if (actor instanceof Response) {
    return actor;
  }

  const survey = await parseSurveyInput(request);
  if (survey instanceof Response) {
    return survey;
  }
  const updated = await updateSvaMainserverSurvey({
    ...actor,
    surveyId,
    survey,
  });
  if (!updated.success || updated.errors.length > 0 || !updated.survey) {
    return toMutationFailureResponse(updated, 'Umfrage konnte nicht gespeichert werden.');
  }
  return json({ data: updated.survey ?? null });
};

const handleDelete = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  surveyId: string
): Promise<Response> => {
  const actor = await authorizeMutation(request, ctx, 'delete', surveyId);
  if (actor instanceof Response) {
    return actor;
  }
  const deleted = await deleteSvaMainserverSurvey({
    ...actor,
    surveyId,
  });
  if (!deleted.success || deleted.errors.length > 0 || !deleted.deletedSurveyId) {
    return toMutationFailureResponse(deleted, 'Umfrage konnte nicht gelöscht werden.');
  }
  return json({ data: { id: deleted.deletedSurveyId ?? surveyId } });
};

const handleCollectionRequest = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    try {
      if (request.method === 'GET') {
        return await handleList(request, ctx);
      }

      if (request.method === 'POST') {
        return await handleCreate(request, ctx);
      }

      return errorJson(405, 'invalid_request', 'Methode für Umfragen nicht unterstützt.');
    } catch (error) {
      return handleRouteError(error);
    }
  });

const handleItemRequest = async (
  request: Request,
  routeMatch: Extract<RouteMatch, { kind: 'item' }>
): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    try {
      if (request.method === 'GET') {
        return await handleGetItem(ctx, routeMatch.itemId);
      }

      if (request.method === 'PATCH') {
        return await handleUpdate(request, ctx, routeMatch.itemId);
      }

      if (request.method === 'DELETE') {
        return await handleDelete(request, ctx, routeMatch.itemId);
      }

      return errorJson(405, 'invalid_request', 'Methode für Umfragen nicht unterstützt.');
    } catch (error) {
      return handleRouteError(error);
    }
  });

const handleFreeTextResponseRequest = async (
  request: Request,
  routeMatch: Extract<RouteMatch, { kind: 'freeTextResponse' }>
): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    try {
      if (request.method === 'PATCH') {
        return await handleReleaseFreeTextResponse(request, ctx, routeMatch.surveyId, routeMatch.freeTextResponseId);
      }

      if (request.method === 'DELETE') {
        return await handleDeleteFreeTextResponse(request, ctx, routeMatch.surveyId, routeMatch.freeTextResponseId);
      }

      return errorJson(405, 'invalid_request', 'Methode für Umfragen nicht unterstützt.');
    } catch (error) {
      return handleRouteError(error);
    }
  });

export const dispatchSvaMainserverSurveysRequest = async (request: Request): Promise<Response | null> => {
  const routeMatch = matchRoute(request);
  if (!routeMatch) {
    return null;
  }

  if (routeMatch.kind === 'collection') {
    return handleCollectionRequest(request);
  }
  if (routeMatch.kind === 'item') {
    return handleItemRequest(request, routeMatch);
  }

  return handleFreeTextResponseRequest(request, routeMatch);
};
