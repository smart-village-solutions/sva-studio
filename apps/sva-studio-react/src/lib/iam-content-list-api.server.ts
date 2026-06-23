import type { ApiListResponse, IamContentListItem, IamContentListQuery } from '@sva/core';
import {
  authorizeContentPrimitiveForUser,
  type AuthenticatedRequestContext,
  withAuthenticatedUser,
} from '@sva/auth-runtime/server';
import {
  listSvaMainserverEvents,
  listSvaMainserverNews,
  listSvaMainserverPoi,
} from '@sva/sva-mainserver/server';
import { getWorkspaceContext } from '@sva/server-runtime';

import { listContentsHandler } from '@sva/auth-runtime/runtime-routes';
import {
  createListErrorResponse,
  createListResponse,
  createListSubrequest,
  filterItems,
  MAINSERVER_FETCH_PAGE_SIZE,
  normalizeApiErrorCode,
  paginateItems,
  partitionRequestedTypes,
  readContentListQuery,
  sortItems,
} from './iam-content-list-api.shared.js';
import { mapEventItem, mapNewsItem, mapPoiItem } from './iam-content-list-mainserver.js';

const readPermissionActions = (
  permissions: readonly Readonly<{
    readonly action: string;
    readonly effect?: 'allow' | 'deny';
  }>[]
): readonly string[] =>
  permissions
    .filter((permission) => permission.effect !== 'deny')
    .map((permission) => permission.action);

const fetchAllPages = async <TItem>(
  loadPage: (query: { readonly page: number; readonly pageSize: number }) => Promise<{
    readonly data: readonly TItem[];
    readonly pagination: { readonly hasNextPage: boolean };
  }>
): Promise<readonly TItem[]> => {
  const items: TItem[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await loadPage({ page, pageSize: MAINSERVER_FETCH_PAGE_SIZE });
    items.push(...response.data);
    hasNextPage = response.pagination.hasNextPage;
    page += 1;
  }

  return items;
};

const fetchAllLocalItems = async (
  request: Request,
  query: IamContentListQuery
): Promise<readonly IamContentListItem[] | Response> => {
  const items: IamContentListItem[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (items.length < total) {
    const response = await listContentsHandler(
      createListSubrequest(request, {
        ...query,
        page,
        pageSize: MAINSERVER_FETCH_PAGE_SIZE,
      })
    );

    if (!response.ok) {
      return response;
    }

    const payload = (await response.json()) as ApiListResponse<IamContentListItem>;
    items.push(...payload.data);
    total = payload.pagination.total;
    if (payload.data.length === 0) {
      break;
    }
    page += 1;
  }

  return items;
};

const loadMainserverItems = async (
  ctx: AuthenticatedRequestContext,
  mainserverTypes: readonly string[],
  permissionActions: readonly string[]
): Promise<readonly IamContentListItem[]> => {
  if (!ctx.user.instanceId) {
    return [];
  }

  const connection = {
    instanceId: ctx.user.instanceId,
    keycloakSubject: ctx.user.id,
  };

  const items = await Promise.all(
    mainserverTypes.map(async (contentType) => {
      if (contentType === 'news.article') {
        const news = await fetchAllPages((pageQuery) =>
          listSvaMainserverNews({
            ...connection,
            ...pageQuery,
          })
        );
        return news.map((item) => mapNewsItem(item, ctx.user.instanceId!, permissionActions));
      }

      if (contentType === 'events.event-record') {
        const events = await fetchAllPages((pageQuery) =>
          listSvaMainserverEvents({
            ...connection,
            ...pageQuery,
          })
        );
        return events.map((item) => mapEventItem(item, ctx.user.instanceId!, permissionActions));
      }

      if (contentType === 'poi.point-of-interest') {
        const poi = await fetchAllPages((pageQuery) =>
          listSvaMainserverPoi({
            ...connection,
            ...pageQuery,
          })
        );
        return poi.map((item) => mapPoiItem(item, ctx.user.instanceId!, permissionActions));
      }

      return [];
    })
  );

  return items.flat();
};

const filterAuthorizedItems = async (
  ctx: AuthenticatedRequestContext,
  items: readonly IamContentListItem[]
): Promise<readonly IamContentListItem[] | Response> => {
  const authorized: IamContentListItem[] = [];

  for (const item of items) {
    const authorization = await authorizeContentPrimitiveForUser({
      ctx,
      action: 'content.read',
      resource: {
        contentId: item.id,
        contentType: item.contentType,
        organizationId: item.organizationId,
        createdByAccountId: item.createdBy,
      },
    });

    if (authorization.ok) {
      authorized.push(item);
      continue;
    }

    if (authorization.status >= 500) {
      return createListErrorResponse(
        authorization.status,
        normalizeApiErrorCode(authorization.error),
        authorization.message
      );
    }
  }

  return authorized;
};

const handleMainserverContentList = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    const requestId = getWorkspaceContext().requestId;
    const query = readContentListQuery(request);
    const { localTypes, mainserverTypes } = partitionRequestedTypes(query);
    const authorization = await authorizeContentPrimitiveForUser({
      ctx,
      action: 'content.read',
    });

    if (!authorization.ok) {
      return createListErrorResponse(
        authorization.status,
        normalizeApiErrorCode(authorization.error),
        authorization.message,
        requestId
      );
    }

    try {
      const permissionActions = readPermissionActions(authorization.permissions);
      const localItemsResult =
        localTypes.length > 0
          ? await fetchAllLocalItems(request, {
              ...query,
              ...(query.type && localTypes.includes(query.type) ? { type: query.type } : {}),
              ...(localTypes.length > 0 ? { visibleTypes: localTypes } : {}),
            })
          : [];
      if (localItemsResult instanceof Response) {
        return localItemsResult;
      }

      const mainserverItems =
        query.status && query.status !== 'published'
          ? []
          : await loadMainserverItems(ctx, mainserverTypes, permissionActions);
      const authorizedMainserverItems = await filterAuthorizedItems(ctx, mainserverItems);
      if (authorizedMainserverItems instanceof Response) {
        return authorizedMainserverItems;
      }

      const combinedItems = [...localItemsResult, ...authorizedMainserverItems];
      const filteredItems = filterItems(combinedItems, query);
      const sortedItems = sortItems(filteredItems, query.sortBy, query.sortDirection);
      const paginatedItems = paginateItems(sortedItems, query.page, query.pageSize);
      return createListResponse(
        paginatedItems,
        {
          page: query.page,
          pageSize: query.pageSize,
          total: sortedItems.length,
        },
        requestId
      );
    } catch (error) {
      const code =
        error instanceof Error && 'code' in error && typeof error.code === 'string'
          ? normalizeApiErrorCode(error.code)
          : 'database_unavailable';
      const message =
        error instanceof Error && error.message.length > 0
          ? error.message
          : 'Inhalte konnten nicht geladen werden.';
      return createListErrorResponse(503, code, message, requestId);
    }
  });

export const dispatchAggregatedContentListRequest = async (request: Request): Promise<Response | null> => {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname !== '/api/v1/iam/contents') {
    return null;
  }

  const query = readContentListQuery(request);
  const { mainserverTypes } = partitionRequestedTypes(query);
  if (mainserverTypes.length === 0) {
    return listContentsHandler(request);
  }

  return handleMainserverContentList(request);
};
