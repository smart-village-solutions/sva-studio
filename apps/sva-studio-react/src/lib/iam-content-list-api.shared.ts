import type {
  ApiErrorCode,
  ApiErrorResponse,
  ApiListResponse,
  ApiPagination,
  IamContentListItem,
  IamContentListQuery,
} from '@sva/core';

const MAIN_SERVER_CONTENT_TYPES = new Set([
  'news.article',
  'events.event-record',
  'poi.point-of-interest',
]);

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

export const MAINSERVER_FETCH_PAGE_SIZE = 100;
const MAX_CONTENT_LIST_PAGE_SIZE = 100;

export const isMainserverContentType = (value: string): boolean => MAIN_SERVER_CONTENT_TYPES.has(value);

export const normalizeApiErrorCode = (value: unknown): ApiErrorCode =>
  typeof value === 'string' && API_ERROR_CODES.has(value as ApiErrorCode)
    ? (value as ApiErrorCode)
    : 'internal_error';

export const readContentListQuery = (request: Request): IamContentListQuery => {
  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(
    MAX_CONTENT_LIST_PAGE_SIZE,
    Math.max(1, Number.parseInt(url.searchParams.get('pageSize') ?? '25', 10) || 25)
  );
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

export const partitionRequestedTypes = (query: IamContentListQuery): {
  readonly localTypes: readonly string[];
  readonly mainserverTypes: readonly string[];
} => {
  const requestedTypes = query.type ? [query.type] : (query.visibleTypes ?? []);
  return {
    mainserverTypes: requestedTypes.filter(isMainserverContentType),
    localTypes: requestedTypes.filter((value) => !isMainserverContentType(value)),
  };
};

export const filterItems = (
  items: readonly IamContentListItem[],
  query: IamContentListQuery
): readonly IamContentListItem[] => {
  const normalizedSearch = query.q?.trim().toLowerCase();

  return items.filter((item) => {
    if (query.type && item.contentType !== query.type) {
      return false;
    }
    if (query.status && item.status !== query.status) {
      return false;
    }
    if (normalizedSearch) {
      const searchableText = [item.title, item.contentType, item.author, JSON.stringify(item.payload)]
        .join(' ')
        .toLowerCase();
      if (!searchableText.includes(normalizedSearch)) {
        return false;
      }
    }
    return true;
  });
};

export const sortItems = (
  items: readonly IamContentListItem[],
  sortBy: IamContentListQuery['sortBy'],
  sortDirection: IamContentListQuery['sortDirection']
): readonly IamContentListItem[] => {
  const direction = sortDirection === 'asc' ? 1 : -1;
  const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });

  return [...items].sort((left, right) => {
    const result =
      sortBy === 'contentType'
        ? collator.compare(left.contentType, right.contentType)
        : sortBy === 'title'
          ? collator.compare(left.title, right.title)
          : sortBy === 'status'
            ? collator.compare(left.status, right.status)
            : collator.compare(left.updatedAt, right.updatedAt);
    if (result !== 0) {
      return result * direction;
    }
    return collator.compare(left.id, right.id) * direction;
  });
};

export const paginateItems = (
  items: readonly IamContentListItem[],
  page: number,
  pageSize: number
): readonly IamContentListItem[] => {
  const offset = Math.max(0, (page - 1) * pageSize);
  return items.slice(offset, offset + pageSize);
};

export const createListErrorResponse = (
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

export const createListResponse = (
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

export const createListSubrequest = (request: Request, query: IamContentListQuery): Request => {
  const url = new URL(request.url);
  url.search = '';
  url.searchParams.set('page', String(query.page));
  url.searchParams.set('pageSize', String(query.pageSize));

  if (query.q) {
    url.searchParams.set('q', query.q);
  }
  if (query.type) {
    url.searchParams.set('type', query.type);
  }
  if (query.status) {
    url.searchParams.set('status', query.status);
  }
  if (query.sortBy) {
    url.searchParams.set('sortBy', query.sortBy);
  }
  if (query.sortDirection) {
    url.searchParams.set('sortDirection', query.sortDirection);
  }
  for (const visibleType of query.visibleTypes ?? []) {
    url.searchParams.append('visibleType', visibleType);
  }

  return new Request(url.toString(), {
    method: 'GET',
    headers: request.headers,
  });
};
