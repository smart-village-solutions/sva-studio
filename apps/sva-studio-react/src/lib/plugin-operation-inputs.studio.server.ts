import type { PluginManifest } from '@sva/plugin-sdk';

type PluginModuleLoader = () => Promise<Record<string, unknown>>;

export const workspaceJobModuleLoaders = import.meta.glob([
  '../../../../packages/plugin-*/src/server.ts',
  '!../../../../packages/plugin-ssf/src/**',
]) as Record<string, PluginModuleLoader>;

export const workspacePluginModuleLoaders = {
  ...import.meta.glob([
    '../../../../packages/plugin-*/src/index.ts',
    '../../../../packages/plugin-*/src/index.tsx',
    '!../../../../packages/plugin-ssf/src/**',
  ]),
} as Record<string, PluginModuleLoader>;

export const nodeJobModuleLoaders = {
  ...import.meta.glob('../../../../node_modules/plugin-*/dist/server.js'),
  ...import.meta.glob('../../../../node_modules/plugin-*/src/server.ts'),
  ...import.meta.glob('../../../../node_modules/@*/plugin-*/dist/server.js'),
  ...import.meta.glob('../../../../node_modules/@*/plugin-*/src/server.ts'),
} as Record<string, PluginModuleLoader>;

export const nodePluginModuleLoaders = {
  ...import.meta.glob('../../../../node_modules/plugin-*/dist/index.js'),
  ...import.meta.glob('../../../../node_modules/plugin-*/src/index.ts'),
  ...import.meta.glob('../../../../node_modules/plugin-*/src/index.tsx'),
  ...import.meta.glob('../../../../node_modules/@*/plugin-*/dist/index.js'),
  ...import.meta.glob('../../../../node_modules/@*/plugin-*/src/index.ts'),
  ...import.meta.glob('../../../../node_modules/@*/plugin-*/src/index.tsx'),
} as Record<string, PluginModuleLoader>;

export const workspaceManifestModules = import.meta.glob(
  [
    '../../../../packages/plugin-*/plugin.manifest.json',
    '!../../../../packages/plugin-ssf/plugin.manifest.json',
  ],
  { eager: true, import: 'default' }
) as Record<string, PluginManifest>;

export const nodeManifestModules = {
  ...import.meta.glob('../../../../node_modules/*/plugin.manifest.json', {
    eager: true,
    import: 'default',
  }),
  ...import.meta.glob('../../../../node_modules/@*/*/plugin.manifest.json', {
    eager: true,
    import: 'default',
  }),
} as Record<string, PluginManifest>;
