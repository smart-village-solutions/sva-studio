import type {
  AdminResourceDefinition,
  AdminResourceListFilterCapability,
  AdminResourceListPaginationCapability,
  AdminResourceListCapabilities,
} from '@sva/plugin-sdk';

export type AdminResourceListSortDirection = 'asc' | 'desc';

export type AdminResourceListSortState = Readonly<{
  field: string;
  direction: AdminResourceListSortDirection;
}>;

export type AdminResourceListSearchState = Readonly<{
  search?: string;
  filters: Readonly<Record<string, string>>;
  sort?: AdminResourceListSortState;
  page?: number;
  pageSize?: number;
}>;

const readSearchValue = (search: Readonly<Record<string, unknown>>, param: string): string | undefined => {
  const value = search[param];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
};

const readPositiveInteger = (
  search: Readonly<Record<string, unknown>>,
  param: string
): number | undefined => {
  const value = readSearchValue(search, param);
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 && String(parsed) === value ? parsed : undefined;
};

const normalizeSort = (
  capabilities: AdminResourceListCapabilities,
  search: Readonly<Record<string, unknown>>
): AdminResourceListSortState | undefined => {
  if (!capabilities.sorting) {
    return undefined;
  }

  const param = capabilities.sorting.param ?? 'sort';
  const declaredFields = new Set(capabilities.sorting.fields.map((field) => field.id));
  const rawSort = readSearchValue(search, param);
  if (!rawSort) {
    return {
      field: capabilities.sorting.defaultField,
      direction: capabilities.sorting.defaultDirection,
    };
  }

  const direction: AdminResourceListSortDirection = rawSort.startsWith('-') ? 'desc' : 'asc';
  const field = rawSort.startsWith('-') ? rawSort.slice(1) : rawSort;
  if (!declaredFields.has(field)) {
    return {
      field: capabilities.sorting.defaultField,
      direction: capabilities.sorting.defaultDirection,
    };
  }

  return { field, direction };
};

const normalizeFilter = (
  filter: AdminResourceListFilterCapability,
  search: Readonly<Record<string, unknown>>
): readonly [string, string] | undefined => {
  const param = filter.param ?? filter.id;
  const declaredValues = new Set(filter.options.map((option) => option.value));
  const value = readSearchValue(search, param);
  if (value && declaredValues.has(value)) {
    return [filter.id, value];
  }
  if (filter.defaultValue) {
    return [filter.id, filter.defaultValue];
  }
  return undefined;
};

const normalizeFilters = (
  capabilities: AdminResourceListCapabilities,
  search: Readonly<Record<string, unknown>>
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    (capabilities.filters ?? [])
      .map((filter) => normalizeFilter(filter, search))
      .filter((entry): entry is readonly [string, string] => entry !== undefined)
  );

const normalizePage = (
  pagination: AdminResourceListPaginationCapability | undefined,
  search: Readonly<Record<string, unknown>>
): number | undefined => {
  if (!pagination) {
    return undefined;
  }
  return readPositiveInteger(search, pagination.pageParam ?? 'page') ?? 1;
};

const normalizePageSize = (
  pagination: AdminResourceListPaginationCapability | undefined,
  search: Readonly<Record<string, unknown>>
): number | undefined => {
  if (!pagination) {
    return undefined;
  }
  const rawPageSize = readPositiveInteger(search, pagination.pageSizeParam ?? 'pageSize');
  return rawPageSize && pagination.pageSizeOptions.includes(rawPageSize)
    ? rawPageSize
    : pagination.defaultPageSize;
};

export const normalizeAdminResourceListSearch = (
  resource: AdminResourceDefinition,
  search: Readonly<Record<string, unknown>>
): AdminResourceListSearchState => {
  const capabilities = resource.capabilities?.list;
  if (!capabilities) {
    return { filters: {} };
  }

  return {
    search: capabilities.search ? readSearchValue(search, capabilities.search.param ?? 'q') : undefined,
    filters: normalizeFilters(capabilities, search),
    sort: normalizeSort(capabilities, search),
    page: normalizePage(capabilities.pagination, search),
    pageSize: normalizePageSize(capabilities.pagination, search),
  };
};
