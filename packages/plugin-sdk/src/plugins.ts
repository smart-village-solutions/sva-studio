export {
  definePluginPermissions,
  definePluginAuditEvents,
  definePluginModuleIamContract,
} from './plugin-iam-definitions.js';
export { definePluginActions } from './plugin-definition-validation.js';
export { collectPluginAccessTransitionDiagnostics } from './plugin-access-diagnostics.js';
export * from './plugin-registry-aggregation.js';
export { mergePluginTranslations } from './plugin-translations.js';
export type * from './plugin-registry-types.js';
export type * from './plugin-definition-types.js';
import type { PluginDefinition } from './plugin-definition-types.js';
import type { PluginExtensionTier } from './plugin-platform/contracts.js';
import type { PluginRegistryValidationContext } from './plugin-registry-actions.js';
import {
  createPluginRegistryValidationContext,
  assertPluginRegistryActions,
  assertPluginRegistryServerHandlers,
} from './plugin-registry-actions.js';
import {
  assertPluginRegistryRoutes,
  assertPluginRegistryStandardContentRouteGuardrails,
  assertPluginRegistryNavigation,
  normalizePluginRegistryRouteDocumentation,
} from './plugin-registry-routes.js';
import {
  assertPluginRegistryPermissions,
  assertPluginRegistryContentTypes,
  assertPluginRegistryContentHistory,
  assertPluginRegistryAdminResources,
  assertPluginRegistryAuditEvents,
  assertPluginRegistryModuleIam,
} from './plugin-registry-content.js';
import { definePluginExternalInterfaceTypes } from './external-interfaces.js';
import {
  definePluginExportProfiles,
  definePluginImportProfiles,
  definePluginJobTypes,
} from './plugin-operations.js';
import { definePluginTenantLifecycle } from './plugin-tenant-lifecycle.js';

const normalizePluginRegistryOperations = ({
  plugin,
  pluginNamespace,
}: PluginRegistryValidationContext): Pick<
  PluginDefinition,
  'jobTypes' | 'importProfiles' | 'exportProfiles' | 'externalInterfaceTypes' | 'tenantLifecycle'
> => ({
  jobTypes: plugin.jobTypes
    ? definePluginJobTypes(pluginNamespace, plugin.jobTypes)
    : plugin.jobTypes,
  importProfiles: plugin.importProfiles
    ? definePluginImportProfiles(pluginNamespace, plugin.importProfiles)
    : plugin.importProfiles,
  exportProfiles: plugin.exportProfiles
    ? definePluginExportProfiles(pluginNamespace, plugin.exportProfiles)
    : plugin.exportProfiles,
  externalInterfaceTypes: plugin.externalInterfaceTypes
    ? definePluginExternalInterfaceTypes(pluginNamespace, plugin.externalInterfaceTypes)
    : plugin.externalInterfaceTypes,
  tenantLifecycle: plugin.tenantLifecycle
    ? definePluginTenantLifecycle(pluginNamespace, plugin.tenantLifecycle, plugin.jobTypes ?? [])
    : plugin.tenantLifecycle,
});

export const createPluginRegistry = (
  plugins: readonly PluginDefinition[],
  options: {
    readonly extensionTiers?: ReadonlyMap<string, PluginExtensionTier>;
  } = {}
): ReadonlyMap<string, PluginDefinition> => {
  const registry = new Map<string, PluginDefinition>();

  for (const plugin of plugins) {
    const context = createPluginRegistryValidationContext(plugin, registry, options.extensionTiers);
    const normalizedOperations = normalizePluginRegistryOperations(context);

    assertPluginRegistryActions(context);
    assertPluginRegistryServerHandlers(context);
    assertPluginRegistryRoutes(context);
    assertPluginRegistryStandardContentRouteGuardrails(context);
    assertPluginRegistryNavigation(context);
    assertPluginRegistryPermissions(context);
    assertPluginRegistryContentTypes(context);
    assertPluginRegistryContentHistory(context);
    assertPluginRegistryAdminResources(context);
    assertPluginRegistryAuditEvents(context);
    assertPluginRegistryModuleIam(context);
    const normalizedRoutes = normalizePluginRegistryRouteDocumentation(context);

    registry.set(context.pluginNamespace, {
      ...plugin,
      id: context.pluginNamespace,
      displayName: context.displayName,
      routes: normalizedRoutes,
      ...normalizedOperations,
    });
  }

  return registry;
};
