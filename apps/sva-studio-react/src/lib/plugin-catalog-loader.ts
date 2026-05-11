import {
  definePluginCatalogEntry,
  pluginSdkVersion,
  resolvePluginCatalogAsync,
  type AdminResourceDefinition,
  type PluginCatalogEntry,
  type PluginCatalogIssue,
  type PluginCatalogSourceType,
  type PluginDefinition,
  type PluginManifest,
  type PluginManifestCapability,
  type PluginPlatformHost,
  type ResolvedPluginCatalog,
} from '@sva/plugin-sdk';

export type StudioPluginCatalogConfigEntry = {
  readonly pluginId: string;
  readonly sourceType: PluginCatalogSourceType;
  readonly enabled: boolean;
  readonly sourceRef: string;
};

type PluginModuleExports = Readonly<Record<string, unknown>>;

type StudioPluginCatalogLoaderInput = {
  readonly catalogConfig: readonly StudioPluginCatalogConfigEntry[];
  readonly resolveManifest: (entry: StudioPluginCatalogConfigEntry) => PluginManifest | undefined;
  readonly resolvePluginModule: (
    entry: PluginCatalogEntry,
    manifest: PluginManifest
  ) => Promise<PluginModuleExports | undefined>;
  readonly adminResources?: readonly AdminResourceDefinition[];
};

type StudioPluginCatalogReport = ResolvedPluginCatalog & {
  readonly issues: readonly PluginCatalogIssue[];
};

export const studioHostPluginPlatform: PluginPlatformHost = {
  studioVersion: '0.0.1',
  sdkVersion: pluginSdkVersion,
  capabilities: ['routing', 'navigation', 'iam', 'audit', 'jobs', 'imports', 'server'],
};

const createConfigIssue = (
  entry: StudioPluginCatalogConfigEntry,
  code: PluginCatalogIssue['code'],
  message: string
): PluginCatalogIssue => ({
  pluginId: entry.pluginId.trim(),
  sourceType: entry.sourceType,
  sourceRef: entry.sourceRef.trim(),
  severity: 'error',
  code,
  message,
});

const normalizeEntryPath = (value: string): string => value.replace(/^[.][/]/, '').trim();

export const getWorkspacePluginModuleCandidates = (manifest: PluginManifest): readonly string[] => {
  const manifestBrowserEntry = normalizeEntryPath(manifest.entryPoints.browser ?? '');
  const candidates = ['src/index.ts', 'src/index.tsx'];

  if (manifestBrowserEntry.length > 0 && !candidates.includes(manifestBrowserEntry)) {
    candidates.push(manifestBrowserEntry);
  }

  return candidates;
};

export const getPackagePluginModuleCandidates = (manifest: PluginManifest): readonly string[] => {
  const manifestBrowserEntry = normalizeEntryPath(manifest.entryPoints.browser ?? '');
  const candidates = manifestBrowserEntry.length > 0 ? [manifestBrowserEntry] : [];

  for (const fallback of ['dist/index.js', 'src/index.ts', 'src/index.tsx']) {
    if (!candidates.includes(fallback)) {
      candidates.push(fallback);
    }
  }

  return candidates;
};

export const extractPluginDefinition = (exportsObject: PluginModuleExports): PluginDefinition | undefined => {
  for (const value of Object.values(exportsObject)) {
    if (!value || typeof value !== 'object') {
      continue;
    }

    const candidate = value as Partial<PluginDefinition>;
    if (typeof candidate.id === 'string' && typeof candidate.displayName === 'string') {
      return candidate as PluginDefinition;
    }
  }

  return undefined;
};

export const createStudioPluginCatalogReport = async (
  input: StudioPluginCatalogLoaderInput
): Promise<StudioPluginCatalogReport> => {
  const catalog: PluginCatalogEntry[] = [];
  const issues: PluginCatalogIssue[] = [];

  for (const rawEntry of input.catalogConfig) {
    const manifest = input.resolveManifest(rawEntry);
    if (!manifest) {
      issues.push(
        createConfigIssue(
          rawEntry,
          'plugin_module_missing',
          `Plugin '${rawEntry.pluginId}' referenziert kein ladbares Manifest unter '${rawEntry.sourceRef}'.`
        )
      );
      continue;
    }

    catalog.push(
      definePluginCatalogEntry({
        pluginId: rawEntry.pluginId,
        sourceType: rawEntry.sourceType,
        enabled: rawEntry.enabled,
        sourceRef: rawEntry.sourceRef,
        manifest,
      })
    );
  }

  const resolved = await resolvePluginCatalogAsync({
    catalog,
    host: studioHostPluginPlatform,
    resolvePlugin: async (entry) => {
      const exportsObject = await input.resolvePluginModule(entry, entry.manifest);
      return exportsObject ? extractPluginDefinition(exportsObject) : undefined;
    },
    adminResources: input.adminResources,
  });

  return {
    ...resolved,
    issues: [...issues, ...resolved.issues],
  };
};

export const getSupportedHostCapabilities = (): readonly PluginManifestCapability[] => studioHostPluginPlatform.capabilities;
