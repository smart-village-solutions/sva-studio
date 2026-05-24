import {
  iamContentListSortDirections,
  iamContentListSortFields,
  iamContentStatuses,
  type IamContentStatus,
  type IamContentListQuery,
} from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';

import { asApiItem, asApiList, createApiError, readPage, readPathSegment } from '../iam-account-management/api-helpers.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import {
  authorizeContentAction,
  resolveContentAccess,
  resolveContentActor,
  type ResolvedContentActor,
  withAuthenticatedContentHandler,
} from './request-context.js';
import { createContentResponse, deleteContentResponse, updateContentResponse } from './mutations.js';
import {
  loadContentById,
  loadContentDetail,
  loadContentHistory,
  loadContentListItems,
  loadContentListScopes,
} from './repository.js';

const logger = createSdkLogger({ component: 'iam-contents', level: 'info' });

const isServerAuthorizationError = (response: Response): boolean => response.status >= 500;

const isContentStatus = (value: string): value is IamContentStatus =>
  (iamContentStatuses as readonly string[]).includes(value);

const readContentListQuery = (request: Request): IamContentListQuery => {
  const url = new URL(request.url);
  const { page, pageSize } = readPage(request);
  const q = url.searchParams.get('q')?.trim() || undefined;
  const typeValue = url.searchParams.get('type')?.trim();
  const statusValue = url.searchParams.get('status')?.trim();
  const sortByValue = url.searchParams.get('sortBy')?.trim();
  const sortDirectionValue = url.searchParams.get('sortDirection')?.trim();
  const visibleTypes = url.searchParams
    .getAll('visibleType')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return {
    page,
    pageSize,
    ...(q ? { q } : {}),
    ...(typeValue && typeValue !== 'all' ? { type: typeValue } : {}),
    ...(statusValue && isContentStatus(statusValue)
      ? { status: statusValue }
      : {}),
    ...(visibleTypes.length > 0 ? { visibleTypes } : {}),
    sortBy:
      sortByValue && (iamContentListSortFields as readonly string[]).includes(sortByValue)
        ? (sortByValue as IamContentListQuery['sortBy'])
        : 'updatedAt',
    sortDirection:
      sortDirectionValue && (iamContentListSortDirections as readonly string[]).includes(sortDirectionValue)
        ? (sortDirectionValue as IamContentListQuery['sortDirection'])
        : 'desc',
  };
};

const authorizeReadableContentItem = (
  actor: ResolvedContentActor['actor'],
  item: {
    readonly id: string;
    readonly contentType: string;
    readonly organizationId?: string;
  }
) =>
  authorizeContentAction(actor, 'content.read', {
    contentId: item.id,
    contentType: item.contentType,
    organizationId: item.organizationId,
  });

const resolveReadableContentScopes = async (
  actor: ResolvedContentActor['actor'],
  scopes: readonly (string | null)[]
): Promise<{ readonly allowedOrganizationIds: readonly string[]; readonly includeUnscopedContent: boolean } | Response> => {
  const allowedOrganizationIds: string[] = [];
  let includeUnscopedContent = false;

  for (const scope of scopes) {
    const authorizationError = await authorizeContentAction(actor, 'content.read', {
      ...(scope ? { organizationId: scope } : {}),
    });

    if (!authorizationError) {
      if (scope) {
        allowedOrganizationIds.push(scope);
      } else {
        includeUnscopedContent = true;
      }
      continue;
    }

    if (isServerAuthorizationError(authorizationError)) {
      return authorizationError;
    }
  }

  return {
    allowedOrganizationIds,
    includeUnscopedContent,
  };
};

