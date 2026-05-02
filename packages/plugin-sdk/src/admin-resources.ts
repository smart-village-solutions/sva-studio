import {
  assertPluginContributionAllowedKeys,
  createPluginContributionGuardrailError,
} from './guardrails.js';
import {
  isReservedPluginNamespace,
  normalizePluginIdentifier,
  normalizePluginNamespace,
  parseNamespacedPluginIdentifier,
} from './plugin-identifiers.js';

export type AdminResourceGuard =
  | 'content'
  | 'adminUsers'
  | 'adminOrganizations'
  | 'adminInstances'
  | 'adminRoles'
  | 'adminGroups'
  | 'adminLegalTexts';

export type AdminResourceViewDefinition = {
  readonly bindingKey: string;
};

export type AdminResourceViews = {
  readonly list: AdminResourceViewDefinition;
  readonly create: AdminResourceViewDefinition;
  readonly detail: AdminResourceViewDefinition;
  readonly history?: AdminResourceViewDefinition;
};

export type AdminResourceListSearchCapability = {
  readonly param?: string;
  readonly placeholderKey: string;
  readonly fields: readonly string[];
};

export type AdminResourceListFilterOption = {
  readonly value: string;
  readonly labelKey: string;
};

export type AdminResourceListFilterCapability = {
  readonly id: string;
  readonly param?: string;
  readonly labelKey: string;
  readonly bindingKey: string;
  readonly options: readonly AdminResourceListFilterOption[];
  readonly defaultValue?: string;
};

export type AdminResourceListSortingCapability = {
  readonly param?: string;
  readonly defaultField: string;
  readonly defaultDirection: 'asc' | 'desc';
  readonly fields: readonly {
    readonly id: string;
    readonly labelKey: string;
    readonly bindingKey: string;
  }[];
};

export type AdminResourceListPaginationCapability = {
  readonly pageParam?: string;
  readonly pageSizeParam?: string;
  readonly defaultPageSize: number;
  readonly pageSizeOptions: readonly number[];
};

export type AdminResourceBulkActionSelectionMode = 'explicitIds' | 'currentPage' | 'allMatchingQuery';

export type AdminResourceListBulkActionCapability = {
  readonly id: string;
  readonly labelKey: string;
  readonly actionId: string;
  readonly bindingKey: string;
  readonly selectionModes: readonly AdminResourceBulkActionSelectionMode[];
};

export type AdminResourceListCapabilities = {
  readonly search?: AdminResourceListSearchCapability;
  readonly filters?: readonly AdminResourceListFilterCapability[];
  readonly sorting?: AdminResourceListSortingCapability;
  readonly pagination?: AdminResourceListPaginationCapability;
  readonly bulkActions?: readonly AdminResourceListBulkActionCapability[];
};

export type AdminResourceDetailCapabilities = {
  readonly history?: {
    readonly bindingKey: string;
    readonly titleKey: string;
  };
  readonly revisions?: {
    readonly bindingKey: string;
    readonly restoreActionId: string;
    readonly titleKey: string;
  };
};

export type AdminResourceCapabilities = {
  readonly list?: AdminResourceListCapabilities;
  readonly detail?: AdminResourceDetailCapabilities;
};

export type AdminResourceViewPermissions = {
  readonly list?: readonly string[];
  readonly create?: readonly string[];
  readonly detail?: readonly string[];
  readonly history?: readonly string[];
};

export type ContentResourceViewBindingDefinition = {
  readonly bindingKey: string;
};

export type AdminResourceContentUiBindings = {
  readonly list?: ContentResourceViewBindingDefinition;
  readonly detail?: ContentResourceViewBindingDefinition;
  readonly editor?: ContentResourceViewBindingDefinition;
};

export type AdminResourceContentUiDefinition = {
  readonly contentType: string;
  readonly bindings?: AdminResourceContentUiBindings;
};

export type AdminResourceDefinition = {
  readonly resourceId: string;
  readonly basePath: string;
  readonly titleKey: string;
  readonly guard: AdminResourceGuard;
  readonly moduleId?: string;
  readonly views: AdminResourceViews;
  readonly permissions?: AdminResourceViewPermissions;
  readonly capabilities?: AdminResourceCapabilities;
  readonly contentUi?: AdminResourceContentUiDefinition;
};

