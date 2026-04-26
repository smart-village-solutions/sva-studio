import {
  authorizeContentPrimitiveForUser,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import type { IamContentPrimitiveAction } from '@sva/core';
import {
  createSvaMainserverNews,
  deleteSvaMainserverNews,
  getSvaMainserverNews,
  listSvaMainserverNews,
  updateSvaMainserverNews,
  SvaMainserverError,
} from '@sva/sva-mainserver/server';
import type { SvaMainserverNewsInput } from '@sva/sva-mainserver';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

const NEWS_CONTENT_TYPE = 'news.article';
const NEWS_COLLECTION_PATH = '/api/v1/mainserver/news';
const NEWS_ITEM_PATH_PREFIX = `${NEWS_COLLECTION_PATH}/`;
const logger = createSdkLogger({ component: 'sva-mainserver-news-route', level: 'info' });

type RouteMatch =
  | { readonly kind: 'collection' }
  | { readonly kind: 'item'; readonly newsId: string };

const json = (body: unknown, status = 200): Response =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });

const errorJson = (status: number, error: string, message: string): Response => json({ error, message }, status);

const matchRoute = (request: Request): RouteMatch | null => {
  const pathname = new URL(request.url).pathname;
  if (pathname === NEWS_COLLECTION_PATH) {
    return { kind: 'collection' };
  }
  if (pathname.startsWith(NEWS_ITEM_PATH_PREFIX)) {
    const newsId = decodeURIComponent(pathname.slice(NEWS_ITEM_PATH_PREFIX.length));
    if (newsId.length > 0 && newsId.includes('/') === false) {
      return { kind: 'item', newsId };
    }
  }
  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Array.isArray(value) === false;

const parseNewsInput = async (request: Request): Promise<SvaMainserverNewsInput | Response> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson(400, 'invalid_request', 'Request-Body muss gültiges JSON sein.');
  }

  if (!isRecord(body) || !isRecord(body.payload)) {
    return errorJson(400, 'invalid_request', 'News-Payload ist unvollständig.');
  }

  const payload = body.payload;
  if (
    typeof body.title !== 'string' ||
    body.title.trim().length === 0 ||
    typeof body.publishedAt !== 'string' ||
    body.publishedAt.trim().length === 0 ||
    typeof payload.teaser !== 'string' ||
    typeof payload.body !== 'string'
  ) {
    return errorJson(400, 'invalid_request', 'Titel, Veröffentlichungsdatum, Teaser und Inhalt sind erforderlich.');
  }

  return {
    title: body.title,
    publishedAt: body.publishedAt,
    payload: {
      teaser: payload.teaser,
      body: payload.body,
      ...(typeof payload.imageUrl === 'string' && payload.imageUrl.length > 0 ? { imageUrl: payload.imageUrl } : {}),
      ...(typeof payload.externalUrl === 'string' && payload.externalUrl.length > 0
        ? { externalUrl: payload.externalUrl }
        : {}),
      ...(typeof payload.category === 'string' && payload.category.length > 0 ? { category: payload.category } : {}),
    },
  };
};

const toMainserverErrorResponse = (error: unknown): Response => {
  if (error instanceof SvaMainserverError) {
    const status =
      error.statusCode ??
      ({
        missing_credentials: 400,
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

const authorize = async (
  ctx: AuthenticatedRequestContext,
  action: IamContentPrimitiveAction,
  newsId?: string
): Promise<ReturnType<typeof authorizeContentPrimitiveForUser>> =>
  authorizeContentPrimitiveForUser({
    ctx,
    action,
    resource: {
      contentType: NEWS_CONTENT_TYPE,
      ...(newsId ? { contentId: newsId } : {}),
    },
  });

const authorizeOrResponse = async (
  ctx: AuthenticatedRequestContext,
  action: IamContentPrimitiveAction,
  newsId?: string
): Promise<{ readonly instanceId: string; readonly keycloakSubject: string } | Response> => {
  const result = await authorize(ctx, action, newsId);
  if (!result.ok) {
    const workspaceContext = getWorkspaceContext();
    logger.warn('Mainserver News local authorization denied', {
      operation: 'mainserver_news_authorize',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: NEWS_CONTENT_TYPE,
      content_id: newsId,
      action,
      error_code: result.error,
    });
    return errorJson(result.status, result.error, result.message);
  }

  return {
    instanceId: result.actor.instanceId,
    keycloakSubject: result.actor.keycloakSubject,
  };
};

const dispatchAuthenticated = async (request: Request, route: RouteMatch, ctx: AuthenticatedRequestContext) => {
  const workspaceContext = getWorkspaceContext();
  const logSuccess = (operation: string, newsId?: string) => {
    logger.info('Mainserver News route succeeded', {
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
      const actor = await authorizeOrResponse(ctx, 'content.read');
      if (actor instanceof Response) {
        return actor;
      }
      const data = await listSvaMainserverNews(actor);
      logSuccess('mainserver_news_list');
      return json({ data });
    }

    if (route.kind === 'item' && request.method === 'GET') {
      const actor = await authorizeOrResponse(ctx, 'content.read', route.newsId);
      if (actor instanceof Response) {
        return actor;
      }
      const data = await getSvaMainserverNews({ ...actor, newsId: route.newsId });
      logSuccess('mainserver_news_detail', route.newsId);
      return json({ data });
    }

    if (route.kind === 'collection' && request.method === 'POST') {
      const parsed = await parseNewsInput(request);
      if (parsed instanceof Response) {
        return parsed;
      }
      const actor = await authorizeOrResponse(ctx, 'content.create');
      if (actor instanceof Response) {
        return actor;
      }
      const data = await createSvaMainserverNews({ ...actor, news: parsed });
      logSuccess('mainserver_news_create', data.id);
      return json({ data }, 201);
    }

    if (route.kind === 'item' && request.method === 'PATCH') {
      const parsed = await parseNewsInput(request);
      if (parsed instanceof Response) {
        return parsed;
      }

      const metadataActor = await authorizeOrResponse(ctx, 'content.updateMetadata', route.newsId);
      if (metadataActor instanceof Response) {
        return metadataActor;
      }
      const payloadActor = await authorizeOrResponse(ctx, 'content.updatePayload', route.newsId);
      if (payloadActor instanceof Response) {
        return payloadActor;
      }

      const data = await updateSvaMainserverNews({ ...metadataActor, newsId: route.newsId, news: parsed });
      logSuccess('mainserver_news_update', route.newsId);
      return json({ data });
    }

    if (route.kind === 'item' && request.method === 'DELETE') {
      const actor = await authorizeOrResponse(ctx, 'content.delete', route.newsId);
      if (actor instanceof Response) {
        return actor;
      }
      const data = await deleteSvaMainserverNews({ ...actor, newsId: route.newsId });
      logSuccess('mainserver_news_delete', route.newsId);
      return json({ data });
    }

    return errorJson(405, 'method_not_allowed', 'Methode wird für Mainserver-News nicht unterstützt.');
  } catch (error) {
    logger.warn('Mainserver News route failed', {
      operation: 'mainserver_news_request',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: NEWS_CONTENT_TYPE,
      content_id: route.kind === 'item' ? route.newsId : undefined,
      method: request.method,
      error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
    });
    return toMainserverErrorResponse(error);
  }
};

export const dispatchMainserverNewsRequest = async (request: Request): Promise<Response | null> => {
  const route = matchRoute(request);
  if (!route) {
    return null;
  }

  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, route, ctx));
};
