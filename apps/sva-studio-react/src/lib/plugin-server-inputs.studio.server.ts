import type { PluginManifest } from '@sva/plugin-sdk';

type PluginServerModuleExports = Readonly<Record<string, unknown>>;

export const workspaceManifestModules = import.meta.glob(
  [
    '../../../../packages/plugin-*/plugin.manifest.json',
    '!../../../../packages/plugin-ssf/plugin.manifest.json',
  ],
  { eager: true, import: 'default' }
) as Record<string, PluginManifest>;
export const workspaceServerModuleLoaders = {
  ...import.meta.glob([
    '../../../../packages/plugin-*/src/server.ts',
    '../../../../packages/plugin-*/src/server/index.ts',
    '!../../../../packages/plugin-ssf/src/**',
  ]),
} as Record<string, () => Promise<PluginServerModuleExports>>;
export const workspaceDescriptorModuleLoaders = {
  ...import.meta.glob([
    '../../../../packages/plugin-*/src/plugin.tsx',
    '../../../../packages/plugin-*/src/descriptor.ts',
    '!../../../../packages/plugin-ssf/src/**',
    '!../../../../packages/plugin-waste-management/src/plugin.tsx',
  ]),
} as Record<string, () => Promise<PluginServerModuleExports>>;
export const nodeManifestModules = {
  ...import.meta.glob(
    ['../../../../node_modules/*/plugin.manifest.json', '!../../../../node_modules/plugin-ssf/**'],
    { eager: true, import: 'default' }
  ),
  ...import.meta.glob(
    [
      '../../../../node_modules/@*/*/plugin.manifest.json',
      '!../../../../node_modules/@*/plugin-ssf/**',
    ],
    { eager: true, import: 'default' }
  ),
} as Record<string, PluginManifest>;
export const nodeServerModuleLoaders: Record<string, () => Promise<PluginServerModuleExports>> = {};
export const nodeDescriptorModuleLoaders = {
  ...import.meta.glob([
    '../../../../node_modules/plugin-*/dist/plugin.js',
    '../../../../node_modules/plugin-*/dist/descriptor.js',
    '!../../../../node_modules/plugin-ssf/**',
  ]),
  ...import.meta.glob([
    '../../../../node_modules/@*/plugin-*/dist/plugin.js',
    '../../../../node_modules/@*/plugin-*/dist/descriptor.js',
    '!../../../../node_modules/@*/plugin-ssf/**',
  ]),
} as Record<string, () => Promise<PluginServerModuleExports>>;
