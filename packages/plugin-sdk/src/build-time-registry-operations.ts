import {
  createPluginExternalInterfaceTypeRegistry,
  mergePluginExternalInterfaceTypes,
  type PluginExternalInterfaceTypeDefinition,
  type PluginExternalInterfaceTypeRegistryEntry,
} from './external-interfaces.js';
import {
  createPluginExportProfileRegistry,
  createPluginImportProfileRegistry,
  createPluginJobTypeRegistry,
  mergePluginExportProfiles,
  mergePluginImportProfiles,
  mergePluginJobTypes,
  type PluginExportProfileDefinition,
  type PluginExportProfileRegistryEntry,
  type PluginImportProfileDefinition,
  type PluginImportProfileRegistryEntry,
  type PluginJobTypeDefinition,
  type PluginJobTypeRegistryEntry,
} from './plugin-operations.js';
import {
  createPluginTenantLifecycleRegistry,
  mergePluginTenantLifecycles,
  type PluginTenantLifecycleRegistryEntry,
} from './plugin-tenant-lifecycle.js';
import type { PluginDefinition } from './plugins.js';

export type OperationsPhaseOutput = {
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

export const runOperationsPhase = (
  plugins: readonly PluginDefinition[]
): OperationsPhaseOutput => ({
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
