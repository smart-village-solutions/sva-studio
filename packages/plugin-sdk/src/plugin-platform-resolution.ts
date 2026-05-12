import type { AdminResourceDefinition } from './admin-resources.js';
import type { PluginDefinition } from './plugins.js';
import {
  createPluginSnapshot,
  definePluginCatalogEntry,
  type LoadedPluginEntry,
  type PluginCatalogEntry,
  type PluginCatalogSourceType,
  type PluginManifestCapability,
  type PluginSnapshot,
} from './plugin-platform-contracts.js';

export type PluginPlatformHost = {
  readonly studioVersion: string;
  readonly sdkVersion: string;
  readonly capabilities: readonly PluginManifestCapability[];
};

export type PluginCatalogIssueCode =
  | 'plugin_disabled'
  | 'plugin_incompatible_sdk_version'
  | 'plugin_incompatible_studio_version'
  | 'plugin_missing_host_capability'
  | 'plugin_missing_browser_entry'
  | 'plugin_module_missing'
  | 'plugin_module_mismatch';

export type PluginCatalogIssueSeverity = 'info' | 'error';

export type PluginCatalogIssue = {
  readonly pluginId: string;
  readonly sourceType: PluginCatalogSourceType;
  readonly sourceRef: string;
  readonly severity: PluginCatalogIssueSeverity;
  readonly code: PluginCatalogIssueCode;
  readonly message: string;
};

export type ResolvedPluginCatalog = {
  readonly catalog: readonly PluginCatalogEntry[];
  readonly activeCatalog: readonly PluginCatalogEntry[];
  readonly inactiveCatalog: readonly PluginCatalogEntry[];
  readonly rejectedCatalog: readonly PluginCatalogEntry[];
  readonly issues: readonly PluginCatalogIssue[];
  readonly loadedPlugins: readonly LoadedPluginEntry[];
  readonly snapshot: PluginSnapshot;
};

type ResolvePluginCatalogInput = {
  readonly catalog: readonly PluginCatalogEntry[];
  readonly host: PluginPlatformHost;
  readonly resolvePlugin: (entry: PluginCatalogEntry) => PluginDefinition | undefined;
  readonly adminResources?: readonly AdminResourceDefinition[];
};

type ResolvePluginCatalogAsyncInput = {
  readonly catalog: readonly PluginCatalogEntry[];
  readonly host: PluginPlatformHost;
  readonly resolvePlugin: (entry: PluginCatalogEntry) => Promise<PluginDefinition | undefined>;
  readonly adminResources?: readonly AdminResourceDefinition[];
};

type ResolvePluginCatalogState = {
  readonly host: PluginPlatformHost;
  readonly resolvePlugin: (entry: PluginCatalogEntry) => PluginDefinition | undefined;
  readonly hostCapabilities: ReadonlySet<PluginManifestCapability>;
  readonly activeCatalog: PluginCatalogEntry[];
  readonly inactiveCatalog: PluginCatalogEntry[];
  readonly rejectedCatalog: PluginCatalogEntry[];
  readonly issues: PluginCatalogIssue[];
  readonly loadedPlugins: LoadedPluginEntry[];
};

const parseVersion = (
  rawVersion: string
): { readonly major: number; readonly minor: number; readonly patch: number } | undefined => {
  const match = rawVersion.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return undefined;
  }

  return {
    major: Number.parseInt(match[1] ?? '', 10),
    minor: Number.parseInt(match[2] ?? '', 10),
    patch: Number.parseInt(match[3] ?? '', 10),
  };
};

const compareVersions = (
  left: { readonly major: number; readonly minor: number; readonly patch: number },
  right: { readonly major: number; readonly minor: number; readonly patch: number }
): number => {
  if (left.major !== right.major) {
    return left.major - right.major;
  }
  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }

  return left.patch - right.patch;
};

