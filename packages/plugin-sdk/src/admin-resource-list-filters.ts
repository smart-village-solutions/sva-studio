import type {
  AdminResourceListSearchCapability,
  AdminResourceListFilterCapability,
  AdminResourceListSortingCapability,
  AdminResourceListPaginationCapability,
} from './admin-resource-list-contracts.js';
import {
  assertAllowedCapabilityKeys,
  assertUniqueValues,
  normalizeBindingKey,
  normalizeCapabilityId,
  normalizeLabelKey,
  normalizeSearchParamName,
} from './admin-resource-validation-shared.js';

const adminResourcePaginationCapabilityAllowedKeys = new Set([
  'pageParam',
  'pageSizeParam',
  'defaultPageSize',
  'pageSizeOptions',
] as const);

const adminResourceSearchCapabilityAllowedKeys = new Set([
  'param',
  'placeholderKey',
  'fields',
] as const);
const adminResourceFilterCapabilityAllowedKeys = new Set([
  'id',
  'param',
  'labelKey',
  'bindingKey',
  'options',
  'defaultValue',
] as const);
const adminResourceFilterOptionAllowedKeys = new Set(['value', 'labelKey'] as const);
const adminResourceSortingCapabilityAllowedKeys = new Set([
  'param',
  'defaultField',
  'defaultDirection',
  'fields',
] as const);
const adminResourceSortingFieldAllowedKeys = new Set(['id', 'labelKey', 'bindingKey'] as const);
export const normalizeSearchCapability = (
  resourceId: string,
  search: AdminResourceListSearchCapability
): AdminResourceListSearchCapability => {
  assertAllowedCapabilityKeys(
    resourceId,
    `${resourceId}.capabilities.list.search`,
    search,
    adminResourceSearchCapabilityAllowedKeys
  );

  const fields = search.fields.map((field) =>
    normalizeCapabilityId(resourceId, 'capabilities.list.search.fields', field)
  );
  if (fields.length === 0) {
    throw new Error(
      `invalid_admin_resource_capability:${resourceId}:capabilities.list.search.fields`
    );
  }

  assertUniqueValues(resourceId, 'duplicate_admin_resource_search_field', fields);

  return {
    param: normalizeSearchParamName(
      resourceId,
      'capabilities.list.search.param',
      search.param ?? 'q'
    ),
    placeholderKey: normalizeLabelKey(
      resourceId,
      'capabilities.list.search.placeholderKey',
      search.placeholderKey
    ),
    fields,
  };
};

export const normalizeFilterCapability = (
  resourceId: string,
  filter: AdminResourceListFilterCapability
): AdminResourceListFilterCapability => {
  assertAllowedCapabilityKeys(
    resourceId,
    `${resourceId}.capabilities.list.filters`,
    filter,
    adminResourceFilterCapabilityAllowedKeys
  );

  const id = normalizeCapabilityId(resourceId, 'capabilities.list.filters.id', filter.id);
  const options = filter.options.map((option) => {
    assertAllowedCapabilityKeys(
      resourceId,
      `${resourceId}.capabilities.list.filters.${id}.options`,
      option,
      adminResourceFilterOptionAllowedKeys
    );
    return {
      value: normalizeCapabilityId(
        resourceId,
        `capabilities.list.filters.${id}.options.value`,
        option.value
      ),
      labelKey: normalizeLabelKey(
        resourceId,
        `capabilities.list.filters.${id}.options.labelKey`,
        option.labelKey
      ),
    };
  });

  if (options.length === 0) {
    throw new Error(
      `invalid_admin_resource_capability:${resourceId}:capabilities.list.filters.${id}.options`
    );
  }

  assertUniqueValues(
    resourceId,
    'duplicate_admin_resource_filter_option',
    options.map((option) => option.value)
  );

  const defaultValue = filter.defaultValue
    ? normalizeCapabilityId(
        resourceId,
        `capabilities.list.filters.${id}.defaultValue`,
        filter.defaultValue
      )
    : undefined;
  if (defaultValue && options.some((option) => option.value === defaultValue) === false) {
    throw new Error(`invalid_admin_resource_filter_default:${resourceId}:${id}:${defaultValue}`);
  }

  return {
    id,
    param: normalizeSearchParamName(
      resourceId,
      `capabilities.list.filters.${id}.param`,
      filter.param ?? id
    ),
    labelKey: normalizeLabelKey(
      resourceId,
      `capabilities.list.filters.${id}.labelKey`,
      filter.labelKey
    ),
    bindingKey: normalizeBindingKey(
      resourceId,
      `capabilities.list.filters.${id}.bindingKey`,
      filter.bindingKey
    ),
    options,
    defaultValue,
  };
};