const adminResourceDefinitionAllowedKeys = new Set([
  'resourceId',
  'basePath',
  'titleKey',
  'guard',
  'moduleId',
  'views',
  'permissions',
  'capabilities',
  'contentUi',
] as const);
const adminResourceViewAllowedKeys = new Set(['bindingKey'] as const);
const adminResourcePermissionsAllowedKeys = new Set(['list', 'create', 'detail', 'history'] as const);
const adminResourceCapabilitiesAllowedKeys = new Set(['list', 'detail'] as const);
const adminResourceListCapabilitiesAllowedKeys = new Set(['search', 'filters', 'sorting', 'pagination', 'bulkActions'] as const);
const adminResourceSearchCapabilityAllowedKeys = new Set(['param', 'placeholderKey', 'fields'] as const);
const adminResourceFilterCapabilityAllowedKeys = new Set(['id', 'param', 'labelKey', 'bindingKey', 'options', 'defaultValue'] as const);
const adminResourceFilterOptionAllowedKeys = new Set(['value', 'labelKey'] as const);
const adminResourceSortingCapabilityAllowedKeys = new Set(['param', 'defaultField', 'defaultDirection', 'fields'] as const);
const adminResourceSortingFieldAllowedKeys = new Set(['id', 'labelKey', 'bindingKey'] as const);
const adminResourcePaginationCapabilityAllowedKeys = new Set(['pageParam', 'pageSizeParam', 'defaultPageSize', 'pageSizeOptions'] as const);
const adminResourceBulkActionCapabilityAllowedKeys = new Set(['id', 'labelKey', 'actionId', 'bindingKey', 'selectionModes'] as const);
const adminResourceDetailCapabilitiesAllowedKeys = new Set(['history', 'revisions'] as const);
const adminResourceHistoryCapabilityAllowedKeys = new Set(['bindingKey', 'titleKey'] as const);
const adminResourceRevisionsCapabilityAllowedKeys = new Set(['bindingKey', 'restoreActionId', 'titleKey'] as const);
const adminResourceContentUiAllowedKeys = new Set(['contentType', 'bindings'] as const);
const adminResourceContentUiBindingsAllowedKeys = new Set(['list', 'detail', 'editor'] as const);

const ADMIN_RESOURCE_PARAM_PATTERN = /^[a-z][a-zA-Z0-9]*$/;
const ADMIN_RESOURCE_ACTION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z][A-Za-z0-9-]*$/;
const ADMIN_RESOURCE_BULK_SELECTION_MODES = new Set<AdminResourceBulkActionSelectionMode>([
  'explicitIds',
  'currentPage',
  'allMatchingQuery',
]);

const normalizeBasePath = (value: string): string => {
  const trimmed = value.trim();
  let start = 0;
  let end = trimmed.length;

  while (start < end && trimmed[start] === '/') {
    start += 1;
  }
  while (end > start && trimmed[end - 1] === '/') {
    end -= 1;
  }

  const normalized = trimmed.slice(start, end);
  if (normalized.length === 0) {
    throw new Error('invalid_admin_resource_base_path');
  }
  if (normalized.includes('/')) {
    throw new Error(`invalid_admin_resource_base_path:${normalized}`);
  }
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) === false) {
    throw new Error(`invalid_admin_resource_base_path:${normalized}`);
  }

  return normalized;
};

const validateViewDefinition = (
  resourceId: string,
  viewName: keyof AdminResourceViews,
  view: AdminResourceViewDefinition | undefined
): AdminResourceViewDefinition => {
  if (view) {
    assertPluginContributionAllowedKeys(
      view as unknown as Record<string, unknown>,
      adminResourceViewAllowedKeys,
      normalizePluginIdentifier(resourceId).split('.')[0] ?? 'host',
      `${resourceId}.${String(viewName)}`
    );
  }

  const bindingKey = normalizePluginIdentifier(view?.bindingKey ?? '');
  if (bindingKey.length === 0) {
    throw new Error(`invalid_admin_resource_view:${resourceId}:${viewName}`);
  }

  return { bindingKey };
};

