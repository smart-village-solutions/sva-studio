import type { PluginManifest } from '@sva/plugin-sdk';

type PluginModuleLoader = () => Promise<Record<string, unknown>>;
export { nodeJobModuleLoaders, nodeManifestModules } from 'virtual:studio-installed-plugin-server';

export const workspaceJobModuleLoaders = import.meta.glob([
  '../../../../packages/plugin-*/src/server.ts',
  '!../../../../packages/plugin-ssf/src/**',
]) as Record<string, PluginModuleLoader>;

export const workspaceManifestModules = import.meta.glob(
  [
    '../../../../packages/plugin-*/plugin.manifest.json',
    '!../../../../packages/plugin-ssf/plugin.manifest.json',
  ],
  { eager: true, import: 'default' }
) as Record<string, PluginManifest>;
