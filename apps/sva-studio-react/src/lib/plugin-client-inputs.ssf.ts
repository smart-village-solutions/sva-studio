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
export const workspaceDescriptorModuleLoaders = import.meta.glob(
  '../../../../packages/plugin-ssf/src/descriptor.ts'
) as Record<string, () => Promise<Record<string, unknown>>>;

export {
  nodeManifestModules,
  nodePluginModuleLoaders,
  nodeDescriptorModuleLoaders,
} from 'virtual:studio-installed-plugin-client';
