import { normalizePluginIdentifier, normalizePluginNamespace } from '../plugin-identifiers.js';
import type { AdminResourceDefinition } from '../admin-resources.js';
import type { BuildTimeRegistry } from '../build-time-registry.js';
import { createBuildTimeRegistry } from '../build-time-registry.js';
import type { PluginDefinition } from '../plugins.js';
import type { PluginCatalogEntry, PluginCatalogSourceType, PluginManifest } from './contracts.js';
import { definePluginCatalogEntry } from './manifest.js';

export type LoadedPluginEntry = {
  readonly catalogEntry: PluginCatalogEntry;
  readonly plugin: PluginDefinition;
};

export type PluginSnapshot = {
  readonly catalog: readonly PluginCatalogEntry[];
  readonly pluginSources: readonly {
    readonly pluginId: string;
    readonly sourceType: PluginCatalogSourceType;
    readonly sourceRef: string;
    readonly manifest: PluginManifest;
  }[];
  readonly registry: BuildTimeRegistry;
};

const buildEnabledCatalogIndex = (catalog: readonly PluginCatalogEntry[]): ReadonlyMap<string, PluginCatalogEntry> =>
  new Map(catalog.filter((entry) => entry.enabled).map((entry) => [entry.pluginId, entry] as const));

const resolveLoadedPluginDefinition = (
  loadedPlugin: LoadedPluginEntry,
  enabledCatalogByPluginId: ReadonlyMap<string, PluginCatalogEntry>
): PluginDefinition => {
  const normalizedPluginId = normalizePluginNamespace(loadedPlugin.plugin.id);
  const normalizedCatalogEntry = definePluginCatalogEntry(loadedPlugin.catalogEntry);
  const enabledCatalogEntry = enabledCatalogByPluginId.get(normalizedPluginId);

  if (!enabledCatalogEntry) {
    throw new Error(`plugin_snapshot_missing_enabled_catalog_entry:${normalizedPluginId}`);
  }
  if (normalizedCatalogEntry.pluginId !== normalizedPluginId) {
    throw new Error(`plugin_snapshot_catalog_plugin_mismatch:${normalizedCatalogEntry.pluginId}:${normalizedPluginId}`);
  }

  return loadedPlugin.plugin;
};

const buildPluginSources = (loadedPlugins: readonly LoadedPluginEntry[]) =>
  loadedPlugins.map(({ catalogEntry }) => {
    const normalizedCatalogEntry = definePluginCatalogEntry(catalogEntry);

    return {
      pluginId: normalizedCatalogEntry.pluginId,
      sourceType: normalizedCatalogEntry.sourceType,
      sourceRef: normalizePluginIdentifier(normalizedCatalogEntry.sourceRef),
      manifest: normalizedCatalogEntry.manifest,
    };
  });

export const createPluginSnapshot = (input: {
  readonly catalog: readonly PluginCatalogEntry[];
  readonly loadedPlugins: readonly LoadedPluginEntry[];
  readonly adminResources?: readonly AdminResourceDefinition[];
}): PluginSnapshot => {
  const catalog = input.catalog.map(definePluginCatalogEntry);
  const enabledCatalogByPluginId = buildEnabledCatalogIndex(catalog);

  return {
    catalog,
    pluginSources: buildPluginSources(input.loadedPlugins),
    registry: createBuildTimeRegistry({
      plugins: input.loadedPlugins.map((loadedPlugin) =>
        resolveLoadedPluginDefinition(loadedPlugin, enabledCatalogByPluginId)
      ),
      adminResources: input.adminResources ?? [],
    }),
  };
};
