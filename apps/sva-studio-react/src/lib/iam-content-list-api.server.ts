import type {
  ApiListResponse,
  EffectivePermission,
  IamContentListItem,
  IamContentListQuery,
} from '@sva/core';
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

const MAX_AGGREGATED_CONTENT_ITEMS = 5_000;

const buildMainserverReadAction = (contentType: string): string => {
  const namespace = contentType.split('.')[0]?.trim();
  return namespace ? `${namespace}.read` : 'content.read';
};

const fetchAllPages = async <TItem>(
  loadPage: (query: { readonly page: number; readonly pageSize: number }) => Promise<{
    readonly data: readonly TItem[];
    readonly pagination: { readonly hasNextPage: boolean; readonly page?: number };
  }>
): Promise<readonly TItem[]> => {
  const items: TItem[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage && items.length < MAX_AGGREGATED_CONTENT_ITEMS) {
    const response = await loadPage({ page, pageSize: MAINSERVER_FETCH_PAGE_SIZE });
    const remaining = MAX_AGGREGATED_CONTENT_ITEMS - items.length;
    items.push(...response.data.slice(0, remaining));
    hasNextPage = response.pagination.hasNextPage;
    const nextPage = response.pagination.page ?? page;
    if (response.data.length === 0 || nextPage < page) {
      break;
    }
    page = nextPage + 1;
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

  while (items.length < total && items.length < MAX_AGGREGATED_CONTENT_ITEMS) {
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
    const remaining = MAX_AGGREGATED_CONTENT_ITEMS - items.length;
    items.push(...payload.data.slice(0, remaining));
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
  permissions: readonly EffectivePermission[]
): Promise<readonly IamContentListItem[]> => {
  if (!ctx.user.instanceId) {
    return [];
  }

  const connection = {
    instanceId: ctx.user.instanceId,
    keycloakSubject: ctx.user.id,
    activeOrganizationId: ctx.activeOrganizationId,
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
        return news.map((item) => mapNewsItem(item, ctx.user.instanceId!, permissions));
      }

      if (contentType === 'events.event-record') {
        const events = await fetchAllPages((pageQuery) =>
          listSvaMainserverEvents({
            ...connection,
            ...pageQuery,
          })
        );
        return events.map((item) => mapEventItem(item, ctx.user.instanceId!, permissions));
      }

      if (contentType === 'poi.point-of-interest') {
        const poi = await fetchAllPages((pageQuery) =>
          listSvaMainserverPoi({
            ...connection,
            ...pageQuery,
          })
        );
        return poi.map((item) => mapPoiItem(item, ctx.user.instanceId!, permissions));
      }

      return [];
    })
  );

  return items.flat();
};

const filterAuthorizedItems = async (
  ctx: AuthenticatedRequestContext,
  items: readonly IamContentListItem[],
  permissions: readonly EffectivePermission[]
): Promise<readonly IamContentListItem[] | Response> => {
  const authorizationResults = await Promise.all(
    items.map(async (item) => ({
      item,
      authorization: await authorizeContentPrimitiveForUser({
        ctx,
        action: buildMainserverReadAction(item.contentType),
        resource: {
          contentId: item.id,
          contentType: item.contentType,
          organizationId: item.organizationId,
        },
        permissions,
      }),
    }))
  );

  for (const { authorization } of authorizationResults) {
    if (!authorization.ok && authorization.status >= 500) {
      return createListErrorResponse(
        authorization.status,
        normalizeApiErrorCode(authorization.error),
        authorization.message
      );
    }
  }

  return authorizationResults
    .filter((result) => result.authorization.ok)
    .map((result) => result.item);
};

const authorizeMainserverTypes = async (
  ctx: AuthenticatedRequestContext,
  mainserverTypes: readonly string[],
  requestId?: string
): Promise<
  | {
      readonly allowedTypes: readonly string[];
      readonly permissions: readonly EffectivePermission[];
    }
  | Response
> => {
  const allowedTypes: string[] = [];
  let permissions: readonly EffectivePermission[] | undefined;

  for (const contentType of mainserverTypes) {
    const authorization = await authorizeContentPrimitiveForUser({
      ctx,
      action: buildMainserverReadAction(contentType),
    });

    if (authorization.ok) {
      allowedTypes.push(contentType);
      permissions ??= authorization.permissions;
      continue;
    }

    if (authorization.status >= 500) {
      return createListErrorResponse(
        authorization.status,
        normalizeApiErrorCode(authorization.error),
        authorization.message,
        requestId
      );
    }
  }

  if (allowedTypes.length === 0 || !permissions) {
    return createListErrorResponse(403, 'forbidden', 'Keine Berechtigung für diese Inhalte.', requestId);
  }

  return {
    allowedTypes,
    permissions,
  };
};

const handleMainserverContentList = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    const requestId = getWorkspaceContext().requestId;
    const query = readContentListQuery(request);
    const { localTypes, mainserverTypes } = partitionRequestedTypes(query);
    const mainserverAuthorization =
      mainserverTypes.length > 0 ? await authorizeMainserverTypes(ctx, mainserverTypes, requestId) : null;
    if (mainserverAuthorization instanceof Response) {
      return mainserverAuthorization;
    }

    let permissions = mainserverAuthorization?.permissions;
    if (localTypes.length > 0) {
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

      permissions ??= authorization.permissions;
    }

    try {
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
          : await loadMainserverItems(ctx, mainserverAuthorization?.allowedTypes ?? [], permissions ?? []);
      const authorizedMainserverItems = await filterAuthorizedItems(ctx, mainserverItems, permissions ?? []);
      if (authorizedMainserverItems instanceof Response) {
        return authorizedMainserverItems;
      }

      const filteredMainserverItems = filterItems(authorizedMainserverItems, query);
      const combinedItems = [...localItemsResult, ...filteredMainserverItems];
      const sortedItems = sortItems(combinedItems, query.sortBy, query.sortDirection);
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
      return createListErrorResponse(503, code, 'Inhalte konnten nicht geladen werden.', requestId);
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