const satisfiesVersionRange = (version: string, range: string): boolean => {
  const normalizedRange = range.trim();
  if (normalizedRange === '*') {
    return true;
  }

  const parsedVersion = parseVersion(version);
  if (!parsedVersion) {
    return false;
  }

  if (normalizedRange.startsWith('^')) {
    const baseVersion = parseVersion(normalizedRange.slice(1));
    if (!baseVersion) {
      return false;
    }
    if (compareVersions(parsedVersion, baseVersion) < 0) {
      return false;
    }

    if (baseVersion.major > 0) {
      return parsedVersion.major === baseVersion.major;
    }
    if (baseVersion.minor > 0) {
      return parsedVersion.major === 0 && parsedVersion.minor === baseVersion.minor;
    }

    return (
      parsedVersion.major === 0 &&
      parsedVersion.minor === 0 &&
      parsedVersion.patch === baseVersion.patch
    );
  }

  const exactVersion = parseVersion(normalizedRange);
  return exactVersion ? compareVersions(parsedVersion, exactVersion) === 0 : false;
};

const createIssue = (
  entry: PluginCatalogEntry,
  severity: PluginCatalogIssueSeverity,
  code: PluginCatalogIssueCode,
  message: string
): PluginCatalogIssue => ({
  pluginId: entry.pluginId,
  sourceType: entry.sourceType,
  sourceRef: entry.sourceRef,
  severity,
  code,
  message,
});

const rejectPluginEntry = (
  state: ResolvePluginCatalogState,
  entry: PluginCatalogEntry,
  code: PluginCatalogIssueCode,
  message: string
): void => {
  state.rejectedCatalog.push(entry);
  state.issues.push(createIssue(entry, 'error', code, message));
};

const validateEnabledPluginEntry = (
  state: ResolvePluginCatalogState,
  entry: PluginCatalogEntry
): boolean => {
  if (entry.manifest.sdkVersion !== state.host.sdkVersion) {
    rejectPluginEntry(
      state,
      entry,
      'plugin_incompatible_sdk_version',
      `Plugin '${entry.pluginId}' erwartet SDK-Version '${entry.manifest.sdkVersion}', Host bietet '${state.host.sdkVersion}'.`
    );
    return false;
  }

  if (!satisfiesVersionRange(state.host.studioVersion, entry.manifest.hostCompatibility.studioVersionRange)) {
    rejectPluginEntry(
      state,
      entry,
      'plugin_incompatible_studio_version',
      `Plugin '${entry.pluginId}' verlangt Studio-Version '${entry.manifest.hostCompatibility.studioVersionRange}', Host läuft auf '${state.host.studioVersion}'.`
    );
    return false;
  }

  const missingCapability = entry.manifest.hostCompatibility.requiredCapabilities?.find(
    (capability) => !state.hostCapabilities.has(capability)
  );
  if (missingCapability) {
    rejectPluginEntry(
      state,
      entry,
      'plugin_missing_host_capability',
      `Plugin '${entry.pluginId}' verlangt Host-Capability '${missingCapability}', die nicht aktiviert ist.`
    );
    return false;
  }

  if (!entry.manifest.entryPoints.browser) {
    rejectPluginEntry(
      state,
      entry,
      'plugin_missing_browser_entry',
      `Plugin '${entry.pluginId}' deklariert keinen Browser-Entry-Point.`
    );
    return false;
  }

  return true;
};

const tryLoadPluginEntry = (state: ResolvePluginCatalogState, entry: PluginCatalogEntry): void => {
  const plugin = state.resolvePlugin(entry);
  if (!plugin) {
    rejectPluginEntry(
      state,
      entry,
      'plugin_module_missing',
      `Plugin '${entry.pluginId}' konnte aus '${entry.sourceRef}' nicht geladen werden.`
    );
    return;
  }

  if (plugin.id !== entry.pluginId) {
    rejectPluginEntry(
      state,
      entry,
      'plugin_module_mismatch',
      `Plugin-Modul aus '${entry.sourceRef}' exportiert '${plugin.id}' statt '${entry.pluginId}'.`
    );
    return;
  }

  state.activeCatalog.push(entry);
  state.loadedPlugins.push({
    catalogEntry: entry,
    plugin,
  });
};

