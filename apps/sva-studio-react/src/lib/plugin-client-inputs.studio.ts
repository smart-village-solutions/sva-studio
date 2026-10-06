import type { PluginManifest } from '@sva/plugin-sdk';
export { pluginCatalogConfig } from '#studio-plugin-catalog-inputs';
export {
  nodeManifestModules,
  nodePluginModuleLoaders,
  nodeDescriptorModuleLoaders,
} from 'virtual:studio-installed-plugin-client';

export const workspaceManifestModules = import.meta.glob(
  [
    '../../../../packages/plugin-*/plugin.manifest.json',
    '!../../../../packages/plugin-ssf/plugin.manifest.json',
  ],
  { eager: true, import: 'default' }
) as Record<string, PluginManifest>;

export const workspacePluginModuleLoaders = {
  ...import.meta.glob([
    '../../../../packages/plugin-*/src/browser.ts',
    '../../../../packages/plugin-*/src/browser.tsx',
    '../../../../packages/plugin-*/src/index.ts',
    '../../../../packages/plugin-*/src/index.tsx',
    '!../../../../packages/plugin-ssf/src/**',
  ]),
} as Record<string, () => Promise<Record<string, unknown>>>;

export const workspaceDescriptorModuleLoaders = import.meta.glob([
  '../../../../packages/plugin-*/src/plugin.tsx',
  '../../../../packages/plugin-*/src/descriptor.ts',
  '!../../../../packages/plugin-ssf/src/**',
  '!../../../../packages/plugin-waste-management/src/plugin.tsx',
]) as Record<string, () => Promise<Record<string, unknown>>>;
