import {
  authorizeContentPrimitiveForUser,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';

import { withMainserverContextBinding } from './content-route-context.js';
import { errorJson, json } from './content-route-core.js';
import { parseMainserverListQuery } from './list-pagination.js';
import {
  getSvaMainserverSurvey,
  getSvaMainserverSurveyResults,
  listSvaMainserverSurveys,
} from './service.js';
import {
  authorizeSurveyOrResponse,
  isSurveyAuthorizationDenial,
  SURVEYS_COLLECTION_PATH,
  SURVEYS_CONTENT_TYPE,
  toSurveyAuthorizationFailureResponse,
  type SurveyAuthorizationFailure,
} from './surveys-route-authorization.js';
import {
  matchSurveysRoute,
  toSurveyRouteErrorResponse,
  type SurveysRouteMatch as RouteMatch,
} from './surveys-route-helpers.js';
import {
  handleDeleteSurveyFreeTextResponse,
  handleReleaseSurveyFreeTextResponse,
} from './surveys-route-moderation.js';
import {
  handleCreateSurvey,
  handleDeleteSurvey,
  handleUpdateSurvey,
} from './surveys-route-mutations.js';

const handleList = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actor = await authorizeSurveyOrResponse(ctx, 'read');
  if (actor instanceof Response) return actor;
  return json(await listSvaMainserverSurveys({ ...actor, ...parseMainserverListQuery(request) }));
};

const handleGetItem = async (
  ctx: AuthenticatedRequestContext,
  surveyId: string
): Promise<Response> => {
  const actor = await authorizeSurveyOrResponse(ctx, 'read', surveyId);
  if (actor instanceof Response) return actor;
  const survey = await getSvaMainserverSurvey({ ...actor, surveyId });
  const [moderationAccess, exportAccess] = await Promise.all([
    authorizeContentPrimitiveForUser({
      ctx,
      action: 'surveys.moderate',
      resource: { contentType: SURVEYS_CONTENT_TYPE, contentId: surveyId },
    }),
    authorizeContentPrimitiveForUser({
      ctx,
      action: 'surveys.export',
      resource: { contentType: SURVEYS_CONTENT_TYPE, contentId: surveyId },
    }),
  ]);
  const operationalFailure = [moderationAccess, exportAccess].find(
    (result): result is SurveyAuthorizationFailure =>
      !result.ok && !isSurveyAuthorizationDenial(result)
  );
  if (operationalFailure) return toSurveyAuthorizationFailureResponse(operationalFailure);
  if (!moderationAccess.ok && !exportAccess.ok) return json({ data: survey });
  const results = await getSvaMainserverSurveyResults({ ...actor, surveyId });
  return json({ data: { ...survey, results } });
};

const unsupportedMethodResponse = () =>
  errorJson(405, 'invalid_request', 'Methode für Umfragen nicht unterstützt.');

const handleCollectionRequest = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    try {
      if (request.method === 'GET') return handleList(request, ctx);
      if (request.method === 'POST') return handleCreateSurvey(request, ctx);
      return unsupportedMethodResponse();
    } catch (error) {
      return toSurveyRouteErrorResponse(error);
    }
  });

const handleItemRequest = async (
  request: Request,
  routeMatch: Extract<RouteMatch, { kind: 'item' }>
): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    try {
      if (request.method === 'GET') {
        return withMainserverContextBinding(await handleGetItem(ctx, routeMatch.itemId), ctx);
      }
      if (request.method === 'PATCH') return handleUpdateSurvey(request, ctx, routeMatch.itemId);
      if (request.method === 'DELETE') return handleDeleteSurvey(request, ctx, routeMatch.itemId);
      return unsupportedMethodResponse();
    } catch (error) {
      return toSurveyRouteErrorResponse(error);
    }
  });

const handleFreeTextResponseRequest = async (
  request: Request,
  routeMatch: Extract<RouteMatch, { kind: 'freeTextResponse' }>
): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    try {
      if (request.method === 'PATCH') {
        return handleReleaseSurveyFreeTextResponse(
          request,
          ctx,
          routeMatch.surveyId,
          routeMatch.freeTextResponseId
        );
      }
      if (request.method === 'DELETE') {
        return handleDeleteSurveyFreeTextResponse(
          request,
          ctx,
          routeMatch.surveyId,
          routeMatch.freeTextResponseId
        );
      }
      return unsupportedMethodResponse();
    } catch (error) {
      return toSurveyRouteErrorResponse(error);
    }
  });

export const dispatchSvaMainserverSurveysRequest = async (
  request: Request
): Promise<Response | null> => {
  const routeMatch = matchSurveysRoute(request, SURVEYS_COLLECTION_PATH);
  if (!routeMatch) return null;
  if (routeMatch.kind === 'collection') return handleCollectionRequest(request);
  if (routeMatch.kind === 'item') return handleItemRequest(request, routeMatch);
  return handleFreeTextResponseRequest(request, routeMatch);
};
