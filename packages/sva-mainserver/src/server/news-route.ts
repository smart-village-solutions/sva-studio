import { withAuthenticatedUser, type AuthenticatedRequestContext } from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import { errorJson } from './content-route-core.js';
import { withMainserverContextBinding } from './content-route-context.js';
import { isUnexpectedMainserverError, SvaMainserverError } from './errors.js';
import {
  handleCollectionRead,
  handleItemRead,
  NEWS_CONTENT_TYPE,
  type RouteMatch,
} from './news-route-access.js';
import { handleCollectionCreate } from './news-route-create.js';
import { handleItemUpdate, handleItemDelete, handleVisibilityUpdate } from './news-route-update.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';

const NEWS_COLLECTION_PATH = '/api/v1/mainserver/news';
const NEWS_ITEM_PATH_PREFIX = `${NEWS_COLLECTION_PATH}/`;
const logger = createSdkLogger({ component: 'sva-mainserver-news-route', level: 'info' });
const matchRoute = (request: Request): RouteMatch | null => {
  const pathname = new URL(request.url).pathname;
  if (pathname === NEWS_COLLECTION_PATH) {
    return { kind: 'collection' };
  }
  if (pathname.endsWith('/visibility') && pathname.startsWith(NEWS_ITEM_PATH_PREFIX)) {
    const newsId = decodeURIComponent(
      pathname.slice(NEWS_ITEM_PATH_PREFIX.length, -'/visibility'.length)
    );
    if (newsId.length > 0 && newsId.includes('/') === false) {
      return { kind: 'itemVisibility', newsId };
    }
  }
  if (pathname.startsWith(NEWS_ITEM_PATH_PREFIX)) {
    const newsId = decodeURIComponent(pathname.slice(NEWS_ITEM_PATH_PREFIX.length));
    if (newsId.length > 0 && newsId.includes('/') === false) {
      return { kind: 'item', newsId };
    }
  }
  return null;
};

const dispatchAuthenticated = async (
  request: Request,
  route: RouteMatch,
  ctx: AuthenticatedRequestContext
) => {
  const workspaceContext = getWorkspaceContext();
  const logSuccess = (operation: string, newsId?: string) => {
    const logSuccessEvent = request.method === 'GET' ? logger.debug : logger.info;
    logSuccessEvent('Mainserver News route succeeded', {
      operation,
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: NEWS_CONTENT_TYPE,
      content_id: newsId,
      method: request.method,
    });
  };

  try {
    if (route.kind === 'collection' && request.method === 'GET') {
      return await handleCollectionRead(request, ctx, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'GET') {
      return withMainserverContextBinding(
        await handleItemRead(request, route, ctx, logSuccess),
        ctx
      );
    }

    if (route.kind === 'collection' && request.method === 'POST') {
      return await handleCollectionCreate(request, ctx, workspaceContext.requestId, logSuccess);
    }

    if (route.kind === 'item' && request.method === 'PATCH') {
      return await handleItemUpdate(request, route, ctx, workspaceContext.requestId, logSuccess);
    }

    if (route.kind === 'itemVisibility' && request.method === 'PATCH') {
      return await handleVisibilityUpdate(
        request,
        route,
        ctx,
        workspaceContext.requestId,
        logSuccess
      );
    }

    if (route.kind === 'item' && request.method === 'DELETE') {
      return await handleItemDelete(request, route, ctx, workspaceContext.requestId, logSuccess);
    }

    return errorJson(
      405,
      'method_not_allowed',
      'Methode wird für Mainserver-News nicht unterstützt.'
    );
  } catch (error) {
    const logFailure = isUnexpectedMainserverError(error) ? logger.error : logger.warn;
    logFailure('Mainserver News route failed', {
      operation: 'mainserver_news_request',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: NEWS_CONTENT_TYPE,
      content_id:
        route.kind === 'item' || route.kind === 'itemVisibility' ? route.newsId : undefined,
      method: request.method,
      error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
    });
    return toMainserverErrorResponse(error, 'Mainserver-News-Anfrage ist fehlgeschlagen.');
  }
};

export const dispatchSvaMainserverNewsRequest = async (
  request: Request
): Promise<Response | null> => {
  const route = matchRoute(request);
  if (!route) {
    return null;
  }

  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, route, ctx));
};
