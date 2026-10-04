import { withAuthenticatedUser, type AuthenticatedRequestContext } from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { errorJson, matchRequestRoute } from './content-route-core.js';
import { withMainserverContextBinding } from './content-route-context.js';
import { isUnexpectedMainserverError, SvaMainserverError } from './errors.js';
import {
  contentTypeFor,
  handleListRequest,
  handleDetailRequest,
  type RouteMatch,
} from './generic-items-route-access.js';
import { handleCreateRequest, handleDeleteRequest } from './generic-items-route-create-delete.js';
import { handleUpdateRequest } from './generic-items-route-update.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import { dispatchSvaMainserverProjectsRequest } from './projects-route.js';

const GENERIC_ITEMS_COLLECTION_PATH = '/api/v1/mainserver/generic-items';
const FAQ_COLLECTION_PATH = '/api/v1/mainserver/faqs';
const COCKPIT_CARDS_COLLECTION_PATH = '/api/v1/mainserver/cockpit-cards';
const logger = createSdkLogger({ component: 'sva-mainserver-generic-items-route', level: 'info' });
const matchRoute = (request: Request): RouteMatch | null =>
  matchRequestRoute(request, GENERIC_ITEMS_COLLECTION_PATH, 'generic-items') ??
  matchRequestRoute(request, FAQ_COLLECTION_PATH, 'faq') ??
  matchRequestRoute(request, COCKPIT_CARDS_COLLECTION_PATH, 'cockpit-cards');

const dispatchAuthenticated = async (
  request: Request,
  route: RouteMatch,
  ctx: AuthenticatedRequestContext
) => {
  const workspaceContext = getWorkspaceContext();
  const routeContentType = contentTypeFor(route.contentKind);
  const logSuccess = (operation: string, contentId?: string) => {
    const logSuccessEvent = request.method === 'GET' ? logger.debug : logger.info;
    logSuccessEvent('Mainserver generic items route succeeded', {
      operation,
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: routeContentType,
      content_id: contentId,
      method: request.method,
    });
  };

  try {
    if (route.kind === 'collection' && request.method === 'GET') {
      return await handleListRequest(request, ctx, route.contentKind, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'GET') {
      return withMainserverContextBinding(
        await handleDetailRequest(request, ctx, route.contentKind, route.itemId, logSuccess),
        ctx
      );
    }

    if (route.kind === 'collection' && request.method === 'POST') {
      return await handleCreateRequest(
        request,
        ctx,
        route.contentKind,
        workspaceContext.requestId,
        logSuccess
      );
    }

    if (route.kind === 'item' && request.method === 'PATCH') {
      return await handleUpdateRequest(
        request,
        ctx,
        route.contentKind,
        workspaceContext.requestId,
        route.itemId,
        logSuccess
      );
    }

    if (route.kind === 'item' && request.method === 'DELETE') {
      return await handleDeleteRequest(
        request,
        ctx,
        route.contentKind,
        workspaceContext.requestId,
        route.itemId,
        logSuccess
      );
    }

    return errorJson(
      405,
      'method_not_allowed',
      'Methode wird für diesen Mainserver-Inhalt nicht unterstützt.'
    );
  } catch (error) {
    const logFailure = isUnexpectedMainserverError(error) ? logger.error : logger.warn;
    logFailure('Mainserver generic items route failed', {
      operation: 'mainserver_content_request',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: routeContentType,
      content_id: route.kind === 'item' ? route.itemId : undefined,
      method: request.method,
      error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
    });

    return toMainserverErrorResponse(error, 'Mainserver-Anfrage ist fehlgeschlagen.');
  }
};

export const dispatchSvaMainserverGenericItemsRequest = async (
  request: Request
): Promise<Response | null> => {
  const projectsResponse = await dispatchSvaMainserverProjectsRequest(request);
  if (projectsResponse) {
    return projectsResponse;
  }
  const route = matchRoute(request);
  if (!route) {
    return null;
  }

  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, route, ctx));
};
