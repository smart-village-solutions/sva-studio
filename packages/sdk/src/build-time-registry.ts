import type { AdminResourceDefinition } from './admin-resources.js';
import { createAdminResourceRegistry } from './admin-resources.js';
import type {
  PluginActionRegistryEntry,
  PluginAuditEventDefinition,
  PluginAuditEventRegistryEntry,
  PluginDefinition,
  PluginNavigationItem,
  PluginRouteDefinition,
  PluginTranslations,
} from './plugins.js';
import {
  createPluginActionRegistry,
  createPluginAuditEventRegistry,
  createPluginRegistry,
  mergePluginAdminResourceDefinitions,
  mergePluginAuditEventDefinitions,
  mergePluginContentTypes,
  mergePluginNavigationItems,
  mergePluginRouteDefinitions,
  mergePluginTranslations,
} from './plugins.js';
import type { ContentTypeDefinition } from './content-types.js';

export type BuildTimeRegistryInput = {
  readonly plugins?: readonly PluginDefinition[];
  readonly adminResources?: readonly AdminResourceDefinition[];
};

export type BuildTimeRegistry = {
  readonly plugins: readonly PluginDefinition[];
  readonly pluginRegistry: ReadonlyMap<string, PluginDefinition>;
  readonly pluginActionRegistry: ReadonlyMap<string, PluginActionRegistryEntry>;
  readonly pluginAuditEventRegistry: ReadonlyMap<string, PluginAuditEventRegistryEntry>;
  readonly routes: readonly PluginRouteDefinition[];
  readonly navigation: readonly PluginNavigationItem[];
  readonly contentTypes: readonly ContentTypeDefinition[];
  readonly auditEvents: readonly PluginAuditEventDefinition[];
  readonly translations: PluginTranslations;
  readonly adminResources: readonly AdminResourceDefinition[];
  readonly adminResourceRegistry: ReadonlyMap<string, AdminResourceDefinition>;
};

export const createBuildTimeRegistry = ({
  plugins = [],
  adminResources = [],
}: BuildTimeRegistryInput): BuildTimeRegistry => {
  const pluginRegistry = createPluginRegistry(plugins);
  const normalizedPlugins = Array.from(pluginRegistry.values());
  const adminResourceRegistry = createAdminResourceRegistry([
    ...mergePluginAdminResourceDefinitions(normalizedPlugins),
    ...adminResources,
  ]);

  return {
    plugins: normalizedPlugins,
    pluginRegistry,
    pluginActionRegistry: createPluginActionRegistry(normalizedPlugins),
    pluginAuditEventRegistry: createPluginAuditEventRegistry(normalizedPlugins),
    routes: mergePluginRouteDefinitions(normalizedPlugins),
    navigation: mergePluginNavigationItems(normalizedPlugins),
    contentTypes: mergePluginContentTypes(normalizedPlugins),
    auditEvents: mergePluginAuditEventDefinitions(normalizedPlugins),
    translations: mergePluginTranslations(normalizedPlugins),
    adminResources: Array.from(adminResourceRegistry.values()),
    adminResourceRegistry,
  };
};
