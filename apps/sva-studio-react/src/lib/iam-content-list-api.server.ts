import type {
  ApiErrorCode,
  ApiErrorResponse,
  ApiListResponse,
  ApiPagination,
  ContentJsonValue,
  IamContentAccessSummary,
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
import type {
  SvaMainserverEventItem,
  SvaMainserverNewsItem,
  SvaMainserverPoiItem,
} from '@sva/sva-mainserver';
import { getWorkspaceContext } from '@sva/server-runtime';

import { listContentsHandler } from '@sva/auth-runtime/runtime-routes';

const MAIN_SERVER_CONTENT_TYPES = new Set([
  'news.article',
  'events.event-record',
  'poi.point-of-interest',
]);
const MAINSERVER_FETCH_PAGE_SIZE = 100;
const API_ERROR_CODES = new Set<ApiErrorCode>([
  'unauthorized',
  'forbidden',
  'not_found',
  'invalid_request',
  'invalid_instance_id',
  'invalid_organization_id',
  'organization_inactive',
  'rate_limited',
  'csrf_validation_failed',
  'idempotency_key_required',
  'idempotency_key_reuse',
  'idempotency_in_progress',
  'keycloak_unavailable',
  'tenant_auth_client_secret_missing',
  'tenant_admin_client_not_configured',
  'tenant_admin_client_secret_missing',
  'encryption_not_configured',
  'database_unavailable',
  'last_admin_protection',
  'self_protection',
  'feature_disabled',
  'conflict',
  'legal_acceptance_required',
  'reauth_required',
  'internal_error',
]);

const isMainserverContentType = (value: string): boolean => MAIN_SERVER_CONTENT_TYPES.has(value);
const normalizeApiErrorCode = (value: unknown): ApiErrorCode =>
  typeof value === 'string' && API_ERROR_CODES.has(value as ApiErrorCode)
    ? (value as ApiErrorCode)
    : 'internal_error';

const readContentListQuery = (request: Request): IamContentListQuery => {
  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.max(1, Number.parseInt(url.searchParams.get('pageSize') ?? '25', 10) || 25);
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
    ...(statusValue === 'draft' ||
    statusValue === 'in_review' ||
    statusValue === 'approved' ||
    statusValue === 'published' ||
    statusValue === 'archived'
      ? { status: statusValue }
      : {}),
    ...(visibleTypes.length > 0 ? { visibleTypes } : {}),
    sortBy:
      sortByValue === 'title' ||
      sortByValue === 'contentType' ||
      sortByValue === 'status' ||
      sortByValue === 'updatedAt'
        ? sortByValue
        : 'updatedAt',
    sortDirection: sortDirectionValue === 'asc' || sortDirectionValue === 'desc' ? sortDirectionValue : 'desc',
  };
};

const shouldHandleMainserverContentList = (query: IamContentListQuery): boolean => {
  const visibleTypes = query.visibleTypes ?? [];
  return visibleTypes.length > 0 && visibleTypes.every(isMainserverContentType);
};

const readPermissionActions = (
  permissions: readonly Readonly<{
    readonly action: string;
    readonly effect?: 'allow' | 'deny';
  }>[]
): readonly string[] =>
  permissions
    .filter((permission) => permission.effect !== 'deny')
    .map((permission) => permission.action);

const deriveUpdateAction = (contentType: string): string | null => {
  const namespace = contentType.split('.')[0]?.trim();
  return namespace ? `${namespace}.update` : null;
};

const deriveCreateAction = (contentType: string): string | null => {
  const namespace = contentType.split('.')[0]?.trim();
  return namespace ? `${namespace}.create` : null;
};

const createMainserverItemAccess = (
  contentType: string,
  permissionActions: readonly string[]
): IamContentAccessSummary => {
  const updateAction = deriveUpdateAction(contentType);
  const createAction = deriveCreateAction(contentType);
  const canUpdate = updateAction ? permissionActions.includes(updateAction) : false;
  const canCreate = createAction ? permissionActions.includes(createAction) : false;

  return canUpdate
    ? {
        state: 'editable',
        canRead: true,
        canCreate,
        canUpdate: true,
        organizationIds: [],
        sourceKinds: [],
      }
    : {
        state: 'read_only',
        canRead: true,
        canCreate,
        canUpdate: false,
        reasonCode: 'content_update_missing',
        organizationIds: [],
        sourceKinds: [],
      };
};

const toContentJsonValue = (value: unknown): ContentJsonValue =>
  JSON.parse(JSON.stringify(value ?? null)) as ContentJsonValue;

const normalizeTitle = (value: string | undefined, fallback: string): string => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
};

const resolveNewsTitle = (item: SvaMainserverNewsItem): string =>
  normalizeTitle(item.title, normalizeTitle(item.contentBlocks?.[0]?.title, item.id));

const mapNewsItem = (
  item: SvaMainserverNewsItem,
  instanceId: string,
  permissionActions: readonly string[]
): IamContentListItem => ({
  id: item.id,
  instanceId,
  contentType: item.contentType,
  title: resolveNewsTitle(item),
  createdAt: item.createdAt,
  createdBy: item.author,
  updatedAt: item.updatedAt,
  updatedBy: item.author,
  author: item.author,
  payload: toContentJsonValue(item.payload),
  status: 'published',
  validationState: 'valid',
  historyRef: `mainserver:news:${item.id}`,
  publishedAt: item.publishedAt,
  access: createMainserverItemAccess(item.contentType, permissionActions),
});

