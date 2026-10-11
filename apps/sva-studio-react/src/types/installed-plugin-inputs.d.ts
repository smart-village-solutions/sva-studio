declare module 'virtual:studio-installed-plugin-catalog' {
  import type { StudioPluginCatalogConfigEntry } from '../lib/plugin-catalog-loader.js';
  export const installedPluginCatalogConfig: readonly StudioPluginCatalogConfigEntry[];
}

declare module 'virtual:studio-installed-plugin-client' {
  import type { PluginManifest } from '@sva/plugin-sdk';
  export const nodeManifestModules: Readonly<Record<string, PluginManifest>>;
  export const nodePluginModuleLoaders: Readonly<
    Record<string, () => Promise<Record<string, unknown>>>
  >;
  export const nodeDescriptorModuleLoaders: Readonly<
    Record<string, () => Promise<Record<string, unknown>>>
  >;
}

declare module 'virtual:studio-installed-plugin-server' {
  import type { PluginManifest } from '@sva/plugin-sdk';
  export const nodeManifestModules: Readonly<Record<string, PluginManifest>>;
  export const nodeDescriptorModuleLoaders: Readonly<
    Record<string, () => Promise<Record<string, unknown>>>
  >;
  export const nodeServerModuleLoaders: Readonly<
    Record<string, () => Promise<Record<string, unknown>>>
  >;
  export const nodeJobModuleLoaders: Readonly<
    Record<string, () => Promise<Record<string, unknown>>>
  >;
}

declare module '#studio-plugin-runtime-factories' {
  export const selectedPluginJobRuntimeFactories: Readonly<Record<string, () => unknown>>;
}
declare module 'virtual:studio-module-publiccode' {
  export const modulePublicCode: Readonly<
    Record<
      string,
      Readonly<{
        name: string;
        description: Readonly<
          Record<
            string,
            Readonly<{
              localisedName?: string;
              shortDescription: string;
            }>
          >
        >;
      }>
    >
  >;
}
