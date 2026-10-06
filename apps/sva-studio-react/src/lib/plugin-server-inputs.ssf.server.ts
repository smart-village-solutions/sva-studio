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
export const workspaceDescriptorModuleLoaders = import.meta.glob(
  '../../../../packages/plugin-ssf/src/descriptor.ts'
) as Record<string, () => Promise<PluginServerModuleExports>>;
export {
  nodeManifestModules,
  nodeServerModuleLoaders,
  nodeDescriptorModuleLoaders,
} from 'virtual:studio-installed-plugin-server';