const mapEventItem = (
  item: SvaMainserverEventItem,
  instanceId: string,
  permissionActions: readonly string[]
): IamContentListItem => ({
  id: item.id,
  instanceId,
  contentType: item.contentType,
  title: normalizeTitle(item.title, item.id),
  createdAt: item.createdAt,
  createdBy: 'mainserver',
  updatedAt: item.updatedAt,
  updatedBy: 'mainserver',
  author: 'mainserver',
  payload: toContentJsonValue({
    description: item.description,
    categoryName: item.categoryName,
    dates: item.dates,
    addresses: item.addresses,
    contacts: item.contacts,
    urls: item.urls,
    tags: item.tags,
  }),
  status: 'published',
  validationState: 'valid',
  historyRef: `mainserver:events:${item.id}`,
  access: createMainserverItemAccess(item.contentType, permissionActions),
});

const mapPoiItem = (
  item: SvaMainserverPoiItem,
  instanceId: string,
  permissionActions: readonly string[]
): IamContentListItem => ({
  id: item.id,
  instanceId,
  contentType: item.contentType,
  title: normalizeTitle(item.name, item.id),
  createdAt: item.createdAt,
  createdBy: 'mainserver',
  updatedAt: item.updatedAt,
  updatedBy: 'mainserver',
  author: 'mainserver',
  payload: toContentJsonValue({
    description: item.description,
    mobileDescription: item.mobileDescription,
    active: item.active,
    categoryName: item.categoryName,
    payload: item.payload,
    addresses: item.addresses,
    contact: item.contact,
    openingHours: item.openingHours,
    webUrls: item.webUrls,
    tags: item.tags,
  }),
  status: 'published',
  validationState: 'valid',
  historyRef: `mainserver:poi:${item.id}`,
  access: createMainserverItemAccess(item.contentType, permissionActions),
});

const toSearchableText = (item: IamContentListItem): string =>
  [item.title, item.contentType, item.author, JSON.stringify(item.payload)]
    .join(' ')
    .toLowerCase();

const filterItems = (items: readonly IamContentListItem[], query: IamContentListQuery): readonly IamContentListItem[] => {
  const normalizedSearch = query.q?.trim().toLowerCase();

  return items.filter((item) => {
    if (query.type && item.contentType !== query.type) {
      return false;
    }
    if (query.status && item.status !== query.status) {
      return false;
    }
    if (normalizedSearch && !toSearchableText(item).includes(normalizedSearch)) {
      return false;
    }
    return true;
  });
};

const compareItemsBySortField = (
  left: IamContentListItem,
  right: IamContentListItem,
  sortBy: IamContentListQuery['sortBy'],
  collator: Intl.Collator
): number => {
  switch (sortBy) {
    case 'contentType':
      return collator.compare(left.contentType, right.contentType);
    case 'title':
      return collator.compare(left.title, right.title);
    case 'status':
      return collator.compare(left.status, right.status);
    default:
      return collator.compare(left.updatedAt, right.updatedAt);
  }
};

const sortItems = (
  items: readonly IamContentListItem[],
  sortBy: IamContentListQuery['sortBy'],
  sortDirection: IamContentListQuery['sortDirection']
): readonly IamContentListItem[] => {
  const direction = sortDirection === 'asc' ? 1 : -1;
  const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });

  return [...items].sort((left, right) => {
    const result = compareItemsBySortField(left, right, sortBy, collator);
    if (result !== 0) {
      return result * direction;
    }
    return collator.compare(left.id, right.id) * direction;
  });
};

const paginateItems = (items: readonly IamContentListItem[], page: number, pageSize: number): readonly IamContentListItem[] => {
  const offset = Math.max(0, (page - 1) * pageSize);
  return items.slice(offset, offset + pageSize);
};

const createListErrorResponse = (
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId?: string
): Response =>
  new Response(
    JSON.stringify({
      error: {
        code,
        message,
      },
      ...(requestId ? { requestId } : {}),
    } satisfies ApiErrorResponse),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );

const createListResponse = (
  items: readonly IamContentListItem[],
  pagination: ApiPagination,
  requestId?: string
): Response =>
  new Response(
    JSON.stringify({
      data: items,
      pagination,
      ...(requestId ? { requestId } : {}),
    } satisfies ApiListResponse<IamContentListItem>),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );

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

const loadMainserverItems = async (
  ctx: AuthenticatedRequestContext,
  query: IamContentListQuery,
  permissionActions: readonly string[]
): Promise<readonly IamContentListItem[]> => {
  if (!ctx.user.instanceId) {
    return [];
  }

  const visibleTypes = query.visibleTypes ?? [];
  const requestedTypes = query.type ? [query.type] : visibleTypes;

  if (query.status && query.status !== 'published') {
    return [];
  }

  const connection = {
    instanceId: ctx.user.instanceId,
    keycloakSubject: ctx.user.id,
  };

  const items = await Promise.all(
    requestedTypes.map(async (contentType) => {
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
      const loadedItems = await loadMainserverItems(ctx, query, permissionActions);
      const authorizedItems = await filterAuthorizedItems(ctx, loadedItems);
      if (authorizedItems instanceof Response) {
        return authorizedItems;
      }

      const filteredItems = filterItems(authorizedItems, query);
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
  if (!shouldHandleMainserverContentList(query)) {
    return listContentsHandler(request);
  }

  return handleMainserverContentList(request);
};
