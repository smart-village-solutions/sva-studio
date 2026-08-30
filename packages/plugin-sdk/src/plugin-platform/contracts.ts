import type { TenantModuleActivationPolicy } from '@sva/core';
export { PLUGIN_ROUTE_SCOPE_HEADER_NAME } from '@sva/core';

export const PLUGIN_PLATFORM_ADMIN_ROLE = 'instance_registry_admin';

export type PluginManifestCapability =
  | 'routing'
  | 'navigation'
  | 'iam'
  | 'audit'
  | 'jobs'
  | 'imports'
  | 'exports'
  | 'server'
  | 'integrations';

export type PluginExtensionTier = 'feature' | 'admin' | 'platform';
export type PluginTenantActivationPolicy = TenantModuleActivationPolicy;

export type PluginManifest = {
  readonly pluginId: string;
  readonly manifestVersion: 1;
  readonly extensionTier: PluginExtensionTier;
  readonly tenantActivationPolicy: PluginTenantActivationPolicy;
  readonly version: string;
  readonly sdkVersion: string;
  readonly hostCompatibility: {
    readonly studioVersionRange: string;
    readonly requiredCapabilities?: readonly PluginManifestCapability[];
  };
  readonly entryPoints: {
    readonly browser?: string;
    readonly server?: string;
    readonly jobs?: string;
    readonly integrations?: string;
  };
  readonly runtimeRequirements?: {
    readonly jobs?: string;
  };
};

export type PluginCatalogSourceType = 'workspace' | 'linked-package' | 'installed-distribution';

export type PluginCatalogEntry = {
  readonly pluginId: string;
  readonly sourceType: PluginCatalogSourceType;
  readonly enabled: boolean;
  readonly sourceRef: string;
  readonly manifest: PluginManifest;
};
