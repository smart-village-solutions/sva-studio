import type { StudioPluginCatalogConfigEntry } from './plugin-catalog-loader.js';
import { installedPluginCatalogConfig } from 'virtual:studio-installed-plugin-catalog';

export const pluginCatalogConfig = [
  { pluginId: 'ssf', sourceType: 'workspace', enabled: true, sourceRef: 'packages/plugin-ssf' },
  ...installedPluginCatalogConfig,
] as const satisfies readonly StudioPluginCatalogConfigEntry[];
