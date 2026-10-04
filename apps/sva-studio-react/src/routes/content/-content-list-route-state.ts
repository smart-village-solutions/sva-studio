import type { IamContentListQuery } from '@sva/core';
import { studioContentTypes } from '../../lib/plugins';
import { appAdminResources } from '../../routing/admin-resources';

type StatusFilter = 'all' | 'draft' | 'in_review' | 'approved' | 'published' | 'archived';
type SortDirection = 'asc' | 'desc';
type ContentListSortState = Readonly<{
  field: string;
  direction: SortDirection;
}>;
export type RouteSearchState = Readonly<Record<string, unknown>>;
export type ContentListRouteState = Readonly<{
  type: string;
  status: StatusFilter;
  page: number;
  pageSize: number;
  languageCode?: string;
  sort?: ContentListSortState;
}>;
type SortStateLike = Readonly<{
  field?: unknown;
  direction?: unknown;
}>;
const contentAdminResource = appAdminResources.find(
  (resource) => resource.resourceId === 'content'
);
const contentListCapabilities = contentAdminResource?.capabilities?.list;
export const contentPagination = contentListCapabilities?.pagination;
export const contentSorting = contentListCapabilities?.sorting;
const contentStatusOptions = [
  'all',
  'draft',
  'in_review',
  'approved',
  'published',
  'archived',
] as const satisfies readonly StatusFilter[];
const contentSortFields = ['title', 'createdAt', 'updatedAt', 'publishedAt'] as const;
const isStatusFilter = (value: unknown): value is StatusFilter =>
  typeof value === 'string' && contentStatusOptions.some((option) => option === value);

export const normalizeTypeFilter = (value: unknown): string => {
  if (typeof value !== 'string') {
    return 'all';
  }

  const normalizedValue = value.trim();
  if (normalizedValue.length === 0) {
    return 'all';
  }

  return normalizedValue === 'all' ||
    studioContentTypes.some((definition) => definition.contentType === normalizedValue)
    ? normalizedValue
    : 'all';
};

const asRouteSearchState = (value: unknown): RouteSearchState | undefined =>
  value && typeof value === 'object' ? (value as RouteSearchState) : undefined;

export const normalizeStatusFilter = (value: unknown): StatusFilter =>
  isStatusFilter(value) ? value : 'all';

export const normalizeLanguageFilter = (value: unknown): string | undefined =>
  typeof value === 'string' ? value.trim().toLowerCase() || undefined : undefined;

const normalizePositiveInteger = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
};

const normalizeSortState = (value: unknown): ContentListSortState | undefined => {
  const objectValue = asRouteSearchState(value) as SortStateLike | undefined;
  if (objectValue) {
    const field = typeof objectValue.field === 'string' ? objectValue.field : undefined;
    const direction = objectValue.direction;
    if (
      field &&
      contentSortFields.some((sortField) => sortField === field) &&
      (direction === 'asc' || direction === 'desc')
    ) {
      return { field, direction };
    }
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const normalized = value.startsWith('-')
      ? ({ field: value.slice(1), direction: 'desc' } as const)
      : ({ field: value, direction: 'asc' } as const);
    return contentSortFields.some((sortField) => sortField === normalized.field)
      ? normalized
      : undefined;
  }

  return undefined;
};

const resolveFallbackSortState = (): ContentListSortState | undefined =>
  contentSorting
    ? {
        field: contentSorting.defaultField,
        direction: contentSorting.defaultDirection,
      }
    : undefined;

const resolveRouteSortState = (search: RouteSearchState): ContentListSortState | undefined => {
  const sortFromExplicitParams =
    typeof search.sortBy === 'string'
      ? normalizeSortState({
          field: search.sortBy,
          direction: search.sortDirection,
        })
      : undefined;

  return (
    sortFromExplicitParams ?? normalizeSortState(search.sort) ?? normalizeSortState(search.sorting)
  );
};

export const readNormalizedRouteState = (search: RouteSearchState): ContentListRouteState => {
  const normalizedFilters = asRouteSearchState(search.filters);
  const pageSizeDefault = contentPagination?.defaultPageSize ?? 25;
  const type = normalizeTypeFilter(normalizedFilters?.type ?? search.type);
  const languageCode =
    type === 'faq.faq' ? normalizeLanguageFilter(search.languageCode) : undefined;

  return {
    type,
    status: normalizeStatusFilter(normalizedFilters?.status ?? search.status),
    page: normalizePositiveInteger(search.page, 1),
    pageSize: normalizePositiveInteger(search.pageSize, pageSizeDefault),
    ...(languageCode ? { languageCode } : {}),
    sort: resolveRouteSortState(search) ?? resolveFallbackSortState(),
  };
};

const serializeRouteState = (state: ContentListRouteState): RouteSearchState => ({
  ...(state.type !== 'all' ? { type: state.type } : {}),
  ...(state.type === 'faq.faq' && state.languageCode ? { languageCode: state.languageCode } : {}),
  ...(state.status !== 'all' ? { status: state.status } : {}),
  ...(state.sort ? { sortBy: state.sort.field, sortDirection: state.sort.direction } : {}),
  page: state.page,
  pageSize: state.pageSize,
});

export const updateRouteState = (
  current: RouteSearchState,
  next: Partial<ContentListRouteState>
): RouteSearchState => {
  const normalized = readNormalizedRouteState(current);
  return serializeRouteState({
    ...normalized,
    ...next,
  });
};

export const resolveContentSortField = (
  routeSortField: string | undefined
): IamContentListQuery['sortBy'] => {
  switch (routeSortField) {
    case 'title':
    case 'createdAt':
    case 'updatedAt':
    case 'publishedAt':
      return routeSortField;
    default:
      return 'updatedAt';
  }
};
