import type { PluginDefinition } from '../plugins.js';
import type { PluginTenantLifecycleRegistryEntry } from './types.js';

export const mergePluginTenantLifecycles = (
  plugins: readonly PluginDefinition[]
): readonly PluginTenantLifecycleRegistryEntry[] =>
  plugins.flatMap((plugin) =>
    plugin.tenantLifecycle ? [{ pluginId: plugin.id, ...plugin.tenantLifecycle }] : []
  );

export const createPluginTenantLifecycleRegistry = (
  plugins: readonly PluginDefinition[]
): ReadonlyMap<string, PluginTenantLifecycleRegistryEntry> =>
  new Map(
    plugins.flatMap((plugin) =>
      plugin.tenantLifecycle
        ? [[plugin.id, { pluginId: plugin.id, ...plugin.tenantLifecycle }] as const]
        : []
    )
  );
