import type { AdminResourceDefinition } from './admin-resources.js';
import { createAdminResourceRegistry } from './admin-resources.js';
import type {
  PluginActionRegistryEntry,
  PluginAuditEventDefinition,
  PluginAuditEventRegistryEntry,
  PluginDefinition,
  PluginNavigationItem,
  PluginPermissionDefinition,
  PluginPermissionRegistryEntry,
  PluginRouteDefinition,
  PluginTranslations,
} from './plugins.js';
import {
  createPluginActionRegistry,
  createPluginAuditEventRegistry,
  createPluginPermissionRegistry,
  createPluginRegistry,
  mergePluginAdminResourceDefinitions,
  mergePluginAuditEventDefinitions,
  mergePluginContentTypes,
  mergePluginNavigationItems,
  mergePluginPermissions,
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
  readonly pluginPermissionRegistry: ReadonlyMap<string, PluginPermissionRegistryEntry>;
  readonly pluginPermissions: readonly PluginPermissionDefinition[];
  readonly routes: readonly PluginRouteDefinition[];
  readonly navigation: readonly PluginNavigationItem[];
  readonly contentTypes: readonly ContentTypeDefinition[];
  readonly auditEvents: readonly PluginAuditEventDefinition[];
  readonly translations: PluginTranslations;
  readonly adminResources: readonly AdminResourceDefinition[];
  readonly adminResourceRegistry: ReadonlyMap<string, AdminResourceDefinition>;
};

type PreflightPhaseOutput = {
  readonly plugins: readonly PluginDefinition[];
  readonly pluginRegistry: ReadonlyMap<string, PluginDefinition>;
};

type ContentPhaseOutput = {
  readonly contentTypes: readonly ContentTypeDefinition[];
};

type AdminPhaseOutput = {
  readonly adminResources: readonly AdminResourceDefinition[];
  readonly adminResourceRegistry: ReadonlyMap<string, AdminResourceDefinition>;
};

type AuditPhaseOutput = {
  readonly auditEvents: readonly PluginAuditEventDefinition[];
  readonly pluginAuditEventRegistry: ReadonlyMap<string, PluginAuditEventRegistryEntry>;
};

type RoutingPhaseOutput = {
  readonly routes: readonly PluginRouteDefinition[];
  readonly navigation: readonly PluginNavigationItem[];
  readonly pluginActionRegistry: ReadonlyMap<string, PluginActionRegistryEntry>;
};

type PermissionPhaseOutput = {
  readonly pluginPermissions: readonly PluginPermissionDefinition[];
  readonly pluginPermissionRegistry: ReadonlyMap<string, PluginPermissionRegistryEntry>;
};

const runPreflightPhase = (plugins: readonly PluginDefinition[]): PreflightPhaseOutput => {
  const pluginRegistry = createPluginRegistry(plugins);

  return {
    plugins: Array.from(pluginRegistry.values()),
    pluginRegistry,
  };
};

const runContentPhase = (plugins: readonly PluginDefinition[]): ContentPhaseOutput => ({
  contentTypes: mergePluginContentTypes(plugins),
});

const runAdminPhase = (
  plugins: readonly PluginDefinition[],
  adminResources: readonly AdminResourceDefinition[]
): AdminPhaseOutput => {
  const adminResourceRegistry = createAdminResourceRegistry([
    ...mergePluginAdminResourceDefinitions(plugins),
    ...adminResources,
  ]);

  return {
    adminResources: Array.from(adminResourceRegistry.values()),
    adminResourceRegistry,
  };
};

const runAuditPhase = (plugins: readonly PluginDefinition[]): AuditPhaseOutput => ({
  auditEvents: mergePluginAuditEventDefinitions(plugins),
  pluginAuditEventRegistry: createPluginAuditEventRegistry(plugins),
});

const runPermissionPhase = (plugins: readonly PluginDefinition[]): PermissionPhaseOutput => ({
  pluginPermissions: mergePluginPermissions(plugins),
  pluginPermissionRegistry: createPluginPermissionRegistry(plugins),
});

const runRoutingPhase = (plugins: readonly PluginDefinition[]): RoutingPhaseOutput => ({
  routes: mergePluginRouteDefinitions(plugins),
  navigation: mergePluginNavigationItems(plugins),
  pluginActionRegistry: createPluginActionRegistry(plugins),
});

const publishBuildTimeRegistry = ({
  preflight,
  content,
  admin,
  audit,
  routing,
  permissions,
}: {
  readonly preflight: PreflightPhaseOutput;
  readonly content: ContentPhaseOutput;
  readonly admin: AdminPhaseOutput;
  readonly audit: AuditPhaseOutput;
  readonly routing: RoutingPhaseOutput;
  readonly permissions: PermissionPhaseOutput;
}): BuildTimeRegistry => ({
  plugins: preflight.plugins,
  pluginRegistry: preflight.pluginRegistry,
  pluginActionRegistry: routing.pluginActionRegistry,
  pluginAuditEventRegistry: audit.pluginAuditEventRegistry,
  pluginPermissionRegistry: permissions.pluginPermissionRegistry,
  pluginPermissions: permissions.pluginPermissions,
  routes: routing.routes,
  navigation: routing.navigation,
  contentTypes: content.contentTypes,
  auditEvents: audit.auditEvents,
  translations: mergePluginTranslations(preflight.plugins),
  adminResources: admin.adminResources,
  adminResourceRegistry: admin.adminResourceRegistry,
});

export const createBuildTimeRegistry = ({
  plugins = [],
  adminResources = [],
}: BuildTimeRegistryInput): BuildTimeRegistry => {
  const preflight = runPreflightPhase(plugins);
  const content = runContentPhase(preflight.plugins);
  const admin = runAdminPhase(preflight.plugins, adminResources);
  const audit = runAuditPhase(preflight.plugins);
  const permissions = runPermissionPhase(preflight.plugins);
  const routing = runRoutingPhase(preflight.plugins);

  return publishBuildTimeRegistry({ preflight, content, admin, audit, routing, permissions });
};
