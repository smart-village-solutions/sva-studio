import {
  authorizeContentPrimitiveForUser,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { errorJson, json } from './content-route-core.js';
import { SvaMainserverError } from './errors.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import { listSvaMainserverCategories } from './service.js';

const CATEGORY_COLLECTION_PATH = '/api/v1/mainserver/categories';
const logger = createSdkLogger({ component: 'sva-mainserver-categories-route', level: 'info' });

type CategoriesActor = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly activeOrganizationId?: string;
};

const matchCategoriesRoute = (request: Request): boolean => new URL(request.url).pathname === CATEGORY_COLLECTION_PATH;

const authorizeOrResponse = async (ctx: AuthenticatedRequestContext): Promise<CategoriesActor | Response> => {
  const result = await authorizeContentPrimitiveForUser({
    ctx,
    action: 'categories.read',
  });

  if (!result.ok) {
    const workspaceContext = getWorkspaceContext();
    logger.warn('Mainserver categories local authorization denied', {
      operation: 'mainserver_categories_authorize',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      action: 'categories.read',
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
    return errorJson(405, 'method_not_allowed', 'Methode wird für Mainserver-Kategorien nicht unterstützt.');
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
      action: 'categories.read',
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
      action: 'categories.read',
      method: 'GET',
      error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
    });
    return toMainserverErrorResponse(error, 'Mainserver-Kategorien-Anfrage ist fehlgeschlagen.');
  }
};

export const dispatchSvaMainserverCategoriesRequest = async (request: Request): Promise<Response | null> => {
  if (matchCategoriesRoute(request) === false) {
    return null;
  }

  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, ctx));
};
