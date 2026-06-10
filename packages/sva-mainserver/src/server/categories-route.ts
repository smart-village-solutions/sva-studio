import {
  authorizeContentPrimitiveForUser,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { errorJson, json } from './content-route-helpers.js';
import { SvaMainserverError } from './errors.js';
import { listSvaMainserverCategories } from './service.js';

const NEWS_CONTENT_TYPE = 'news.article';
const CATEGORY_COLLECTION_PATH = '/api/v1/mainserver/categories';
const logger = createSdkLogger({ component: 'sva-mainserver-categories-route', level: 'info' });

type CategoriesActor = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly activeOrganizationId?: string;
};

const matchCategoriesRoute = (request: Request): boolean => new URL(request.url).pathname === CATEGORY_COLLECTION_PATH;

const toMainserverErrorResponse = (error: unknown): Response => {
  if (error instanceof SvaMainserverError) {
    const status =
      error.statusCode ??
      ({
        missing_credentials: 400,
        organization_mainserver_credentials_missing: 409,
        invalid_config: 400,
        config_not_found: 400,
        integration_disabled: 400,
        unauthorized: 401,
        forbidden: 403,
        not_found: 404,
        database_unavailable: 503,
        identity_provider_unavailable: 503,
        network_error: 503,
        token_request_failed: 502,
        graphql_error: 502,
        invalid_response: 502,
      } satisfies Record<string, number>)[error.code] ??
      502;
    return errorJson(status, error.code, error.message);
  }

  return errorJson(500, 'internal_error', 'Mainserver-News-Anfrage ist fehlgeschlagen.');
};

const authorizeOrResponse = async (ctx: AuthenticatedRequestContext): Promise<CategoriesActor | Response> => {
  const result = await authorizeContentPrimitiveForUser({
    ctx,
    action: 'news.read',
    resource: {
      contentType: NEWS_CONTENT_TYPE,
    },
  });

  if (!result.ok) {
    const workspaceContext = getWorkspaceContext();
    logger.warn('Mainserver categories local authorization denied', {
      operation: 'mainserver_categories_authorize',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: NEWS_CONTENT_TYPE,
      action: 'news.read',
      error_code: result.error,
    });
    return errorJson(result.status, result.error, result.message);
  }

  return {
    instanceId: result.actor.instanceId,
    keycloakSubject: result.actor.keycloakSubject,
    activeOrganizationId: result.actor.organizationId ?? ctx.activeOrganizationId,
  };
};

const dispatchAuthenticated = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const workspaceContext = getWorkspaceContext();

  if (request.method !== 'GET') {
    return errorJson(405, 'method_not_allowed', 'Methode wird für Mainserver-News nicht unterstützt.');
  }

  try {
    const actor = await authorizeOrResponse(ctx);
    if (actor instanceof Response) {
      return actor;
    }

    const data = await listSvaMainserverCategories(actor);
    logger.info('Mainserver categories route succeeded', {
      operation: 'mainserver_categories_list',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: NEWS_CONTENT_TYPE,
      method: 'GET',
      count: data.length,
    });
    return json({ data });
  } catch (error) {
    logger.warn('Mainserver categories route failed', {
      operation: 'mainserver_categories_request',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: NEWS_CONTENT_TYPE,
      method: 'GET',
      error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
    });
    return toMainserverErrorResponse(error);
  }
};

export const dispatchSvaMainserverCategoriesRequest = async (request: Request): Promise<Response | null> => {
  if (matchCategoriesRoute(request) === false) {
    return null;
  }

  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, ctx));
};
