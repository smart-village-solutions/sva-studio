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
import type { AdminResourceDefinition } from './admin-resource-contracts.js';
import {
  adminResourceDefinitionAllowedKeys,
  normalizeBasePath,
  normalizeModuleId,
  validateViewDefinition,
} from './admin-resource-validation-shared.js';
import { normalizeAdminResourceCapabilities } from './admin-resource-capabilities.js';
import {
  normalizeAdminResourceContentUi,
  normalizeAdminResourcePermissions,
} from './admin-resource-permissions.js';

export type * from './admin-resource-list-contracts.js';
export type * from './admin-resource-contracts.js';

const normalizeAdminResourceDefinition = (
  resource: AdminResourceDefinition
): AdminResourceDefinition => {
  const resourceId = normalizePluginIdentifier(resource.resourceId);
  assertPluginContributionAllowedKeys(
    resource,
    adminResourceDefinitionAllowedKeys,
    resourceId.split('.')[0] ?? 'host',
    resourceId
  );

  for (const viewName of Object.keys(resource.views)) {
    if (!['list', 'create', 'detail', 'history'].includes(viewName)) {
      throw createPluginContributionGuardrailError(
        resourceId.split('.')[0] ?? 'host',
        resourceId,
        `views.${viewName}`
      );
    }
  }

  const normalizedPermissions = normalizeAdminResourcePermissions(resourceId, resource.permissions);
  const normalizedCapabilities = normalizeAdminResourceCapabilities(
    resourceId,
    resource.capabilities
  );

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
    ...(normalizedPermissions ? { permissions: normalizedPermissions } : {}),
    capabilities: normalizedCapabilities,
    contentUi: normalizeAdminResourceContentUi(resourceId, resource.guard, resource.contentUi),
  };
};

export const definePluginAdminResources = <
  const TResources extends readonly AdminResourceDefinition[],
>(
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
      throw new Error(
        `admin_resource_base_path_conflict:${existingResourceId}:${resourceId}:${basePath}`
      );
    }

    registry.set(resourceId, normalizedResource);
    basePaths.set(basePath, resourceId);
  }

  return registry;
};

export const mergeAdminResourceDefinitions = (
  resources: readonly AdminResourceDefinition[]
): readonly AdminResourceDefinition[] =>
  Array.from(createAdminResourceRegistry(resources).values());
