import type { StudioPluginCatalogConfigEntry } from './plugin-catalog-loader.js';

export const studioDistributions = ['studio', 'ssf', 'custom'] as const;

export type StudioDistribution = (typeof studioDistributions)[number];

export const resolveStudioPluginIds = (
  distribution: StudioDistribution,
  pluginIdsInput: string | undefined,
  availablePluginIds: readonly string[]
): readonly string[] => {
  if (distribution === 'studio') {
    return availablePluginIds.filter((pluginId) => pluginId !== 'ssf');
  }
  if (distribution === 'ssf') return ['ssf'];

  const supplied = pluginIdsInput?.split(',').map((pluginId) => pluginId.trim()) ?? [];
  if (supplied.length === 0 || supplied.some((pluginId) => !pluginId)) {
    throw new Error('studio_plugin_selection_required');
  }
  if (new Set(supplied).size !== supplied.length) {
    throw new Error('studio_plugin_selection_duplicate');
  }
  const unknown = supplied.filter((pluginId) => !availablePluginIds.includes(pluginId));
  if (unknown.length > 0) {
    throw new Error(`studio_plugin_selection_unknown:${unknown.sort().join(',')}`);
  }
  const selected = new Set(supplied);
  return availablePluginIds.filter((pluginId) => selected.has(pluginId));
};

export const resolveStudioDistribution = (
  value: string | undefined,
  pluginIdsInput?: string
): StudioDistribution => {
  const normalized = value?.trim();
  if (pluginIdsInput?.trim()) {
    if (normalized && normalized !== 'custom') {
      throw new Error(`studio_distribution_and_plugin_selection_conflict:${normalized}`);
    }
    return 'custom';
  }
  if (!normalized || normalized === 'studio') return 'studio';
  if (normalized === 'ssf') return 'ssf';
  if (normalized === 'custom') throw new Error('studio_plugin_selection_required');
  throw new Error(`invalid_studio_distribution:${normalized}`);
};

const ssfPluginIds = new Set(['ssf']);
const ssfModuleIds = new Set(['ssf', 'media']);

export const filterPluginCatalogForDistribution = (
  catalog: readonly StudioPluginCatalogConfigEntry[],
  distribution: StudioDistribution,
  selectedPluginIds: readonly string[] = []
): readonly StudioPluginCatalogConfigEntry[] =>
  distribution === 'custom'
    ? catalog.filter(({ pluginId, sourceType }) =>
        sourceType === 'workspace' ? selectedPluginIds.includes(pluginId) : true
      )
    : distribution === 'studio'
      ? catalog.filter(({ pluginId, sourceType }) =>
          sourceType === 'workspace' ? !ssfPluginIds.has(pluginId) : true
        )
      : catalog.filter(({ pluginId, sourceType }) =>
          sourceType === 'workspace' ? ssfPluginIds.has(pluginId) : true
        );

export const filterModuleContractsForDistribution = <T extends Readonly<{ moduleId: string }>>(
  contracts: readonly T[],
  distribution: StudioDistribution,
  selectedPluginIds: readonly string[] = []
): readonly T[] =>
  distribution === 'custom'
    ? contracts.filter(
        ({ moduleId }) => moduleId === 'media' || selectedPluginIds.includes(moduleId)
      )
    : distribution === 'studio'
      ? contracts.filter(({ moduleId }) => moduleId !== 'ssf')
      : contracts.filter(({ moduleId }) => ssfModuleIds.has(moduleId));
