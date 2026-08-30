import type { AdminResourceDefinition } from './admin-resources.js';
import { createAdminResourceRegistry } from './admin-resources.js';
import type {
  PluginActionRegistryEntry,
  PluginAuditEventDefinition,
  PluginAuditEventRegistryEntry,
  PluginDefinition,
  PluginModuleIamRegistryEntry,
  PluginNavigationItem,
  PluginPermissionDefinition,
  PluginPermissionRegistryEntry,
  PluginRouteDefinition,
  PluginServerHandlerRegistryEntry,
  PluginTranslations,
} from './plugins.js';
import {
  createPluginActionRegistry,
  createPluginAuditEventRegistry,
  createPluginModuleIamRegistry,
  createPluginPermissionRegistry,
  createPluginRegistry,
  createPluginServerHandlerRegistry,
  mergePluginAdminResourceDefinitions,
  mergePluginAuditEventDefinitions,
  mergePluginContentTypes,
  mergePluginModuleIamContracts,
  mergePluginNavigationItems,
  mergePluginPermissions,
  mergePluginRouteDefinitions,
  mergePluginTranslations,
} from './plugins.js';
import type { ContentTypeDefinition, RegisteredStudioContentType } from './content-types.js';
import { collectRegisteredStudioContentTypes } from './content-types.js';
import { createMainserverGenericTypeRegistry } from './mainserver-generic-type-registry.js';
import {
  createPluginExportProfileRegistry,
  createPluginImportProfileRegistry,
  createPluginJobTypeRegistry,
  mergePluginExportProfiles,
  mergePluginImportProfiles,
  mergePluginJobTypes,
} from './plugin-operations.js';
import type { PluginTenantLifecycleRegistryEntry } from './plugin-tenant-lifecycle.js';
import {
  createPluginTenantLifecycleRegistry,
  mergePluginTenantLifecycles,
} from './plugin-tenant-lifecycle.js';
import type { PluginExtensionTier } from './plugin-platform/contracts.js';
import type {
  PluginExternalInterfaceTypeDefinition,
  PluginExternalInterfaceTypeRegistryEntry,
} from './external-interfaces.js';
import {
  createPluginExternalInterfaceTypeRegistry,
  mergePluginExternalInterfaceTypes,
} from './external-interfaces.js';
import type {
  PluginExportProfileDefinition,
  PluginExportProfileRegistryEntry,
  PluginImportProfileDefinition,
  PluginImportProfileRegistryEntry,
  PluginJobTypeDefinition,
  PluginJobTypeRegistryEntry,
} from './plugin-operations.js';

export type BuildTimeRegistryInput = {
  readonly plugins?: readonly PluginDefinition[];
  readonly adminResources?: readonly AdminResourceDefinition[];
  readonly pluginExtensionTiers?: ReadonlyMap<string, PluginExtensionTier>;
};

export type BuildTimeRegistry = {
  readonly plugins: readonly PluginDefinition[];
  readonly pluginRegistry: ReadonlyMap<string, PluginDefinition>;
  readonly pluginActionRegistry: ReadonlyMap<string, PluginActionRegistryEntry>;
  readonly pluginServerHandlerRegistry: ReadonlyMap<string, PluginServerHandlerRegistryEntry>;
  readonly pluginAuditEventRegistry: ReadonlyMap<string, PluginAuditEventRegistryEntry>;
  readonly pluginPermissionRegistry: ReadonlyMap<string, PluginPermissionRegistryEntry>;
  readonly pluginModuleIamRegistry: ReadonlyMap<string, PluginModuleIamRegistryEntry>;
  readonly pluginJobTypeRegistry: ReadonlyMap<string, PluginJobTypeRegistryEntry>;
  readonly pluginImportProfileRegistry: ReadonlyMap<string, PluginImportProfileRegistryEntry>;
  readonly pluginExportProfileRegistry: ReadonlyMap<string, PluginExportProfileRegistryEntry>;
  readonly pluginTenantLifecycleRegistry: ReadonlyMap<string, PluginTenantLifecycleRegistryEntry>;
  readonly pluginExternalInterfaceTypeRegistry: ReadonlyMap<
    string,
    PluginExternalInterfaceTypeRegistryEntry
  >;
  readonly pluginPermissions: readonly PluginPermissionDefinition[];
  readonly pluginModuleIamContracts: readonly PluginModuleIamRegistryEntry[];
  readonly jobTypes: readonly PluginJobTypeDefinition[];
  readonly importProfiles: readonly PluginImportProfileDefinition[];
  readonly exportProfiles: readonly PluginExportProfileDefinition[];
  readonly tenantLifecycles: readonly PluginTenantLifecycleRegistryEntry[];
  readonly externalInterfaceTypes: readonly PluginExternalInterfaceTypeDefinition[];
  readonly routes: readonly PluginRouteDefinition[];
  readonly platformRoutes: readonly PluginRouteDefinition[];
  readonly tenantRoutes: readonly PluginRouteDefinition[];
  readonly navigation: readonly PluginNavigationItem[];
  readonly platformNavigation: readonly PluginNavigationItem[];
  readonly tenantNavigation: readonly PluginNavigationItem[];
  readonly contentTypes: readonly ContentTypeDefinition[];
  readonly studioContentTypes: readonly RegisteredStudioContentType[];
  readonly mainserverGenericTypeRegistry: ReadonlyMap<string, string>;
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
  readonly studioContentTypes: readonly RegisteredStudioContentType[];
  readonly mainserverGenericTypeRegistry: ReadonlyMap<string, string>;
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
  readonly platformRoutes: readonly PluginRouteDefinition[];
  readonly tenantRoutes: readonly PluginRouteDefinition[];
  readonly navigation: readonly PluginNavigationItem[];
  readonly platformNavigation: readonly PluginNavigationItem[];
  readonly tenantNavigation: readonly PluginNavigationItem[];
  readonly pluginActionRegistry: ReadonlyMap<string, PluginActionRegistryEntry>;
  readonly pluginServerHandlerRegistry: ReadonlyMap<string, PluginServerHandlerRegistryEntry>;
};

