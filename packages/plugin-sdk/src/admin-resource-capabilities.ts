import type {
  AdminResourceBulkActionSelectionMode,
  AdminResourceListBulkActionCapability,
  AdminResourceListCapabilities,
} from './admin-resource-list-contracts.js';
import type {
  AdminResourceCapabilities,
  AdminResourceDetailCapabilities,
} from './admin-resource-contracts.js';
import {
  assertAllowedCapabilityKeys,
  assertUniqueValues,
  normalizeActionId,
  normalizeBindingKey,
  normalizeCapabilityId,
  normalizeLabelKey,
} from './admin-resource-validation-shared.js';
import {
  normalizeSearchCapability,
  normalizeFilterCapability,
  normalizeSortingCapability,
  normalizePaginationCapability,
} from './admin-resource-list-filters.js';

const adminResourceCapabilitiesAllowedKeys = new Set(['list', 'detail'] as const);
const adminResourceListCapabilitiesAllowedKeys = new Set([
  'search',
  'filters',
  'sorting',
  'pagination',
  'bulkActions',
] as const);
const adminResourceBulkActionCapabilityAllowedKeys = new Set([
  'id',
  'labelKey',
  'actionId',
  'bindingKey',
  'selectionModes',
] as const);
const adminResourceDetailCapabilitiesAllowedKeys = new Set(['history', 'revisions'] as const);
const adminResourceHistoryCapabilityAllowedKeys = new Set(['bindingKey', 'titleKey'] as const);
const adminResourceRevisionsCapabilityAllowedKeys = new Set([
  'bindingKey',
  'restoreActionId',
  'titleKey',
] as const);
const ADMIN_RESOURCE_BULK_SELECTION_MODES = new Set<AdminResourceBulkActionSelectionMode>([
  'explicitIds',
  'currentPage',
  'allMatchingQuery',
]);
const normalizeBulkActionCapability = (
  resourceId: string,
  action: AdminResourceListBulkActionCapability
): AdminResourceListBulkActionCapability => {
  assertAllowedCapabilityKeys(
    resourceId,
    `${resourceId}.capabilities.list.bulkActions`,
    action,
    adminResourceBulkActionCapabilityAllowedKeys
  );

  const id = normalizeCapabilityId(resourceId, 'capabilities.list.bulkActions.id', action.id);
  if (
    action.selectionModes.length === 0 ||
    action.selectionModes.some((mode) => !ADMIN_RESOURCE_BULK_SELECTION_MODES.has(mode))
  ) {
    throw new Error(`invalid_admin_resource_bulk_action_selection:${resourceId}:${id}`);
  }

  return {
    id,
    labelKey: normalizeLabelKey(
      resourceId,
      `capabilities.list.bulkActions.${id}.labelKey`,
      action.labelKey
    ),
    actionId: normalizeActionId(
      resourceId,
      `capabilities.list.bulkActions.${id}.actionId`,
      action.actionId
    ),
    bindingKey: normalizeBindingKey(
      resourceId,
      `capabilities.list.bulkActions.${id}.bindingKey`,
      action.bindingKey
    ),
    selectionModes: [...action.selectionModes],
  };
};

const normalizeListCapabilities = (
  resourceId: string,
  capabilities: AdminResourceListCapabilities | undefined
): AdminResourceListCapabilities | undefined => {
  if (!capabilities) {
    return undefined;
  }

  assertAllowedCapabilityKeys(
    resourceId,
    `${resourceId}.capabilities.list`,
    capabilities,
    adminResourceListCapabilitiesAllowedKeys
  );

  const search = capabilities.search
    ? normalizeSearchCapability(resourceId, capabilities.search)
    : undefined;
  const filters = capabilities.filters?.map((filter) =>
    normalizeFilterCapability(resourceId, filter)
  );

  if (filters) {
    assertUniqueValues(
      resourceId,
      'duplicate_admin_resource_filter',
      filters.map((filter) => filter.id)
    );
  }

  const sorting = capabilities.sorting
    ? normalizeSortingCapability(resourceId, capabilities.sorting)
    : undefined;
  const pagination = capabilities.pagination
    ? normalizePaginationCapability(resourceId, capabilities.pagination)
    : undefined;
  const bulkActions = capabilities.bulkActions?.map((action) =>
    normalizeBulkActionCapability(resourceId, action)
  );

  if (bulkActions) {
    assertUniqueValues(
      resourceId,
      'duplicate_admin_resource_bulk_action',
      bulkActions.map((action) => action.id)
    );
  }

  const searchParams = [
    ...(search ? [search.param] : []),
    ...(filters?.map((filter) => filter.param) ?? []),
    ...(sorting ? [sorting.param] : []),
    ...(pagination ? [pagination.pageParam, pagination.pageSizeParam] : []),
  ].filter((value): value is string => typeof value === 'string');
  assertUniqueValues(resourceId, 'duplicate_admin_resource_search_param', searchParams);

  return {
    search,
    filters,
    sorting,
    pagination,
    bulkActions,
  };
};

const normalizeDetailCapabilities = (
  resourceId: string,
  capabilities: AdminResourceDetailCapabilities | undefined
): AdminResourceDetailCapabilities | undefined => {
  if (!capabilities) {
    return undefined;
  }

  assertAllowedCapabilityKeys(
    resourceId,
    `${resourceId}.capabilities.detail`,
    capabilities,
    adminResourceDetailCapabilitiesAllowedKeys
  );

  const history = capabilities.history
    ? (() => {
        assertAllowedCapabilityKeys(
          resourceId,
          `${resourceId}.capabilities.detail.history`,
          capabilities.history,
          adminResourceHistoryCapabilityAllowedKeys
        );
        return {
          bindingKey: normalizeBindingKey(
            resourceId,
            'capabilities.detail.history.bindingKey',
            capabilities.history.bindingKey
          ),
          titleKey: normalizeLabelKey(
            resourceId,
            'capabilities.detail.history.titleKey',
            capabilities.history.titleKey
          ),
        };
      })()
    : undefined;

  const revisions = capabilities.revisions
    ? (() => {
        assertAllowedCapabilityKeys(
          resourceId,
          `${resourceId}.capabilities.detail.revisions`,
          capabilities.revisions,
          adminResourceRevisionsCapabilityAllowedKeys
        );
        return {
          bindingKey: normalizeBindingKey(
            resourceId,
            'capabilities.detail.revisions.bindingKey',
            capabilities.revisions.bindingKey
          ),
          restoreActionId: normalizeActionId(
            resourceId,
            'capabilities.detail.revisions.restoreActionId',
            capabilities.revisions.restoreActionId
          ),
          titleKey: normalizeLabelKey(
            resourceId,
            'capabilities.detail.revisions.titleKey',
            capabilities.revisions.titleKey
          ),
        };
      })()
    : undefined;

  return { history, revisions };
};

export const normalizeAdminResourceCapabilities = (
  resourceId: string,
  capabilities: AdminResourceCapabilities | undefined
): AdminResourceCapabilities | undefined => {
  if (!capabilities) {
    return undefined;
  }

  assertAllowedCapabilityKeys(
    resourceId,
    `${resourceId}.capabilities`,
    capabilities,
    adminResourceCapabilitiesAllowedKeys
  );

  return {
    list: normalizeListCapabilities(resourceId, capabilities.list),
    detail: normalizeDetailCapabilities(resourceId, capabilities.detail),
  };
};
