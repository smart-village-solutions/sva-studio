import {
  iamContentListSortDirections,
  iamContentListSortFields,
  iamContentStatuses,
  isUuid,
  type IamContentStatus,
  type IamContentListQuery,
} from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';

import {
  asApiItem,
  asApiList,
  createApiError,
  readPage,
  readPathSegment,
} from '../iam-account-management/api-helpers.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import {
  authorizeContentAction,
  resolveContentAccess,
  resolveContentActor,
  withAuthenticatedContentHandler,
} from './request-context.js';
import {
  authorizeReadableContentItem,
  isServerAuthorizationError,
  resolveReadableContentScopes,
} from './read-authorization.js';
import {
  createContentResponse,
  deleteContentResponse,
  updateContentResponse,
} from './mutations.js';
import { loadExternalContentReferenceBySourceEntity } from './external-content-references.js';
import {
  loadContentById,
  loadContentHistory,
  loadContentListItems,
  loadContentListScopes,
} from './repository.js';
import { getContentInternal } from './detail.js';

export { getContentInternal } from './detail.js';

const logger = createSdkLogger({ component: 'iam-contents', level: 'info' });

const isContentStatus = (value: string): value is IamContentStatus =>
  (iamContentStatuses as readonly string[]).includes(value);

class InvalidContentListQueryError extends Error {}

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

  if (
    (sortByValue !== undefined &&
      !(iamContentListSortFields as readonly string[]).includes(sortByValue)) ||
    (sortDirectionValue !== undefined &&
      !(iamContentListSortDirections as readonly string[]).includes(sortDirectionValue))
  ) {
    throw new InvalidContentListQueryError();
  }

  return {
    page,
    pageSize,
    ...(q ? { q } : {}),
    ...(typeValue && typeValue !== 'all' ? { type: typeValue } : {}),
    ...(statusValue && isContentStatus(statusValue) ? { status: statusValue } : {}),
    ...(visibleTypes.length > 0 ? { visibleTypes } : {}),
    sortBy:
      sortByValue && (iamContentListSortFields as readonly string[]).includes(sortByValue)
        ? (sortByValue as IamContentListQuery['sortBy'])
        : 'updatedAt',
    sortDirection:
      sortDirectionValue &&
      (iamContentListSortDirections as readonly string[]).includes(sortDirectionValue)
        ? (sortDirectionValue as IamContentListQuery['sortDirection'])
        : 'desc',
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
    const readableScopes = await resolveReadableContentScopes(actorResolution.actor, scopes, query);
    if (readableScopes instanceof Response) {
      return readableScopes;
    }

    const [{ items, total }, access] = await Promise.all([
      loadContentListItems(actorResolution.actor.instanceId, query, readableScopes),
      resolveContentAccess(actorResolution.actor),
    ]);
    const authorizedItems = [];
    for (const item of items) {
      const authorizationError = await authorizeReadableContentItem(actorResolution.actor, item);
      if (!authorizationError) {
        authorizedItems.push(item);
        continue;
      }
      if (isServerAuthorizationError(authorizationError)) {
        return authorizationError;
      }
    }
    const itemsWithAccess = authorizedItems.map((item) => ({ ...item, access }));
    const deniedItemsOnPage = items.length - authorizedItems.length;
    const visibleTotal = deniedItemsOnPage > 0 ? Math.max(0, total - deniedItemsOnPage) : total;
    return new Response(
      JSON.stringify(
        asApiList(
          itemsWithAccess,
          { page: query.page, pageSize: query.pageSize, total: visibleTotal },
          actorResolution.actor.requestId
        )
      ),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    if (error instanceof InvalidContentListQueryError) {
      return createApiError(
        400,
        'invalid_request',
        'Ungültige Sortierparameter.',
        actorResolution.actor.requestId
      );
    }
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
    return createApiError(
      400,
      'invalid_request',
      'Inhalts-ID fehlt.',
      actorResolution.actor.requestId
    );
  }

  try {
    const requestedContentType = new URL(request.url).searchParams.get('contentType')?.trim();
    let item;
    if (requestedContentType) {
      const reference = await loadExternalContentReferenceBySourceEntity({
        instanceId: actorResolution.actor.instanceId,
        sourceSystem: 'mainserver',
        sourceEntityType: requestedContentType,
        sourceEntityId: contentId,
      });
      if (reference) {
        item = await loadContentById(actorResolution.actor.instanceId, reference.contentId);
      }
    }
    if (!item && (!requestedContentType || isUuid(contentId))) {
      item = await loadContentById(actorResolution.actor.instanceId, contentId);
    }
    if (!item) {
      return createApiError(
        404,
        'not_found',
        'Inhalt wurde nicht gefunden.',
        actorResolution.actor.requestId
      );
    }

    const authorizationError = await authorizeContentAction(
      actorResolution.actor,
      'content.readHistory',
      {
        contentId: item.id,
        contentType: item.contentType,
        organizationId: item.organizationId,
        ownerUserId: item.ownerUserId,
        ownerOrganizationId: item.ownerOrganizationId,
      }
    );
    if (authorizationError) {
      return authorizationError;
    }

    const history = await loadContentHistory(actorResolution.actor.instanceId, item.id);
    const pageSize = Math.max(1, history.length);
    return new Response(
      JSON.stringify(
        asApiList(
          history,
          { page: 1, pageSize, total: history.length },
          actorResolution.actor.requestId
        )
      ),
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
  return 'error' in actorResolution
    ? actorResolution.error
    : createContentResponse(request, actorResolution.actor);
};

export const updateContentInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveContentActor(request, ctx, { requireActorAccountId: true });
  return 'error' in actorResolution
    ? actorResolution.error
    : updateContentResponse(request, actorResolution.actor);
};

export const deleteContentInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveContentActor(request, ctx, { requireActorAccountId: true });
  return 'error' in actorResolution
    ? actorResolution.error
    : deleteContentResponse(request, actorResolution.actor);
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
