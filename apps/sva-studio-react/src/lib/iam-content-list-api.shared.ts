import type {
  ApiErrorCode,
  ApiErrorResponse,
  IamContentListQuery,
} from '@sva/core';

export const DEFAULT_MAINSERVER_VISIBLE_TYPES = [
  'news.article',
  'events.event-record',
  'poi.point-of-interest',
  'generic-items.generic-item',
  'faq.faq',
  'surveys.survey',
] as const;

const MAIN_SERVER_CONTENT_TYPES = new Set<string>(DEFAULT_MAINSERVER_VISIBLE_TYPES);
export const MAINSERVER_PROGRESSIVE_FETCH_PAGE_SIZE = 25;
export const EMPTY_VISIBLE_TYPE_SENTINEL = '__no_readable_content__';
export type MainserverContentType =
  | (typeof DEFAULT_MAINSERVER_VISIBLE_TYPES)[number];

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

export const isMainserverContentType = (value: string): value is MainserverContentType =>
  MAIN_SERVER_CONTENT_TYPES.has(value);

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
  const requestedVisibleTypes = url.searchParams
    .getAll('visibleType')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const visibleTypes = requestedVisibleTypes.filter((value) => value !== EMPTY_VISIBLE_TYPE_SENTINEL);
  const hasEmptyVisibleTypeSentinel = requestedVisibleTypes.includes(EMPTY_VISIBLE_TYPE_SENTINEL);

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
    ...(visibleTypes.length > 0
      ? { visibleTypes }
      : hasEmptyVisibleTypeSentinel
        ? { visibleTypes: [EMPTY_VISIBLE_TYPE_SENTINEL] }
        : {}),
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
