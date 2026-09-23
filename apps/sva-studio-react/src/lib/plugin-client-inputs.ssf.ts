import type { PluginManifest } from '@sva/plugin-sdk';

export { pluginCatalogConfig } from '#studio-plugin-catalog-inputs';

export const workspaceManifestModules = import.meta.glob(
  '../../../../packages/plugin-ssf/plugin.manifest.json',
  { eager: true, import: 'default' }
) as Record<string, PluginManifest>;

export const workspacePluginModuleLoaders = {
  ...import.meta.glob('../../../../packages/plugin-ssf/src/browser.ts'),
  ...import.meta.glob('../../../../packages/plugin-ssf/src/index.ts'),
} as Record<string, () => Promise<Record<string, unknown>>>;

export const nodeManifestModules: Record<string, PluginManifest> = {};
export const nodePluginModuleLoaders: Record<string, () => Promise<Record<string, unknown>>> = {};