const validateContentResourceBindingDefinition = (
  resourceId: string,
  viewName: keyof AdminResourceContentUiBindings,
  view: ContentResourceViewBindingDefinition | undefined
): ContentResourceViewBindingDefinition | undefined => {
  if (!view) {
    return undefined;
  }

  assertPluginContributionAllowedKeys(
    view as unknown as Record<string, unknown>,
    adminResourceViewAllowedKeys,
    normalizePluginIdentifier(resourceId).split('.')[0] ?? 'host',
    `${resourceId}.contentUi.bindings.${String(viewName)}`
  );

  const bindingKey = normalizePluginIdentifier(view.bindingKey);
  if (bindingKey.length === 0) {
    throw new Error(`invalid_admin_resource_view:${resourceId}:contentUi.${viewName}`);
  }

  return { bindingKey };
};

const normalizeLabelKey = (resourceId: string, fieldName: string, value: string): string => {
  const normalized = normalizePluginIdentifier(value);
  if (normalized.length === 0) {
    throw new Error(`invalid_admin_resource_capability:${resourceId}:${fieldName}`);
  }
  return normalized;
};

const normalizeBindingKey = (resourceId: string, fieldName: string, value: string): string => {
  const normalized = normalizePluginIdentifier(value);
  if (normalized.length === 0) {
    throw new Error(`invalid_admin_resource_capability:${resourceId}:${fieldName}`);
  }
  return normalized;
};

const normalizeModuleId = (resourceId: string, value: string | undefined): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) === false) {
    throw new Error(`invalid_admin_resource_module_id:${resourceId}:${normalized}`);
  }

  return normalized;
};

const normalizeCapabilityId = (resourceId: string, fieldName: string, value: string): string => {
  const normalized = normalizePluginIdentifier(value);
  if (normalized.length === 0) {
    throw new Error(`invalid_admin_resource_capability:${resourceId}:${fieldName}`);
  }
  return normalized;
};

const normalizeSearchParamName = (resourceId: string, fieldName: string, value: string): string => {
  const normalized = value.trim();
  if (ADMIN_RESOURCE_PARAM_PATTERN.test(normalized) === false) {
    throw new Error(`invalid_admin_resource_search_param:${resourceId}:${fieldName}:${normalized}`);
  }
  return normalized;
};

const assertAllowedCapabilityKeys = (
  resourceId: string,
  contributionId: string,
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>
) => {
  assertPluginContributionAllowedKeys(value, allowedKeys, resourceId.split('.')[0] ?? 'host', contributionId);
};

const assertUniqueValues = (
  resourceId: string,
  conflictCode: string,
  values: readonly string[]
) => {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`${conflictCode}:${resourceId}:${value}`);
    }
    seen.add(value);
  }
};

