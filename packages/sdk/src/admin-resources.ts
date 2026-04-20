import {
  isReservedPluginNamespace,
  normalizePluginIdentifier,
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

export type AdminResourceDefinition = {
  readonly resourceId: string;
  readonly basePath: string;
  readonly titleKey: string;
  readonly guard: AdminResourceGuard;
  readonly views: AdminResourceViews;
};

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

  return normalized;
};

const validateViewDefinition = (
  resourceId: string,
  viewName: keyof AdminResourceViews,
  view: AdminResourceViewDefinition | undefined
): AdminResourceViewDefinition => {
  const bindingKey = normalizePluginIdentifier(view?.bindingKey ?? '');
  if (bindingKey.length === 0) {
    throw new Error(`invalid_admin_resource_view:${resourceId}:${viewName}`);
  }

  return { bindingKey };
};

const normalizeAdminResourceDefinition = (resource: AdminResourceDefinition): AdminResourceDefinition => {
  const resourceId = normalizePluginIdentifier(resource.resourceId);

  return {
    ...resource,
    resourceId,
    basePath: normalizeBasePath(resource.basePath),
    titleKey: normalizePluginIdentifier(resource.titleKey),
    views: {
      list: validateViewDefinition(resourceId, 'list', resource.views.list),
      create: validateViewDefinition(resourceId, 'create', resource.views.create),
      detail: validateViewDefinition(resourceId, 'detail', resource.views.detail),
      history: resource.views.history
        ? validateViewDefinition(resourceId, 'history', resource.views.history)
        : undefined,
    },
  };
};

export const definePluginAdminResources = <const TResources extends readonly AdminResourceDefinition[]>(
  namespace: string,
  resources: TResources
): TResources => {
  const normalizedNamespace = normalizePluginIdentifier(namespace);
  if (normalizedNamespace.length === 0) {
    throw new Error('invalid_plugin_namespace');
  }
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
