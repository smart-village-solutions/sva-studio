export type PluginManifestCapability =
  | 'routing'
  | 'navigation'
  | 'iam'
  | 'audit'
  | 'jobs'
  | 'imports'
  | 'server'
  | 'integrations';

export type PluginManifest = {
  readonly pluginId: string;
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
