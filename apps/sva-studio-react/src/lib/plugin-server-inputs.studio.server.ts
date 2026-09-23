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
export const nodeManifestModules: Record<string, PluginManifest> = {};
export const nodeServerModuleLoaders: Record<string, () => Promise<PluginServerModuleExports>> = {};