type PermissionPhaseOutput = {
  readonly pluginPermissions: readonly PluginPermissionDefinition[];
  readonly pluginPermissionRegistry: ReadonlyMap<string, PluginPermissionRegistryEntry>;
  readonly pluginModuleIamContracts: readonly PluginModuleIamRegistryEntry[];
  readonly pluginModuleIamRegistry: ReadonlyMap<string, PluginModuleIamRegistryEntry>;
};

type OperationsPhaseOutput = {
  readonly jobTypes: readonly PluginJobTypeDefinition[];
  readonly importProfiles: readonly PluginImportProfileDefinition[];
  readonly exportProfiles: readonly PluginExportProfileDefinition[];
  readonly externalInterfaceTypes: readonly PluginExternalInterfaceTypeDefinition[];
  readonly pluginJobTypeRegistry: ReadonlyMap<string, PluginJobTypeRegistryEntry>;
  readonly pluginImportProfileRegistry: ReadonlyMap<string, PluginImportProfileRegistryEntry>;
  readonly pluginExportProfileRegistry: ReadonlyMap<string, PluginExportProfileRegistryEntry>;
  readonly pluginTenantLifecycleRegistry: ReadonlyMap<string, PluginTenantLifecycleRegistryEntry>;
  readonly pluginExternalInterfaceTypeRegistry: ReadonlyMap<
    string,
    PluginExternalInterfaceTypeRegistryEntry
  >;
  readonly tenantLifecycles: readonly PluginTenantLifecycleRegistryEntry[];
};

const validateAdminResourceContentTypes = (
  adminResources: readonly AdminResourceDefinition[],
  contentTypes: readonly ContentTypeDefinition[]
): void => {
  const registeredContentTypes = new Set(contentTypes.map((definition) => definition.contentType));

  for (const resource of adminResources) {
    const contentType = resource.contentUi?.contentType;
    if (!contentType) {
      continue;
    }

    if (!registeredContentTypes.has(contentType)) {
      throw new Error(`unknown_admin_resource_content_type:${resource.resourceId}:${contentType}`);
    }
  }
};

const runPreflightPhase = (
  plugins: readonly PluginDefinition[],
  pluginExtensionTiers: ReadonlyMap<string, PluginExtensionTier> | undefined
): PreflightPhaseOutput => {
  const pluginRegistry = createPluginRegistry(plugins, { extensionTiers: pluginExtensionTiers });

  return {
    plugins: Array.from(pluginRegistry.values()),
    pluginRegistry,
  };
};

const runContentPhase = (plugins: readonly PluginDefinition[]): ContentPhaseOutput => {
  const contentTypes = mergePluginContentTypes(plugins);

  return {
    contentTypes,
    studioContentTypes: collectRegisteredStudioContentTypes(contentTypes),
    mainserverGenericTypeRegistry: createMainserverGenericTypeRegistry(contentTypes),
  };
};

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
  pluginModuleIamContracts: mergePluginModuleIamContracts(plugins),
  pluginModuleIamRegistry: createPluginModuleIamRegistry(plugins),
});