const normalizeActionId = (resourceId: string, fieldName: string, value: string): string => {
  const normalized = normalizePluginIdentifier(value);
  if (ADMIN_RESOURCE_ACTION_ID_PATTERN.test(normalized) === false) {
    throw new Error(`invalid_admin_resource_action_id:${resourceId}:${fieldName}:${normalized}`);
  }
  return normalized;
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
    capabilities as unknown as Record<string, unknown>,
    adminResourceListCapabilitiesAllowedKeys
  );

  const search = capabilities.search
    ? (() => {
        assertAllowedCapabilityKeys(
          resourceId,
          `${resourceId}.capabilities.list.search`,
          capabilities.search as unknown as Record<string, unknown>,
          adminResourceSearchCapabilityAllowedKeys
        );
        const fields = capabilities.search.fields.map((field) =>
          normalizeCapabilityId(resourceId, 'capabilities.list.search.fields', field)
        );
        if (fields.length === 0) {
          throw new Error(`invalid_admin_resource_capability:${resourceId}:capabilities.list.search.fields`);
        }
        assertUniqueValues(resourceId, 'duplicate_admin_resource_search_field', fields);
        return {
          param: normalizeSearchParamName(resourceId, 'capabilities.list.search.param', capabilities.search.param ?? 'q'),
          placeholderKey: normalizeLabelKey(resourceId, 'capabilities.list.search.placeholderKey', capabilities.search.placeholderKey),
          fields,
        };
      })()
    : undefined;

  const filters = capabilities.filters?.map((filter) => {
    assertAllowedCapabilityKeys(
      resourceId,
      `${resourceId}.capabilities.list.filters`,
      filter as unknown as Record<string, unknown>,
      adminResourceFilterCapabilityAllowedKeys
    );
    const id = normalizeCapabilityId(resourceId, 'capabilities.list.filters.id', filter.id);
    const options = filter.options.map((option) => {
      assertAllowedCapabilityKeys(
        resourceId,
        `${resourceId}.capabilities.list.filters.${id}.options`,
        option as unknown as Record<string, unknown>,
        adminResourceFilterOptionAllowedKeys
      );
      return {
        value: normalizeCapabilityId(resourceId, `capabilities.list.filters.${id}.options.value`, option.value),
        labelKey: normalizeLabelKey(resourceId, `capabilities.list.filters.${id}.options.labelKey`, option.labelKey),
      };
    });
    if (options.length === 0) {
      throw new Error(`invalid_admin_resource_capability:${resourceId}:capabilities.list.filters.${id}.options`);
    }
    assertUniqueValues(resourceId, 'duplicate_admin_resource_filter_option', options.map((option) => option.value));
    const defaultValue = filter.defaultValue
      ? normalizeCapabilityId(resourceId, `capabilities.list.filters.${id}.defaultValue`, filter.defaultValue)
      : undefined;
    if (defaultValue && options.some((option) => option.value === defaultValue) === false) {
      throw new Error(`invalid_admin_resource_filter_default:${resourceId}:${id}:${defaultValue}`);
    }
    return {
      id,
      param: normalizeSearchParamName(resourceId, `capabilities.list.filters.${id}.param`, filter.param ?? id),
      labelKey: normalizeLabelKey(resourceId, `capabilities.list.filters.${id}.labelKey`, filter.labelKey),
      bindingKey: normalizeBindingKey(resourceId, `capabilities.list.filters.${id}.bindingKey`, filter.bindingKey),
      options,
      defaultValue,
    };
  });

  if (filters) {
    assertUniqueValues(resourceId, 'duplicate_admin_resource_filter', filters.map((filter) => filter.id));
  }

  const sorting = capabilities.sorting
    ? (() => {
        assertAllowedCapabilityKeys(
          resourceId,
          `${resourceId}.capabilities.list.sorting`,
          capabilities.sorting as unknown as Record<string, unknown>,
          adminResourceSortingCapabilityAllowedKeys
        );
        const fields = capabilities.sorting.fields.map((field) => {
          assertAllowedCapabilityKeys(
            resourceId,
            `${resourceId}.capabilities.list.sorting.fields`,
            field as unknown as Record<string, unknown>,
            adminResourceSortingFieldAllowedKeys
          );
          return {
            id: normalizeCapabilityId(resourceId, 'capabilities.list.sorting.fields.id', field.id),
            labelKey: normalizeLabelKey(resourceId, 'capabilities.list.sorting.fields.labelKey', field.labelKey),
            bindingKey: normalizeBindingKey(resourceId, 'capabilities.list.sorting.fields.bindingKey', field.bindingKey),
          };
        });
        if (fields.length === 0) {
          throw new Error(`invalid_admin_resource_capability:${resourceId}:capabilities.list.sorting.fields`);
        }
        assertUniqueValues(resourceId, 'duplicate_admin_resource_sort_field', fields.map((field) => field.id));
        const defaultField = normalizeCapabilityId(resourceId, 'capabilities.list.sorting.defaultField', capabilities.sorting.defaultField);
        if (fields.some((field) => field.id === defaultField) === false) {
          throw new Error(`invalid_admin_resource_sort_default:${resourceId}:${defaultField}`);
        }
        return {
          param: normalizeSearchParamName(resourceId, 'capabilities.list.sorting.param', capabilities.sorting.param ?? 'sort'),
          defaultField,
          defaultDirection: capabilities.sorting.defaultDirection,
          fields,
        };
      })()
    : undefined;

  if (sorting && sorting.defaultDirection !== 'asc' && sorting.defaultDirection !== 'desc') {
    throw new Error(`invalid_admin_resource_sort_direction:${resourceId}:${sorting.defaultDirection}`);
  }

  const pagination = capabilities.pagination
    ? (() => {
        assertAllowedCapabilityKeys(
          resourceId,
          `${resourceId}.capabilities.list.pagination`,
          capabilities.pagination as unknown as Record<string, unknown>,
          adminResourcePaginationCapabilityAllowedKeys
        );
        const pageSizeOptions = [...capabilities.pagination.pageSizeOptions];
        if (
          capabilities.pagination.defaultPageSize < 1 ||
          pageSizeOptions.length === 0 ||
          pageSizeOptions.some((option) => option < 1 || Number.isInteger(option) === false)
        ) {
          throw new Error(`invalid_admin_resource_pagination:${resourceId}`);
        }
        assertUniqueValues(resourceId, 'duplicate_admin_resource_page_size', pageSizeOptions.map(String));
        if (!pageSizeOptions.includes(capabilities.pagination.defaultPageSize)) {
          throw new Error(`invalid_admin_resource_pagination_default:${resourceId}:${capabilities.pagination.defaultPageSize}`);
        }
        return {
          pageParam: normalizeSearchParamName(resourceId, 'capabilities.list.pagination.pageParam', capabilities.pagination.pageParam ?? 'page'),
          pageSizeParam: normalizeSearchParamName(
            resourceId,
            'capabilities.list.pagination.pageSizeParam',
            capabilities.pagination.pageSizeParam ?? 'pageSize'
          ),
          defaultPageSize: capabilities.pagination.defaultPageSize,
          pageSizeOptions,
        };
      })()
    : undefined;

  const bulkActions = capabilities.bulkActions?.map((action) => {
    assertAllowedCapabilityKeys(
      resourceId,
      `${resourceId}.capabilities.list.bulkActions`,
      action as unknown as Record<string, unknown>,
      adminResourceBulkActionCapabilityAllowedKeys
    );
    const id = normalizeCapabilityId(resourceId, 'capabilities.list.bulkActions.id', action.id);
    if (action.selectionModes.length === 0 || action.selectionModes.some((mode) => !ADMIN_RESOURCE_BULK_SELECTION_MODES.has(mode))) {
      throw new Error(`invalid_admin_resource_bulk_action_selection:${resourceId}:${id}`);
    }
    return {
      id,
      labelKey: normalizeLabelKey(resourceId, `capabilities.list.bulkActions.${id}.labelKey`, action.labelKey),
      actionId: normalizeActionId(resourceId, `capabilities.list.bulkActions.${id}.actionId`, action.actionId),
      bindingKey: normalizeBindingKey(resourceId, `capabilities.list.bulkActions.${id}.bindingKey`, action.bindingKey),
      selectionModes: [...action.selectionModes],
    };
  });

  if (bulkActions) {
    assertUniqueValues(resourceId, 'duplicate_admin_resource_bulk_action', bulkActions.map((action) => action.id));
  }

  const searchParams = [
    ...(search ? [search.param] : []),
    ...(filters?.map((filter) => filter.param) ?? []),
    ...(sorting ? [sorting.param] : []),
    ...(pagination ? [pagination.pageParam, pagination.pageSizeParam] : []),
  ];
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
    capabilities as unknown as Record<string, unknown>,
    adminResourceDetailCapabilitiesAllowedKeys
  );

  const history = capabilities.history
    ? (() => {
        assertAllowedCapabilityKeys(
          resourceId,
          `${resourceId}.capabilities.detail.history`,
          capabilities.history as unknown as Record<string, unknown>,
          adminResourceHistoryCapabilityAllowedKeys
        );
        return {
          bindingKey: normalizeBindingKey(resourceId, 'capabilities.detail.history.bindingKey', capabilities.history.bindingKey),
          titleKey: normalizeLabelKey(resourceId, 'capabilities.detail.history.titleKey', capabilities.history.titleKey),
        };
      })()
    : undefined;

  const revisions = capabilities.revisions
    ? (() => {
        assertAllowedCapabilityKeys(
          resourceId,
          `${resourceId}.capabilities.detail.revisions`,
          capabilities.revisions as unknown as Record<string, unknown>,
          adminResourceRevisionsCapabilityAllowedKeys
        );
        return {
          bindingKey: normalizeBindingKey(resourceId, 'capabilities.detail.revisions.bindingKey', capabilities.revisions.bindingKey),
          restoreActionId: normalizeActionId(
            resourceId,
            'capabilities.detail.revisions.restoreActionId',
            capabilities.revisions.restoreActionId
          ),
          titleKey: normalizeLabelKey(resourceId, 'capabilities.detail.revisions.titleKey', capabilities.revisions.titleKey),
        };
      })()
    : undefined;

  return { history, revisions };
};

