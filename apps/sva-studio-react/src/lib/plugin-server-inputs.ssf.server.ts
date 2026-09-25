import type { PluginManifest } from '@sva/plugin-sdk';

type PluginServerModuleExports = Readonly<Record<string, unknown>>;

export const workspaceManifestModules = import.meta.glob(
  '../../../../packages/plugin-ssf/plugin.manifest.json',
  { eager: true, import: 'default' }
) as Record<string, PluginManifest>;
export const workspaceServerModuleLoaders = {
  ...import.meta.glob('../../../../packages/plugin-ssf/src/server.ts'),
  ...import.meta.glob('../../../../packages/plugin-ssf/src/server/index.ts'),
} as Record<string, () => Promise<PluginServerModuleExports>>;
export const nodeManifestModules: Record<string, PluginManifest> = {};
export const nodeServerModuleLoaders: Record<string, () => Promise<PluginServerModuleExports>> = {};
