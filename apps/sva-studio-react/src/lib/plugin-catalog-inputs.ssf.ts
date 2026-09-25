import type { StudioPluginCatalogConfigEntry } from './plugin-catalog-loader.js';

export const pluginCatalogConfig = [
  { pluginId: 'ssf', sourceType: 'workspace', enabled: true, sourceRef: 'packages/plugin-ssf' },
] as const satisfies readonly StudioPluginCatalogConfigEntry[];
