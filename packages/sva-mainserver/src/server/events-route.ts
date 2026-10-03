import { withAuthenticatedUser, type AuthenticatedRequestContext } from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { errorJson, matchRequestRoute } from './content-route-core.js';
import { withMainserverContextBinding } from './content-route-context.js';
import { isUnexpectedMainserverError, SvaMainserverError } from './errors.js';
import {
  contentTypeFor,
  handleCollectionRead,
  handleItemRead,
  type RouteMatch,
} from './events-route-access.js';
import {
  handleCollectionCreate,
  handleItemUpdate,
  handleItemDelete,
} from './events-route-write.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';

const EVENTS_COLLECTION_PATH = '/api/v1/mainserver/events';
const logger = createSdkLogger({ component: 'sva-mainserver-events-route', level: 'info' });
const matchRoute = (request: Request): RouteMatch | null =>
  matchRequestRoute(request, EVENTS_COLLECTION_PATH, 'events');

const dispatchAuthenticated = async (
  request: Request,
  route: RouteMatch,
  ctx: AuthenticatedRequestContext
) => {
  const workspaceContext = getWorkspaceContext();
  const logSuccess = (operation: string, contentId?: string) => {
    try {
      const logSuccessEvent = request.method === 'GET' ? logger.debug : logger.info;
      logSuccessEvent('Mainserver content route succeeded', {
        operation,
        request_id: workspaceContext.requestId,
        trace_id: workspaceContext.traceId,
        actor_id: ctx.user.id,
        instance_id: ctx.user.instanceId,
        content_type: contentTypeFor(route.contentKind),
        content_id: contentId,
        method: request.method,
      });
    } catch {
      // Observability failures must not turn successful upstream operations into request failures.
    }
  };

  try {
    if (route.kind === 'collection' && request.method === 'GET') {
      return await handleCollectionRead(request, route, ctx, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'GET') {
      return withMainserverContextBinding(
        await handleItemRead(request, route, ctx, logSuccess),
        ctx
      );
    }

    if (route.kind === 'collection' && request.method === 'POST') {
      return await handleCollectionCreate(
        request,
        route,
        ctx,
        workspaceContext.requestId,
        logSuccess
      );
    }

    if (route.kind === 'item' && request.method === 'PATCH') {
      return await handleItemUpdate(request, route, ctx, workspaceContext.requestId, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'DELETE') {
      return await handleItemDelete(request, route, ctx, workspaceContext.requestId, logSuccess);
    }

    return errorJson(
      405,
      'method_not_allowed',
      'Methode wird für diesen Mainserver-Inhalt nicht unterstützt.'
    );
  } catch (error) {
    const logFailure = isUnexpectedMainserverError(error) ? logger.error : logger.warn;
    logFailure('Mainserver content route failed', {
      operation: 'mainserver_content_request',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: contentTypeFor(route.contentKind),
      content_id: route.kind === 'item' ? route.itemId : undefined,
      method: request.method,
      error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
    });
    return toMainserverErrorResponse(error, 'Mainserver-Anfrage ist fehlgeschlagen.');
  }
};

export const dispatchSvaMainserverEventsRequest = async (
  request: Request
): Promise<Response | null> => {
  const route = matchRoute(request);
  if (!route) {
    return null;
  }

  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, route, ctx));
};