const runOperationsPhase = (plugins: readonly PluginDefinition[]): OperationsPhaseOutput => ({
  jobTypes: mergePluginJobTypes(plugins),
  importProfiles: mergePluginImportProfiles(plugins),
  exportProfiles: mergePluginExportProfiles(plugins),
  externalInterfaceTypes: mergePluginExternalInterfaceTypes(plugins),
  pluginJobTypeRegistry: createPluginJobTypeRegistry(plugins),
  pluginImportProfileRegistry: createPluginImportProfileRegistry(plugins),
  pluginExportProfileRegistry: createPluginExportProfileRegistry(plugins),
  pluginTenantLifecycleRegistry: createPluginTenantLifecycleRegistry(plugins),
  pluginExternalInterfaceTypeRegistry: createPluginExternalInterfaceTypeRegistry(plugins),
  tenantLifecycles: mergePluginTenantLifecycles(plugins),
});

const runRoutingPhase = (plugins: readonly PluginDefinition[]): RoutingPhaseOutput => {
  const routes = mergePluginRouteDefinitions(plugins);
  const navigation = mergePluginNavigationItems(plugins);
  return {
    routes,
    platformRoutes: routes.filter((route) => route.accessRequirement?.kind === 'platform'),
    tenantRoutes: routes.filter((route) => route.accessRequirement?.kind !== 'platform'),
    navigation,
    platformNavigation: navigation.filter((item) => item.accessRequirement?.kind === 'platform'),
    tenantNavigation: navigation.filter((item) => item.accessRequirement?.kind !== 'platform'),
    pluginActionRegistry: createPluginActionRegistry(plugins),
    pluginServerHandlerRegistry: createPluginServerHandlerRegistry(plugins),
  };
};

const publishBuildTimeRegistry = ({
  preflight,
  content,
  admin,
  audit,
  routing,
  permissions,
  operations,
}: {
  readonly preflight: PreflightPhaseOutput;
  readonly content: ContentPhaseOutput;
  readonly admin: AdminPhaseOutput;
  readonly audit: AuditPhaseOutput;
  readonly routing: RoutingPhaseOutput;
  readonly permissions: PermissionPhaseOutput;
  readonly operations: OperationsPhaseOutput;
}): BuildTimeRegistry => ({
  plugins: preflight.plugins,
  pluginRegistry: preflight.pluginRegistry,
  pluginActionRegistry: routing.pluginActionRegistry,
  pluginServerHandlerRegistry: routing.pluginServerHandlerRegistry,
  pluginAuditEventRegistry: audit.pluginAuditEventRegistry,
  pluginPermissionRegistry: permissions.pluginPermissionRegistry,
  pluginModuleIamRegistry: permissions.pluginModuleIamRegistry,
  pluginJobTypeRegistry: operations.pluginJobTypeRegistry,
  pluginImportProfileRegistry: operations.pluginImportProfileRegistry,
  pluginExportProfileRegistry: operations.pluginExportProfileRegistry,
  pluginTenantLifecycleRegistry: operations.pluginTenantLifecycleRegistry,
  pluginExternalInterfaceTypeRegistry: operations.pluginExternalInterfaceTypeRegistry,
  pluginPermissions: permissions.pluginPermissions,
  pluginModuleIamContracts: permissions.pluginModuleIamContracts,
  jobTypes: operations.jobTypes,
  importProfiles: operations.importProfiles,
  exportProfiles: operations.exportProfiles,
  tenantLifecycles: operations.tenantLifecycles,
  externalInterfaceTypes: operations.externalInterfaceTypes,
  routes: routing.routes,
  platformRoutes: routing.platformRoutes,
  tenantRoutes: routing.tenantRoutes,
  navigation: routing.navigation,
  platformNavigation: routing.platformNavigation,
  tenantNavigation: routing.tenantNavigation,
  contentTypes: content.contentTypes,
  studioContentTypes: content.studioContentTypes,
  mainserverGenericTypeRegistry: content.mainserverGenericTypeRegistry,
  auditEvents: audit.auditEvents,
  translations: mergePluginTranslations(preflight.plugins),
  adminResources: admin.adminResources,
  adminResourceRegistry: admin.adminResourceRegistry,
});

export const createBuildTimeRegistry = ({
  plugins = [],
  adminResources = [],
  pluginExtensionTiers,
}: BuildTimeRegistryInput): BuildTimeRegistry => {
  const preflight = runPreflightPhase(plugins, pluginExtensionTiers);
  const content = runContentPhase(preflight.plugins);
  const admin = runAdminPhase(preflight.plugins, adminResources);
  validateAdminResourceContentTypes(admin.adminResources, content.contentTypes);
  const audit = runAuditPhase(preflight.plugins);
  const permissions = runPermissionPhase(preflight.plugins);
  const operations = runOperationsPhase(preflight.plugins);
  const routing = runRoutingPhase(preflight.plugins);

  return publishBuildTimeRegistry({
    preflight,
    content,
    admin,
    audit,
    routing,
    permissions,
    operations,
  });
};
