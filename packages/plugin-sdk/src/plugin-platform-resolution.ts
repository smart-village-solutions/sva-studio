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

    return parsedVersion.major === 0 && parsedVersion.minor === 0;
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

export const resolvePluginCatalog = (input: ResolvePluginCatalogInput): ResolvedPluginCatalog => {
  const catalog = input.catalog.map(definePluginCatalogEntry);
  const activeCatalog: PluginCatalogEntry[] = [];
  const inactiveCatalog: PluginCatalogEntry[] = [];
  const rejectedCatalog: PluginCatalogEntry[] = [];
  const issues: PluginCatalogIssue[] = [];
  const loadedPlugins: LoadedPluginEntry[] = [];

  const hostCapabilities = new Set(input.host.capabilities);

  for (const entry of catalog) {
    if (!entry.enabled) {
      inactiveCatalog.push(entry);
      issues.push(createIssue(entry, 'info', 'plugin_disabled', `Plugin '${entry.pluginId}' ist im Katalog deaktiviert.`));
      continue;
    }

    if (entry.manifest.sdkVersion !== input.host.sdkVersion) {
      rejectedCatalog.push(entry);
      issues.push(
        createIssue(
          entry,
          'error',
          'plugin_incompatible_sdk_version',
          `Plugin '${entry.pluginId}' erwartet SDK-Version '${entry.manifest.sdkVersion}', Host bietet '${input.host.sdkVersion}'.`
        )
      );
      continue;
    }

    if (!satisfiesVersionRange(input.host.studioVersion, entry.manifest.hostCompatibility.studioVersionRange)) {
      rejectedCatalog.push(entry);
      issues.push(
        createIssue(
          entry,
          'error',
          'plugin_incompatible_studio_version',
          `Plugin '${entry.pluginId}' verlangt Studio-Version '${entry.manifest.hostCompatibility.studioVersionRange}', Host läuft auf '${input.host.studioVersion}'.`
        )
      );
      continue;
    }

    const missingCapability = entry.manifest.hostCompatibility.requiredCapabilities?.find(
      (capability) => !hostCapabilities.has(capability)
    );
    if (missingCapability) {
      rejectedCatalog.push(entry);
      issues.push(
        createIssue(
          entry,
          'error',
          'plugin_missing_host_capability',
          `Plugin '${entry.pluginId}' verlangt Host-Capability '${missingCapability}', die nicht aktiviert ist.`
        )
      );
      continue;
    }

    if (!entry.manifest.entryPoints.browser) {
      rejectedCatalog.push(entry);
      issues.push(
        createIssue(
          entry,
          'error',
          'plugin_missing_browser_entry',
          `Plugin '${entry.pluginId}' deklariert keinen Browser-Entry-Point.`
        )
      );
      continue;
    }

    const plugin = input.resolvePlugin(entry);
    if (!plugin) {
      rejectedCatalog.push(entry);
      issues.push(
        createIssue(
          entry,
          'error',
          'plugin_module_missing',
          `Plugin '${entry.pluginId}' konnte aus '${entry.sourceRef}' nicht geladen werden.`
        )
      );
      continue;
    }

    if (plugin.id !== entry.pluginId) {
      rejectedCatalog.push(entry);
      issues.push(
        createIssue(
          entry,
          'error',
          'plugin_module_mismatch',
          `Plugin-Modul aus '${entry.sourceRef}' exportiert '${plugin.id}' statt '${entry.pluginId}'.`
        )
      );
      continue;
    }

    activeCatalog.push(entry);
    loadedPlugins.push({
      catalogEntry: entry,
      plugin,
    });
  }

  return {
    catalog,
    activeCatalog,
    inactiveCatalog,
    rejectedCatalog,
    issues,
    loadedPlugins,
    snapshot: createPluginSnapshot({
      catalog: activeCatalog,
      loadedPlugins,
      adminResources: input.adminResources,
    }),
  };
};