const normalizeAdminResourceCapabilities = (
  resourceId: string,
  capabilities: AdminResourceCapabilities | undefined
): AdminResourceCapabilities | undefined => {
  if (!capabilities) {
    return undefined;
  }

  assertAllowedCapabilityKeys(
    resourceId,
    `${resourceId}.capabilities`,
    capabilities as unknown as Record<string, unknown>,
    adminResourceCapabilitiesAllowedKeys
  );

  return {
    list: normalizeListCapabilities(resourceId, capabilities.list),
    detail: normalizeDetailCapabilities(resourceId, capabilities.detail),
  };
};

const normalizeAdminResourcePermissions = (
  resourceId: string,
  permissions: AdminResourceViewPermissions | undefined
): AdminResourceViewPermissions | undefined => {
  if (!permissions) {
    return undefined;
  }

  assertAllowedCapabilityKeys(
    resourceId,
    `${resourceId}.permissions`,
    permissions as unknown as Record<string, unknown>,
    adminResourcePermissionsAllowedKeys
  );

  const normalizePermissionList = (
    viewName: keyof AdminResourceViewPermissions,
    values: readonly string[] | undefined
  ): readonly string[] | undefined => {
    if (values === undefined) {
      return undefined;
    }
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(`invalid_admin_resource_permissions:${resourceId}:${String(viewName)}`);
    }

    const normalizedValues = values.map((value) => {
      const normalized = normalizePluginIdentifier(value);
      if (!ADMIN_RESOURCE_ACTION_ID_PATTERN.test(normalized)) {
        throw new Error(`invalid_admin_resource_action_id:${resourceId}:permissions.${String(viewName)}:${normalized}`);
      }
      return normalized;
    });

    return [...new Set(normalizedValues)];
  };

  const normalizedPermissions = {
    list: normalizePermissionList('list', permissions.list),
    create: normalizePermissionList('create', permissions.create),
    detail: normalizePermissionList('detail', permissions.detail),
    history: normalizePermissionList('history', permissions.history),
  } as const;

  return Object.values(normalizedPermissions).some((value) => value !== undefined) ? normalizedPermissions : undefined;
};