const resolveCatalogEntry = (state: ResolvePluginCatalogState, entry: PluginCatalogEntry): void => {
  if (!entry.enabled) {
    state.inactiveCatalog.push(entry);
    state.issues.push(createIssue(entry, 'info', 'plugin_disabled', `Plugin '${entry.pluginId}' ist im Katalog deaktiviert.`));
    return;
  }

  if (!validateEnabledPluginEntry(state, entry)) {
    return;
  }

  tryLoadPluginEntry(state, entry);
};

const tryLoadPluginEntryAsync = async (
  state: ResolvePluginCatalogState,
  entry: PluginCatalogEntry,
  resolvePlugin: (entry: PluginCatalogEntry) => Promise<PluginDefinition | undefined>
): Promise<void> => {
  const plugin = await resolvePlugin(entry);
  if (!plugin) {
    rejectPluginEntry(
      state,
      entry,
      'plugin_module_missing',
      `Plugin '${entry.pluginId}' konnte aus '${entry.sourceRef}' nicht geladen werden.`
    );
    return;
  }

  if (plugin.id !== entry.pluginId) {
    rejectPluginEntry(
      state,
      entry,
      'plugin_module_mismatch',
      `Plugin-Modul aus '${entry.sourceRef}' exportiert '${plugin.id}' statt '${entry.pluginId}'.`
    );
    return;
  }

  state.activeCatalog.push(entry);
  state.loadedPlugins.push({
    catalogEntry: entry,
    plugin,
  });
};

const resolveCatalogEntryAsync = async (
  state: ResolvePluginCatalogState,
  entry: PluginCatalogEntry,
  resolvePlugin: (entry: PluginCatalogEntry) => Promise<PluginDefinition | undefined>
): Promise<void> => {
  if (!entry.enabled) {
    state.inactiveCatalog.push(entry);
    state.issues.push(createIssue(entry, 'info', 'plugin_disabled', `Plugin '${entry.pluginId}' ist im Katalog deaktiviert.`));
    return;
  }

  if (!validateEnabledPluginEntry(state, entry)) {
    return;
  }

  await tryLoadPluginEntryAsync(state, entry, resolvePlugin);
};

export const resolvePluginCatalog = (input: ResolvePluginCatalogInput): ResolvedPluginCatalog => {
  const catalog = input.catalog.map(definePluginCatalogEntry);
  const state: ResolvePluginCatalogState = {
    host: input.host,
    resolvePlugin: input.resolvePlugin,
    hostCapabilities: new Set(input.host.capabilities),
    activeCatalog: [],
    inactiveCatalog: [],
    rejectedCatalog: [],
    issues: [],
    loadedPlugins: [],
  };

  for (const entry of catalog) {
    resolveCatalogEntry(state, entry);
  }

  return {
    catalog,
    activeCatalog: state.activeCatalog,
    inactiveCatalog: state.inactiveCatalog,
    rejectedCatalog: state.rejectedCatalog,
    issues: state.issues,
    loadedPlugins: state.loadedPlugins,
    snapshot: createPluginSnapshot({
      catalog: state.activeCatalog,
      loadedPlugins: state.loadedPlugins,
      adminResources: input.adminResources,
    }),
  };
};

export const resolvePluginCatalogAsync = async (
  input: ResolvePluginCatalogAsyncInput
): Promise<ResolvedPluginCatalog> => {
  const catalog = input.catalog.map(definePluginCatalogEntry);
  const state: ResolvePluginCatalogState = {
    host: input.host,
    resolvePlugin: () => undefined,
    hostCapabilities: new Set(input.host.capabilities),
    activeCatalog: [],
    inactiveCatalog: [],
    rejectedCatalog: [],
    issues: [],
    loadedPlugins: [],
  };

  for (const entry of catalog) {
    await resolveCatalogEntryAsync(state, entry, input.resolvePlugin);
  }

  return {
    catalog,
    activeCatalog: state.activeCatalog,
    inactiveCatalog: state.inactiveCatalog,
    rejectedCatalog: state.rejectedCatalog,
    issues: state.issues,
    loadedPlugins: state.loadedPlugins,
    snapshot: createPluginSnapshot({
      catalog: state.activeCatalog,
      loadedPlugins: state.loadedPlugins,
      adminResources: input.adminResources,
    }),
  };
};
