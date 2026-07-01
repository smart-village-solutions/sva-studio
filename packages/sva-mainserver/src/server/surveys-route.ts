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
  listSvaMainserverSurveys,
  updateSvaMainserverSurvey,
} from './service.js';
import {
  errorJson,
  isResponse,
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
type RouteMatch = SharedRouteMatch<ContentKind>;

type ContentActor = Readonly<{
  instanceId: string;
  keycloakSubject: string;
  activeOrganizationId?: string;
}>;

const matchRoute = (request: Request): RouteMatch | null =>
  matchRequestRoute(request, SURVEYS_COLLECTION_PATH, 'surveys');

const validateMutationRequest = (request: Request, requestId?: string): Response | null => {
  const csrfError = validateCsrf(request, requestId);
  return csrfError ? errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.') : null;
};

const authorizeOrResponse = async (
  ctx: AuthenticatedRequestContext,
  action: 'read' | 'create' | 'update' | 'delete',
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
    });
    return errorJson(403, 'forbidden', 'Keine Berechtigung für Umfragen.');
  }

  return {
    instanceId: ctx.user.instanceId,
    keycloakSubject: ctx.user.id,
    ...(ctx.activeOrganizationId ? { activeOrganizationId: ctx.activeOrganizationId } : {}),
  };
};

const parseSurveyInput = async (request: Request): Promise<SvaMainserverSurveyInput | Response> => {
  const body = await parseJsonObjectBody(request, 'Umfrage-Daten müssen als Objekt gesendet werden.');
  return isResponse(body) ? body : (body as SvaMainserverSurveyInput);
};

const toUnexpectedRouteError = (message: string) =>
  toMainserverErrorResponse(
    new SvaMainserverError({
      code: 'invalid_response',
      message,
      statusCode: 500,
    }),
    message
  );

const handleCollectionRequest = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    try {
      if (request.method === 'GET') {
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
      }

      if (request.method === 'POST') {
        const csrfError = validateMutationRequest(request, getWorkspaceContext().requestId);
        if (csrfError) {
          return csrfError;
        }

        const actor = await authorizeOrResponse(ctx, 'create');
        if (actor instanceof Response) {
          return actor;
        }

        const survey = await parseSurveyInput(request);
        if (survey instanceof Response) {
          return survey;
        }

        const created = await createSvaMainserverSurvey({ ...actor, survey });
        return json({ data: created.survey ?? null }, 201);
      }

      return errorJson(405, 'invalid_request', 'Methode für Umfragen nicht unterstützt.');
    } catch (error) {
      return error instanceof SvaMainserverError
        ? toMainserverErrorResponse(error, 'Umfragen konnten nicht verarbeitet werden.')
        : toUnexpectedRouteError('Unbekannter Fehler für Umfragen.');
    }
  });

const handleItemRequest = async (
  request: Request,
  routeMatch: Extract<RouteMatch, { kind: 'item' }>
): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    try {
      if (request.method === 'GET') {
        const actor = await authorizeOrResponse(ctx, 'read', routeMatch.itemId);
        if (actor instanceof Response) {
          return actor;
        }

        const survey = await getSvaMainserverSurvey({
          ...actor,
          surveyId: routeMatch.itemId,
        });
        return survey
          ? json({ data: survey })
          : errorJson(404, 'not_found', 'Die Umfrage wurde nicht gefunden.');
      }

      if (request.method === 'PATCH') {
        const csrfError = validateMutationRequest(request, getWorkspaceContext().requestId);
        if (csrfError) {
          return csrfError;
        }

        const actor = await authorizeOrResponse(ctx, 'update', routeMatch.itemId);
        if (actor instanceof Response) {
          return actor;
        }

        const survey = await parseSurveyInput(request);
        if (survey instanceof Response) {
          return survey;
        }

        const updated = await updateSvaMainserverSurvey({
          ...actor,
          surveyId: routeMatch.itemId,
          survey,
        });
        return json({ data: updated.survey ?? null });
      }

      if (request.method === 'DELETE') {
        const csrfError = validateMutationRequest(request, getWorkspaceContext().requestId);
        if (csrfError) {
          return csrfError;
        }

        const actor = await authorizeOrResponse(ctx, 'delete', routeMatch.itemId);
        if (actor instanceof Response) {
          return actor;
        }

        const deleted = await deleteSvaMainserverSurvey({
          ...actor,
          surveyId: routeMatch.itemId,
        });
        return json({ data: { id: deleted.deletedSurveyId ?? routeMatch.itemId } });
      }

      return errorJson(405, 'invalid_request', 'Methode für Umfragen nicht unterstützt.');
    } catch (error) {
      return error instanceof SvaMainserverError
        ? toMainserverErrorResponse(error, 'Umfragen konnten nicht verarbeitet werden.')
        : toUnexpectedRouteError('Unbekannter Fehler für Umfragen.');
    }
  });

export const dispatchSvaMainserverSurveysRequest = async (request: Request): Promise<Response | null> => {
  const routeMatch = matchRoute(request);
  if (!routeMatch) {
    return null;
  }

  return routeMatch.kind === 'collection'
    ? handleCollectionRequest(request)
    : handleItemRequest(request, routeMatch);
};