const normalizeAdminResourceContentUi = (
  resourceId: string,
  guard: AdminResourceGuard,
  contentUi: AdminResourceContentUiDefinition | undefined
): AdminResourceContentUiDefinition | undefined => {
  if (!contentUi) {
    return undefined;
  }

  if (guard !== 'content') {
    throw new Error(`invalid_admin_resource_content_ui_guard:${resourceId}:${guard}`);
  }

  assertAllowedCapabilityKeys(
    resourceId,
    `${resourceId}.contentUi`,
    contentUi as unknown as Record<string, unknown>,
    adminResourceContentUiAllowedKeys
  );

  const normalizedContentType = normalizePluginIdentifier(contentUi.contentType);
  if (normalizedContentType.length === 0) {
    throw new Error(`invalid_admin_resource_content_type:${resourceId}`);
  }

  const bindings = contentUi.bindings
    ? (() => {
        assertAllowedCapabilityKeys(
          resourceId,
          `${resourceId}.contentUi.bindings`,
          contentUi.bindings as unknown as Record<string, unknown>,
          adminResourceContentUiBindingsAllowedKeys
        );

        return {
          list: validateContentResourceBindingDefinition(resourceId, 'list', contentUi.bindings.list),
          detail: validateContentResourceBindingDefinition(resourceId, 'detail', contentUi.bindings.detail),
          editor: validateContentResourceBindingDefinition(resourceId, 'editor', contentUi.bindings.editor),
        };
      })()
    : undefined;

  return {
    contentType: normalizedContentType,
    bindings,
  };
};

