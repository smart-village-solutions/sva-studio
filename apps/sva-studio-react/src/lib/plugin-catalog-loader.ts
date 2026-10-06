import {
  definePluginCatalogEntry,
  pluginSdkVersion,
  resolvePluginCatalogAsync,
  type AdminResourceDefinition,
  type PluginCatalogEntry,
  type PluginCatalogIssue,
  type PluginCatalogSourceType,
  type PluginDescriptor,
  type PluginDefinition,
  type PluginManifest,
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
type PluginCatalogSeed = {
  readonly catalog: readonly PluginCatalogEntry[];
  readonly issues: readonly PluginCatalogIssue[];
};

type StudioPluginCatalogLoaderInput = {
  readonly catalogConfig: readonly StudioPluginCatalogConfigEntry[];
  readonly resolveManifest: (entry: StudioPluginCatalogConfigEntry) => PluginManifest | undefined;
  readonly resolvePluginModule: (
    entry: PluginCatalogEntry,
    manifest: PluginManifest
  ) => Promise<PluginModuleExports | undefined>;
  readonly resolveBrowserModule?: (
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
  capabilities: ['routing', 'navigation', 'iam', 'audit', 'jobs', 'imports', 'exports', 'server'],
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

const pushUnique = (target: string[], value: string): void => {
  if (value.length > 0 && target.includes(value) === false) {
    target.push(value);
  }
};

const createWorkspaceSourceFallbacks = (
  entryPath: string,
  defaults: readonly string[]
): readonly string[] => {
  const candidates: string[] = [];
  pushUnique(candidates, entryPath);

  if (entryPath.startsWith('dist/') && entryPath.endsWith('.js')) {
    const sourceBasePath = entryPath.slice('dist/'.length, -'.js'.length);
    pushUnique(candidates, `src/${sourceBasePath}.ts`);
    pushUnique(candidates, `src/${sourceBasePath}.tsx`);
  } else if (entryPath.endsWith('.js')) {
    pushUnique(candidates, entryPath.slice(0, -'.js'.length) + '.ts');
    pushUnique(candidates, entryPath.slice(0, -'.js'.length) + '.tsx');
  }

  for (const fallback of defaults) {
    pushUnique(candidates, fallback);
  }

  return candidates;
};

export const getWorkspacePluginModuleCandidates = (manifest: PluginManifest): readonly string[] => {
  const manifestBrowserEntry = normalizeEntryPath(manifest.entryPoints.browser ?? '');
  if (manifestBrowserEntry.length === 0) {
    return ['src/index.ts', 'src/index.tsx'];
  }

  return createWorkspaceSourceFallbacks(manifestBrowserEntry, ['src/index.ts', 'src/index.tsx']);
};

export const getPackagePluginModuleCandidates = (manifest: PluginManifest): readonly string[] => {
  const manifestBrowserEntry = normalizeEntryPath(manifest.entryPoints.browser ?? '');
  return manifestBrowserEntry ? [manifestBrowserEntry] : [];
};

export const getWorkspacePluginDescriptorCandidates = (
  manifest: PluginManifest
): readonly string[] => {
  const entry = normalizeEntryPath(manifest.entryPoints.descriptor ?? '');
  return entry ? createWorkspaceSourceFallbacks(entry, []) : [];
};

export const getPackagePluginDescriptorCandidates = (
  manifest: PluginManifest
): readonly string[] => {
  const entry = normalizeEntryPath(manifest.entryPoints.descriptor ?? '');
  return entry ? [entry] : [];
};

const isReadonlyRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isPluginDefinitionCandidate = (value: unknown): value is PluginDescriptor => {
  if (!isReadonlyRecord(value)) {
    return false;
  }

  if (
    typeof value.id !== 'string' ||
    typeof value.displayName !== 'string' ||
    !Array.isArray(value.routes)
  ) {
    return false;
  }

  return (
    (value.navigation === undefined || Array.isArray(value.navigation)) &&
    (value.actions === undefined || Array.isArray(value.actions)) &&
    (value.permissions === undefined || Array.isArray(value.permissions)) &&
    (value.contentTypes === undefined || Array.isArray(value.contentTypes)) &&
    (value.adminResources === undefined || Array.isArray(value.adminResources)) &&
    (value.auditEvents === undefined || Array.isArray(value.auditEvents)) &&
    (value.jobTypes === undefined || Array.isArray(value.jobTypes)) &&
    (value.importProfiles === undefined || Array.isArray(value.importProfiles)) &&
    (value.moduleIam === undefined || isReadonlyRecord(value.moduleIam)) &&
    (value.translations === undefined || isReadonlyRecord(value.translations))
  );
};

export const extractPluginDefinition = (
  exportsObject: PluginModuleExports
): PluginDescriptor | undefined => {
  for (const value of Object.values(exportsObject)) {
    if (isPluginDefinitionCandidate(value)) {
      return value;
    }
  }

  return undefined;
};

export const createStudioPluginCatalogSeed = (
  input: Pick<StudioPluginCatalogLoaderInput, 'catalogConfig' | 'resolveManifest'>
): PluginCatalogSeed => {
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

  return { catalog, issues };
};

export const createStudioPluginCatalogReport = async (
  input: StudioPluginCatalogLoaderInput
): Promise<StudioPluginCatalogReport> => {
  const seed = createStudioPluginCatalogSeed(input);

  const resolved = await resolvePluginCatalogAsync({
    catalog: seed.catalog,
    host: studioHostPluginPlatform,
    resolvePlugin: async (entry) => {
      const exportsObject = await input.resolvePluginModule(entry, entry.manifest);
      const descriptor = exportsObject ? extractPluginDefinition(exportsObject) : undefined;
      if (!descriptor) return undefined;
      if (!input.resolveBrowserModule) {
        return {
          ...descriptor,
          routes: descriptor.routes.map((route) => ({ ...route, component: () => null })),
        } satisfies PluginDefinition;
      }

      const browserExports = await input.resolveBrowserModule(entry, entry.manifest);
      const browserPlugin = browserExports ? extractPluginDefinition(browserExports) : undefined;
      if (!browserPlugin) return undefined;
      if (JSON.stringify(browserPlugin) !== JSON.stringify(descriptor)) {
        throw new Error(`plugin_browser_descriptor_mismatch:${entry.pluginId}`);
      }
      const browserRoutes = new Map(browserPlugin.routes.map((route) => [route.id, route]));
      if (browserRoutes.size !== descriptor.routes.length) {
        throw new Error(`plugin_browser_route_binding_mismatch:${entry.pluginId}`);
      }
      return {
        ...descriptor,
        routes: descriptor.routes.map((route) => {
          const component = (
            browserRoutes.get(route.id) as Partial<PluginDefinition['routes'][number]> | undefined
          )?.component;
          if (typeof component !== 'function') {
            throw new Error(`plugin_browser_route_binding_mismatch:${entry.pluginId}:${route.id}`);
          }
          return { ...route, component };
        }),
      };
    },
    adminResources: input.adminResources,
  });

  return {
    ...resolved,
    issues: [...seed.issues, ...resolved.issues],
  };
};
