import type { StudioPluginCatalogConfigEntry } from './plugin-catalog-loader.js';

export const studioDistributions = ['studio', 'ssf'] as const;

export type StudioDistribution = (typeof studioDistributions)[number];

const ssfPluginIds = new Set(['ssf']);
const ssfModuleIds = new Set(['ssf', 'media']);

export const resolveStudioDistribution = (value: string | undefined): StudioDistribution => {
  const normalized = value?.trim();
  if (!normalized || normalized === 'studio') return 'studio';
  if (normalized === 'ssf') return 'ssf';
  throw new Error(`invalid_studio_distribution:${normalized}`);
};

export const filterPluginCatalogForDistribution = (
  catalog: readonly StudioPluginCatalogConfigEntry[],
  distribution: StudioDistribution
): readonly StudioPluginCatalogConfigEntry[] =>
  distribution === 'studio'
    ? catalog.filter(({ pluginId }) => !ssfPluginIds.has(pluginId))
    : catalog.filter(({ pluginId }) => ssfPluginIds.has(pluginId));

export const filterModuleContractsForDistribution = <T extends Readonly<{ moduleId: string }>>(
  contracts: readonly T[],
  distribution: StudioDistribution
): readonly T[] =>
  distribution === 'studio'
    ? contracts.filter(({ moduleId }) => moduleId !== 'ssf')
    : contracts.filter(({ moduleId }) => ssfModuleIds.has(moduleId));