const normalizeAdminResourceDefinition = (resource: AdminResourceDefinition): AdminResourceDefinition => {
  const resourceId = normalizePluginIdentifier(resource.resourceId);
  assertPluginContributionAllowedKeys(
    resource as unknown as Record<string, unknown>,
    adminResourceDefinitionAllowedKeys,
    resourceId.split('.')[0] ?? 'host',
    resourceId
  );

  const views = resource.views as unknown as Record<string, unknown>;
  for (const viewName of Object.keys(views)) {
    if (!['list', 'create', 'detail', 'history'].includes(viewName)) {
      throw createPluginContributionGuardrailError(
        resourceId.split('.')[0] ?? 'host',
        resourceId,
        `views.${viewName}`
      );
    }
  }

  return {
    ...resource,
    resourceId,
    basePath: normalizeBasePath(resource.basePath),
    titleKey: normalizePluginIdentifier(resource.titleKey),
    ...(resource.moduleId ? { moduleId: normalizeModuleId(resourceId, resource.moduleId) } : {}),
    views: {
      list: validateViewDefinition(resourceId, 'list', resource.views.list),
      create: validateViewDefinition(resourceId, 'create', resource.views.create),
      detail: validateViewDefinition(resourceId, 'detail', resource.views.detail),
      history: resource.views.history
        ? validateViewDefinition(resourceId, 'history', resource.views.history)
        : undefined,
    },
    ...(normalizeAdminResourcePermissions(resourceId, resource.permissions)
      ? { permissions: normalizeAdminResourcePermissions(resourceId, resource.permissions) }
      : {}),
    capabilities: normalizeAdminResourceCapabilities(resourceId, resource.capabilities),
    contentUi: normalizeAdminResourceContentUi(resourceId, resource.guard, resource.contentUi),
  };
};

export const definePluginAdminResources = <const TResources extends readonly AdminResourceDefinition[]>(
  namespace: string,
  resources: TResources
): TResources => {
  const normalizedNamespace = normalizePluginNamespace(namespace);
  if (isReservedPluginNamespace(normalizedNamespace)) {
    throw new Error(`reserved_plugin_namespace:${normalizedNamespace}`);
  }

  const normalizedResources = resources.map((resource) =>
    normalizeAdminResourceDefinition(resource)
  ) as unknown as TResources;

  for (const resource of normalizedResources) {
    const parsed = parseNamespacedPluginIdentifier(resource.resourceId);
    if (parsed === undefined) {
      throw new Error(`invalid_plugin_admin_resource:${resource.resourceId}`);
    }
    if (parsed.namespace !== normalizedNamespace) {
      throw new Error(
        `plugin_admin_resource_namespace_mismatch:${normalizedNamespace}:${parsed.namespace}:${resource.resourceId}`
      );
    }
    if (resource.contentUi) {
      const contentType = normalizePluginIdentifier(resource.contentUi.contentType);
      const parsedContentType = parseNamespacedPluginIdentifier(contentType);
      if (parsedContentType === undefined) {
        throw new Error(`invalid_admin_resource_content_type:${resource.resourceId}`);
      }
      if (parsedContentType.namespace !== normalizedNamespace) {
        throw new Error(
          `plugin_admin_resource_content_type_namespace_mismatch:${normalizedNamespace}:${parsedContentType.namespace}:${contentType}`
        );
      }
    }
  }

  return normalizedResources;
};

export const createAdminResourceRegistry = (
  resources: readonly AdminResourceDefinition[]
): ReadonlyMap<string, AdminResourceDefinition> => {
  const registry = new Map<string, AdminResourceDefinition>();
  const basePaths = new Map<string, string>();

  for (const resource of resources) {
    const normalizedResource = normalizeAdminResourceDefinition(resource);
    const { resourceId, titleKey, basePath } = normalizedResource;

    if (resourceId.length === 0 || titleKey.length === 0) {
      throw new Error('invalid_admin_resource_definition');
    }

    if (registry.has(resourceId)) {
      throw new Error(`duplicate_admin_resource:${resourceId}`);
    }

    const existingResourceId = basePaths.get(basePath);
    if (existingResourceId) {
      throw new Error(`admin_resource_base_path_conflict:${existingResourceId}:${resourceId}:${basePath}`);
    }

    registry.set(resourceId, normalizedResource);
    basePaths.set(basePath, resourceId);
  }

  return registry;
};

export const mergeAdminResourceDefinitions = (
  resources: readonly AdminResourceDefinition[]
): readonly AdminResourceDefinition[] => Array.from(createAdminResourceRegistry(resources).values());
