import {
  authorizeContentPrimitiveForUser,
  validateCsrf,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import {
  createSvaMainserverSurvey,
  deleteSvaMainserverSurvey,
  getSvaMainserverSurvey,
  getSvaMainserverSurveyResults,
  listSvaMainserverSurveys,
  releaseSvaMainserverSurveyFreeTextResponse,
  updateSvaMainserverSurvey,
} from './service.js';
import { errorJson, json } from './content-route-core.js';
import { parseMainserverListQuery } from './list-pagination.js';
import {
  hasRequiredSurveyTitle,
  matchSurveysRoute,
  parseSurveyInput,
  toSurveyMutationFailureResponse,
  toSurveyRouteErrorResponse,
  type SurveysRouteMatch as RouteMatch,
} from './surveys-route-helpers.js';

const SURVEYS_CONTENT_TYPE = 'surveys.survey';
const SURVEYS_COLLECTION_PATH = '/api/v1/mainserver/surveys';
const logger = createSdkLogger({ component: 'sva-mainserver-surveys-route', level: 'info' });

type ContentActor = Readonly<{
  instanceId: string;
  keycloakSubject: string;
  activeOrganizationId?: string;
}>;

type AuthorizationDecision = Awaited<ReturnType<typeof authorizeContentPrimitiveForUser>>;
type AuthorizationFailure = Extract<AuthorizationDecision, { readonly ok: false }>;

const validateMutationRequest = (request: Request, requestId?: string): Response | null => {
  const csrfError = validateCsrf(request, requestId);
  return csrfError ? errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.') : null;
};
const authorizeOrResponse = async (ctx: AuthenticatedRequestContext, action: 'read' | 'create' | 'update' | 'delete' | 'moderate', contentId?: string): Promise<ContentActor | Response> => {
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

const isAuthorizationDenial = (result: AuthorizationFailure): boolean => result.status === 403 && result.error === 'forbidden';
const toAuthorizationFailureResponse = (result: AuthorizationFailure): Response => errorJson(result.status, result.error, result.message);

const authorizeMutation = async (request: Request, ctx: AuthenticatedRequestContext, action: 'create' | 'update' | 'delete' | 'moderate', contentId?: string): Promise<ContentActor | Response> => {
  const csrfError = validateMutationRequest(request, getWorkspaceContext().requestId);
  if (csrfError) {
    return csrfError;
  }
  return authorizeOrResponse(ctx, action, contentId);
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
  if (!hasRequiredSurveyTitle(survey.title)) {
    return errorJson(400, 'invalid_request', 'Der Umfrage-Titel ist erforderlich.');
  }
  const created = await createSvaMainserverSurvey({ ...actor, survey });
  if (!created.success || created.errors.length > 0 || !created.survey) {
    return toSurveyMutationFailureResponse(created, 'Umfrage konnte nicht angelegt werden.');
  }
  return json({ data: created.survey ?? null }, 201);
};

const handleGetItem = async (ctx: AuthenticatedRequestContext, surveyId: string): Promise<Response> => {
  const actor = await authorizeOrResponse(ctx, 'read', surveyId);
  if (actor instanceof Response) {
    return actor;
  }

  const survey = await getSvaMainserverSurvey({
    ...actor,
    surveyId,
  });
  const [moderationAccess, exportAccess] = await Promise.all([
    authorizeContentPrimitiveForUser({ ctx, action: 'surveys.moderate', resource: { contentType: SURVEYS_CONTENT_TYPE, contentId: surveyId } }),
    authorizeContentPrimitiveForUser({ ctx, action: 'surveys.export', resource: { contentType: SURVEYS_CONTENT_TYPE, contentId: surveyId } }),
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

const handleReleaseFreeTextResponse = async (request: Request, ctx: AuthenticatedRequestContext, surveyId: string, freeTextResponseId: string): Promise<Response> => {
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
    return toSurveyMutationFailureResponse(released, 'Freitextantwort konnte nicht freigegeben werden.');
  }
  return json({ data: { id: freeTextResponseId, status: 'PUBLIC' } });
};

const handleDeleteFreeTextResponse = async (request: Request, ctx: AuthenticatedRequestContext, surveyId: string, freeTextResponseId: string): Promise<Response> => {
  const actor = await authorizeMutation(request, ctx, 'moderate', surveyId);
  if (actor instanceof Response) {
    return actor;
  }

  const deleted = await updateSvaMainserverSurvey({ ...actor, surveyId, survey: { freeTextResponses: [{ id: freeTextResponseId, delete: true }] } });
  if (!deleted.success || deleted.errors.length > 0) {
    return toSurveyMutationFailureResponse(deleted, 'Freitextantwort konnte nicht gelöscht werden.');
  }
  return json({ data: { id: freeTextResponseId } });
};

const handleUpdate = async (request: Request, ctx: AuthenticatedRequestContext, surveyId: string): Promise<Response> => {
  const actor = await authorizeMutation(request, ctx, 'update', surveyId);
  if (actor instanceof Response) {
    return actor;
  }

  const survey = await parseSurveyInput(request);
  if (survey instanceof Response) {
    return survey;
  }
  const updated = await updateSvaMainserverSurvey({ ...actor, surveyId, survey });
  if (!updated.success || updated.errors.length > 0 || !updated.survey) {
    return toSurveyMutationFailureResponse(updated, 'Umfrage konnte nicht gespeichert werden.');
  }
  return json({ data: updated.survey ?? null });
};

const handleDelete = async (request: Request, ctx: AuthenticatedRequestContext, surveyId: string): Promise<Response> => {
  const actor = await authorizeMutation(request, ctx, 'delete', surveyId);
  if (actor instanceof Response) {
    return actor;
  }
  const deleted = await deleteSvaMainserverSurvey({
    ...actor,
    surveyId,
  });
  if (!deleted.success || deleted.errors.length > 0 || !deleted.deletedSurveyId) {
    return toSurveyMutationFailureResponse(deleted, 'Umfrage konnte nicht gelöscht werden.');
  }
  return json({ data: { id: deleted.deletedSurveyId ?? surveyId } });
};

const unsupportedMethodResponse = () => errorJson(405, 'invalid_request', 'Methode für Umfragen nicht unterstützt.');

const handleCollectionRequest = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    try {
      if (request.method === 'GET') return await handleList(request, ctx);
      if (request.method === 'POST') return await handleCreate(request, ctx);
      return unsupportedMethodResponse();
    } catch (error) {
      return toSurveyRouteErrorResponse(error);
    }
  });

const handleItemRequest = async (request: Request, routeMatch: Extract<RouteMatch, { kind: 'item' }>): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    try {
      if (request.method === 'GET') return await handleGetItem(ctx, routeMatch.itemId);
      if (request.method === 'PATCH') return await handleUpdate(request, ctx, routeMatch.itemId);
      if (request.method === 'DELETE') return await handleDelete(request, ctx, routeMatch.itemId);
      return unsupportedMethodResponse();
    } catch (error) {
      return toSurveyRouteErrorResponse(error);
    }
  });

const handleFreeTextResponseRequest = async (request: Request, routeMatch: Extract<RouteMatch, { kind: 'freeTextResponse' }>): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    try {
      if (request.method === 'PATCH') return await handleReleaseFreeTextResponse(request, ctx, routeMatch.surveyId, routeMatch.freeTextResponseId);
      if (request.method === 'DELETE') return await handleDeleteFreeTextResponse(request, ctx, routeMatch.surveyId, routeMatch.freeTextResponseId);
      return unsupportedMethodResponse();
    } catch (error) {
      return toSurveyRouteErrorResponse(error);
    }
  });

export const dispatchSvaMainserverSurveysRequest = async (request: Request): Promise<Response | null> => {
  const routeMatch = matchSurveysRoute(request, SURVEYS_COLLECTION_PATH);
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
