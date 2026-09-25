import type { PluginManifest } from '@sva/plugin-sdk';
export { pluginCatalogConfig } from '#studio-plugin-catalog-inputs';

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

export const nodeManifestModules = {
  ...import.meta.glob(
    ['../../../../node_modules/*/plugin.manifest.json', '!../../../../node_modules/plugin-ssf/**'],
    {
      eager: true,
      import: 'default',
    }
  ),
  ...import.meta.glob(
    [
      '../../../../node_modules/@*/*/plugin.manifest.json',
      '!../../../../node_modules/@*/plugin-ssf/**',
    ],
    {
      eager: true,
      import: 'default',
    }
  ),
} as Record<string, PluginManifest>;

export const nodePluginModuleLoaders = {
  ...import.meta.glob([
    '../../../../node_modules/plugin-*/dist/index.js',
    '../../../../node_modules/plugin-*/src/index.ts',
    '../../../../node_modules/plugin-*/src/index.tsx',
    '!../../../../node_modules/plugin-ssf/**',
  ]),
  ...import.meta.glob([
    '../../../../node_modules/@*/plugin-*/dist/index.js',
    '../../../../node_modules/@*/plugin-*/src/index.ts',
    '../../../../node_modules/@*/plugin-*/src/index.tsx',
    '!../../../../node_modules/@*/plugin-ssf/**',
  ]),
} as Record<string, () => Promise<Record<string, unknown>>>;