export const normalizeSortingCapability = (
  resourceId: string,
  sorting: AdminResourceListSortingCapability
): AdminResourceListSortingCapability => {
  assertAllowedCapabilityKeys(
    resourceId,
    `${resourceId}.capabilities.list.sorting`,
    sorting,
    adminResourceSortingCapabilityAllowedKeys
  );

  const fields = sorting.fields.map((field) => {
    assertAllowedCapabilityKeys(
      resourceId,
      `${resourceId}.capabilities.list.sorting.fields`,
      field,
      adminResourceSortingFieldAllowedKeys
    );
    return {
      id: normalizeCapabilityId(resourceId, 'capabilities.list.sorting.fields.id', field.id),
      labelKey: normalizeLabelKey(
        resourceId,
        'capabilities.list.sorting.fields.labelKey',
        field.labelKey
      ),
      bindingKey: normalizeBindingKey(
        resourceId,
        'capabilities.list.sorting.fields.bindingKey',
        field.bindingKey
      ),
    };
  });

  if (fields.length === 0) {
    throw new Error(
      `invalid_admin_resource_capability:${resourceId}:capabilities.list.sorting.fields`
    );
  }

  assertUniqueValues(
    resourceId,
    'duplicate_admin_resource_sort_field',
    fields.map((field) => field.id)
  );

  const defaultField = normalizeCapabilityId(
    resourceId,
    'capabilities.list.sorting.defaultField',
    sorting.defaultField
  );
  if (fields.some((field) => field.id === defaultField) === false) {
    throw new Error(`invalid_admin_resource_sort_default:${resourceId}:${defaultField}`);
  }
  if (sorting.defaultDirection !== 'asc' && sorting.defaultDirection !== 'desc') {
    throw new Error(
      `invalid_admin_resource_sort_direction:${resourceId}:${sorting.defaultDirection}`
    );
  }

  return {
    param: normalizeSearchParamName(
      resourceId,
      'capabilities.list.sorting.param',
      sorting.param ?? 'sort'
    ),
    defaultField,
    defaultDirection: sorting.defaultDirection,
    fields,
  };
};

export const normalizePaginationCapability = (
  resourceId: string,
  pagination: AdminResourceListPaginationCapability
): AdminResourceListPaginationCapability => {
  assertAllowedCapabilityKeys(
    resourceId,
    `${resourceId}.capabilities.list.pagination`,
    pagination,
    adminResourcePaginationCapabilityAllowedKeys
  );

  const pageSizeOptions = [...pagination.pageSizeOptions];
  if (
    pagination.defaultPageSize < 1 ||
    pageSizeOptions.length === 0 ||
    pageSizeOptions.some((option) => option < 1 || Number.isInteger(option) === false)
  ) {
    throw new Error(`invalid_admin_resource_pagination:${resourceId}`);
  }

  assertUniqueValues(resourceId, 'duplicate_admin_resource_page_size', pageSizeOptions.map(String));
  if (!pageSizeOptions.includes(pagination.defaultPageSize)) {
    throw new Error(
      `invalid_admin_resource_pagination_default:${resourceId}:${pagination.defaultPageSize}`
    );
  }

  return {
    pageParam: normalizeSearchParamName(
      resourceId,
      'capabilities.list.pagination.pageParam',
      pagination.pageParam ?? 'page'
    ),
    pageSizeParam: normalizeSearchParamName(
      resourceId,
      'capabilities.list.pagination.pageSizeParam',
      pagination.pageSizeParam ?? 'pageSize'
    ),
    defaultPageSize: pagination.defaultPageSize,
    pageSizeOptions,
  };
};
