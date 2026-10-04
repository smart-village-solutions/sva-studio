import {
  authorizeContentPrimitiveForUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import type { SvaMainserverConnectionInput } from '../types.js';
import { errorJson, isResponse, json } from './content-route-core.js';
import { MAINSERVER_ACTING_PRINCIPAL_HEADER } from './content-route-context.js';
import { parseMainserverListQuery } from './list-pagination.js';
import {
  resolveMainserverMutationActor,
  resolveMainserverResourceAccess,
  resolveMainserverResourceActor,
  type MainserverMutationActor,
} from './mutation-principal.js';
import { getSvaMainserverNews, listSvaMainserverNews } from './service.js';

export const NEWS_CONTENT_TYPE = 'news.article';
const logger = createSdkLogger({ component: 'sva-mainserver-news-route', level: 'info' });
export type RouteMatch =
  | { readonly kind: 'collection' }
  | { readonly kind: 'item'; readonly newsId: string }
  | { readonly kind: 'itemVisibility'; readonly newsId: string };

const normalizeVisibilityFilter = (value: string | null): 'all' | 'visible' | 'hidden' => {
  switch (value) {
    case 'visible':
    case 'hidden':
      return value;
    default:
      return 'all';
  }
};

const normalizeEditorialStatusFilter = (
  value: string | null
): 'all' | 'draft' | 'scheduled' | 'published' => {
  switch (value) {
    case 'draft':
    case 'scheduled':
    case 'published':
      return value;
    default:
      return 'all';
  }
};

const authorize = async (
  ctx: AuthenticatedRequestContext,
  action: string,
  newsId?: string,
  credentialVisibleRead = true
): Promise<ReturnType<typeof authorizeContentPrimitiveForUser>> =>
  authorizeContentPrimitiveForUser({
    ctx,
    action,
    resource: {
      contentType: NEWS_CONTENT_TYPE,
      ...(newsId ? { contentId: newsId } : {}),
    },
    credentialVisibleCompatibility:
      action !== 'news.read' || (Boolean(newsId) && credentialVisibleRead),
  });

export const authorizeOrResponse = async (
  ctx: AuthenticatedRequestContext,
  action: string,
  newsId?: string,
  credentialVisibleRead = true
): Promise<
  | {
      readonly instanceId: string;
      readonly keycloakSubject: string;
      readonly activeOrganizationId?: string;
    }
  | Response
> => {
  const result = await authorize(ctx, action, newsId, credentialVisibleRead);
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
    return errorJson(result.status, result.error, result.message, result.permissionDenial);
  }

  return {
    instanceId: result.actor.instanceId,
    keycloakSubject: result.actor.keycloakSubject,
    activeOrganizationId: result.actor.organizationId ?? ctx.activeOrganizationId,
  };
};

export const authorizeMutationOrResponse = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  action: 'news.create' | 'news.update' | 'news.delete',
  newsId?: string
): Promise<MainserverMutationActor | Response> => {
  const authorizedActor = await authorizeOrResponse(ctx, action, newsId);
  if (isResponse(authorizedActor)) {
    return authorizedActor;
  }
  return resolveMainserverMutationActor({ request, ctx, authorizedActor });
};

const listNewsForRequest = async (
  request: Request,
  actor: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
    readonly activeOrganizationId?: string;
  }
) => {
  const searchParams = new URL(request.url).searchParams;
  const includeInvisible = searchParams.get('includeInvisible') === 'true';
  const visibilityFilter = normalizeVisibilityFilter(searchParams.get('visibilityFilter'));
  const editorialStatusFilter = normalizeEditorialStatusFilter(
    searchParams.get('editorialStatusFilter')
  );

  return listSvaMainserverNews({
    ...actor,
    ...parseMainserverListQuery(request),
    includeInvisible,
    visibilityFilter,
    editorialStatusFilter,
  });
};

export const getNewsForRoute = async (
  route: Extract<RouteMatch, { kind: 'item' }>,
  actor: SvaMainserverConnectionInput
) => getSvaMainserverNews({ ...actor, newsId: route.newsId });

export const handleCollectionRead = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  logSuccess: (operation: string, newsId?: string) => void
) => {
  const actor = await authorizeOrResponse(ctx, 'news.read');
  if (isResponse(actor)) {
    return actor;
  }

  const data = await listNewsForRequest(request, actor);
  logSuccess('mainserver_news_list');
  return json(data);
};

export const handleItemRead = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'item' }>,
  ctx: AuthenticatedRequestContext,
  logSuccess: (operation: string, newsId?: string) => void
) => {
  const actor = await authorizeOrResponse(
    ctx,
    'news.read',
    route.newsId,
    request.headers.has(MAINSERVER_ACTING_PRINCIPAL_HEADER)
  );
  if (isResponse(actor)) {
    return actor;
  }

  const resourceActor = await resolveMainserverResourceActor({
    request,
    ctx,
    authorizedActor: actor,
  });
  const data = await getNewsForRoute(route, resourceActor ?? actor);
  const access = resourceActor
    ? await resolveMainserverResourceAccess({
        actor: resourceActor,
        actions: [
          'news.read',
          'news.update',
          'news.delete',
          'news.pushNotification',
          'content.publish',
          'content.changeStatus',
        ],
        contentType: NEWS_CONTENT_TYPE,
        item: data,
        forceExactScopeActions: ['news.read'],
      })
    : {};
  if (
    (resourceActor && !access['news.read']) ||
    (!resourceActor && request.headers.has(MAINSERVER_ACTING_PRINCIPAL_HEADER))
  ) {
    const exactRead = await authorizeOrResponse(ctx, 'news.read', route.newsId, false);
    if (isResponse(exactRead)) return exactRead;
  }
  logSuccess('mainserver_news_detail', route.newsId);
  return json(resourceActor ? { data, meta: { access } } : { data });
};