export const listContentsInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveContentActor(request, ctx);
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  try {
    const query = readContentListQuery(request);
    const scopes = await loadContentListScopes(actorResolution.actor.instanceId, query);
    const readableScopes = await resolveReadableContentScopes(actorResolution.actor, scopes);
    if (readableScopes instanceof Response) {
      return readableScopes;
    }

    const [{ items, total }, access] = await Promise.all([
      loadContentListItems(actorResolution.actor.instanceId, query, readableScopes),
      resolveContentAccess(actorResolution.actor),
    ]);
    const itemsWithAccess = items.map((item) => ({ ...item, access }));
    return new Response(
      JSON.stringify(
        asApiList(
          itemsWithAccess,
          { page: query.page, pageSize: query.pageSize, total },
          actorResolution.actor.requestId
        )
      ),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Content list query failed', {
      operation: 'content_list',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(
      503,
      'database_unavailable',
      'Inhalte konnten nicht geladen werden.',
      actorResolution.actor.requestId
    );
  }
};

export const getContentInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveContentActor(request, ctx);
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const contentId = readPathSegment(request, 4);
  if (!contentId) {
    return createApiError(400, 'invalid_request', 'Inhalts-ID fehlt.', actorResolution.actor.requestId);
  }

  try {
    const item = await loadContentById(actorResolution.actor.instanceId, contentId);
    if (!item) {
      return createApiError(404, 'not_found', 'Inhalt wurde nicht gefunden.', actorResolution.actor.requestId);
    }

    const authorizationError = await authorizeReadableContentItem(actorResolution.actor, item);
    if (authorizationError) {
      return authorizationError;
    }

    const [detail, access] = await Promise.all([
      loadContentDetail(actorResolution.actor.instanceId, contentId),
      resolveContentAccess(actorResolution.actor),
    ]);
    return detail
      ? new Response(JSON.stringify(asApiItem({ ...detail, access }, actorResolution.actor.requestId)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      : createApiError(404, 'not_found', 'Inhalt wurde nicht gefunden.', actorResolution.actor.requestId);
  } catch (error) {
    logger.error('Content detail query failed', {
      operation: 'content_detail',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      content_id: contentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(
      503,
      'database_unavailable',
      'Inhalt konnte nicht geladen werden.',
      actorResolution.actor.requestId
    );
  }
};

export const getContentHistoryInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveContentActor(request, ctx);
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const contentId = readPathSegment(request, 4);
  if (!contentId) {
    return createApiError(400, 'invalid_request', 'Inhalts-ID fehlt.', actorResolution.actor.requestId);
  }

  try {
    const item = await loadContentById(actorResolution.actor.instanceId, contentId);
    if (!item) {
      return createApiError(404, 'not_found', 'Inhalt wurde nicht gefunden.', actorResolution.actor.requestId);
    }

    const authorizationError = await authorizeContentAction(actorResolution.actor, 'content.readHistory', {
      contentId: item.id,
      contentType: item.contentType,
      organizationId: item.organizationId,
    });
    if (authorizationError) {
      return authorizationError;
    }

    const history = await loadContentHistory(actorResolution.actor.instanceId, contentId);
    const pageSize = Math.max(1, history.length);
    return new Response(
      JSON.stringify(asApiList(history, { page: 1, pageSize, total: history.length }, actorResolution.actor.requestId)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Content history query failed', {
      operation: 'content_history',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      content_id: contentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(
      503,
      'database_unavailable',
      'Historie konnte nicht geladen werden.',
      actorResolution.actor.requestId
    );
  }
};

export const createContentInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveContentActor(request, ctx, { requireActorAccountId: true });
  return 'error' in actorResolution ? actorResolution.error : createContentResponse(request, actorResolution.actor);
};

export const updateContentInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveContentActor(request, ctx, { requireActorAccountId: true });
  return 'error' in actorResolution ? actorResolution.error : updateContentResponse(request, actorResolution.actor);
};

export const deleteContentInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveContentActor(request, ctx, { requireActorAccountId: true });
  return 'error' in actorResolution ? actorResolution.error : deleteContentResponse(request, actorResolution.actor);
};

export const listContentsHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedContentHandler(request, listContentsInternal);

export const getContentHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedContentHandler(request, getContentInternal);

export const getContentHistoryHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedContentHandler(request, getContentHistoryInternal);

export const createContentHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedContentHandler(request, createContentInternal);

export const updateContentHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedContentHandler(request, updateContentInternal);

export const deleteContentHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedContentHandler(request, deleteContentInternal);
