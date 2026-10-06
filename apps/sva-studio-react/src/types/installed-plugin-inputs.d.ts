declare module 'virtual:studio-installed-plugin-catalog' {
  import type { StudioPluginCatalogConfigEntry } from '../lib/plugin-catalog-loader.js';
  export const installedPluginCatalogConfig: readonly StudioPluginCatalogConfigEntry[];
}

declare module 'virtual:studio-installed-plugin-client' {
  import type { PluginManifest } from '@sva/plugin-sdk';
  export const nodeManifestModules: Readonly<Record<string, PluginManifest>>;
  export const nodePluginModuleLoaders: Readonly<Record<string, () => Promise<Record<string, unknown>>>>;
  export const nodeDescriptorModuleLoaders: Readonly<Record<string, () => Promise<Record<string, unknown>>>>;
}

declare module 'virtual:studio-installed-plugin-server' {
  import type { PluginManifest } from '@sva/plugin-sdk';
  export const nodeManifestModules: Readonly<Record<string, PluginManifest>>;
  export const nodeDescriptorModuleLoaders: Readonly<Record<string, () => Promise<Record<string, unknown>>>>;
  export const nodeServerModuleLoaders: Readonly<Record<string, () => Promise<Record<string, unknown>>>>;
  export const nodeJobModuleLoaders: Readonly<Record<string, () => Promise<Record<string, unknown>>>>;
}
