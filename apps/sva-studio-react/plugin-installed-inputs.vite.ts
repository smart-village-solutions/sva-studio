import { createRequire } from 'node:module';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { definePluginManifest, satisfiesVersionRange, type PluginManifest } from '@sva/plugin-sdk';
import type { Plugin } from 'vite';
import { studioHostPluginPlatform } from './src/lib/plugin-catalog-loader.js';

type Distribution = 'studio' | 'ssf';
type EntryKind = 'browser' | 'descriptor' | 'server' | 'jobs';
type CatalogRecord = {
  readonly pluginId: string;
  readonly sourceType: 'workspace' | 'linked-package' | 'installed-distribution';
  readonly enabled: boolean;
  readonly sourceRef: string;
  readonly distribution?: Distribution;
};
type InstalledSource = {
  readonly catalog: Omit<CatalogRecord, 'distribution'>;
  readonly manifest: PluginManifest;
  readonly packageRoot: string;
  readonly files: Partial<Record<EntryKind, string>>;
};

export const installedInputIds = {
  catalog: 'virtual:studio-installed-plugin-catalog',
  client: 'virtual:studio-installed-plugin-client',
  server: 'virtual:studio-installed-plugin-server',
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8')) as unknown;

const readCatalog = (appRoot: string, distribution: Distribution): readonly CatalogRecord[] => {
  const raw = readJson(join(appRoot, 'plugin-catalog.json'));
  if (!Array.isArray(raw)) throw new Error('plugin_catalog_invalid');
  const entries: CatalogRecord[] = [];
  for (const value of raw) {
    if (
      !isRecord(value) ||
      !['installed-distribution', 'linked-package'].includes(String(value.sourceType))
    ) {
      continue;
    }
    if (
      typeof value.pluginId !== 'string' ||
      typeof value.sourceRef !== 'string' ||
      !/^(?:@[a-z0-9-]+\/)?[a-z0-9-]+$/u.test(value.sourceRef) ||
      typeof value.enabled !== 'boolean' ||
      (value.distribution !== 'studio' && value.distribution !== 'ssf')
    ) {
      throw new Error('installed_plugin_catalog_entry_invalid');
    }
    const entry = value as CatalogRecord;
    if (entry.distribution === distribution && entry.enabled) entries.push(entry);
  }
  return entries;
};

const resolveEntryFile = (
  packageRoot: string,
  pluginId: string,
  kind: EntryKind,
  path: string
): string => {
  const normalized = path.replace(/^\.\//u, '');
  if (
    normalized.length === 0 ||
    isAbsolute(normalized) ||
    normalized.split(/[\\/]/u).includes('..') ||
    normalized.includes('\\')
  ) {
    throw new Error(`installed_plugin_entry_invalid:${pluginId}:${kind}`);
  }
  const file = resolve(packageRoot, normalized);
  let actual: string;
  try {
    actual = realpathSync(file);
    if (!statSync(actual).isFile()) throw new Error('not_file');
  } catch {
    throw new Error(`installed_plugin_entry_missing:${pluginId}:${kind}`);
  }
  const withinPackage = relative(packageRoot, actual);
  if (withinPackage.startsWith(`..${sep}`) || withinPackage === '..' || isAbsolute(withinPackage)) {
    throw new Error(`installed_plugin_entry_invalid:${pluginId}:${kind}`);
  }
  return actual;
};

export const resolveInstalledPluginSources = (
  appRoot: string,
  distribution: Distribution
): readonly InstalledSource[] => {
  const requireFromApp = createRequire(join(appRoot, 'package.json'));
  const appPackage = readJson(join(appRoot, 'package.json'));
  if (!isRecord(appPackage)) throw new Error('studio_package_invalid');
  const dependencies = isRecord(appPackage.dependencies) ? appPackage.dependencies : {};
  const sources: InstalledSource[] = [];
  for (const entry of readCatalog(appRoot, distribution)) {
    if (!Object.hasOwn(dependencies, entry.sourceRef)) {
      throw new Error(`installed_plugin_dependency_missing:${entry.pluginId}`);
    }
    let manifestPath: string;
    try {
      manifestPath = requireFromApp.resolve(`${entry.sourceRef}/plugin.manifest.json`);
    } catch {
      throw new Error(`installed_plugin_manifest_missing:${entry.pluginId}`);
    }
    const packageRoot = realpathSync(join(appRoot, 'node_modules', entry.sourceRef));
    if (realpathSync(manifestPath) !== join(packageRoot, 'plugin.manifest.json')) {
      throw new Error(`installed_plugin_manifest_invalid:${entry.pluginId}`);
    }
    const packageJson = readJson(join(packageRoot, 'package.json'));
    if (!isRecord(packageJson) || packageJson.name !== entry.sourceRef) {
      throw new Error(`installed_plugin_package_mismatch:${entry.pluginId}`);
    }
    const manifest = definePluginManifest(readJson(manifestPath) as PluginManifest);
    if (manifest.pluginId !== entry.pluginId) {
      throw new Error(`installed_plugin_manifest_mismatch:${entry.pluginId}`);
    }
    if (
      manifest.sdkVersion !== studioHostPluginPlatform.sdkVersion ||
      !satisfiesVersionRange(
        studioHostPluginPlatform.studioVersion,
        manifest.hostCompatibility.studioVersionRange
      ) ||
      manifest.hostCompatibility.requiredCapabilities?.some(
        (capability) => !studioHostPluginPlatform.capabilities.includes(capability)
      )
    ) {
      throw new Error(`installed_plugin_incompatible:${entry.pluginId}`);
    }
    const files: Partial<Record<EntryKind, string>> = {};
    for (const kind of ['browser', 'descriptor', 'server', 'jobs'] as const) {
      const path = manifest.entryPoints[kind];
      if (path) files[kind] = resolveEntryFile(packageRoot, entry.pluginId, kind, path);
    }
    if (entry.enabled && (!files.browser || !files.descriptor)) {
      throw new Error(`installed_plugin_entry_missing:${entry.pluginId}:browser_or_descriptor`);
    }
    const catalog = {
      pluginId: entry.pluginId,
      sourceType: entry.sourceType,
      enabled: entry.enabled,
      sourceRef: entry.sourceRef,
    };
    sources.push({ catalog, manifest, packageRoot, files });
  }
  return sources;
};

const registryPath = (source: InstalledSource, kind: EntryKind): string =>
  `../../../../node_modules/${source.catalog.sourceRef}/${source.manifest.entryPoints[kind]?.replace(/^\.\//u, '')}`;

const renderManifestModules = (sources: readonly InstalledSource[]): string =>
  `export const nodeManifestModules = ${JSON.stringify(
    Object.fromEntries(
      sources
        .filter((source) => source.catalog.enabled)
        .map((source) => [
          `../../../../node_modules/${source.catalog.sourceRef}/plugin.manifest.json`,
          source.manifest,
        ])
    )
  )};`;

const renderLoaders = (
  sources: readonly InstalledSource[],
  kind: EntryKind,
  exportName: string
): string => {
  const entries = sources
    .filter((source) => source.catalog.enabled && source.files[kind])
    .map(
      (source) =>
        `${JSON.stringify(registryPath(source, kind))}: () => import(${JSON.stringify(source.files[kind])})`
    );
  return `export const ${exportName} = { ${entries.join(', ')} };`;
};

export const renderInstalledPluginInputs = (
  sources: readonly InstalledSource[],
  module: keyof typeof installedInputIds
): string => {
  if (module === 'catalog') {
    return `export const installedPluginCatalogConfig = ${JSON.stringify(sources.map((source) => source.catalog))};`;
  }
  const declarations = [renderManifestModules(sources)];
  if (module === 'client') {
    declarations.push(renderLoaders(sources, 'browser', 'nodePluginModuleLoaders'));
    declarations.push(renderLoaders(sources, 'descriptor', 'nodeDescriptorModuleLoaders'));
  } else {
    declarations.push(renderLoaders(sources, 'descriptor', 'nodeDescriptorModuleLoaders'));
    declarations.push(renderLoaders(sources, 'server', 'nodeServerModuleLoaders'));
    declarations.push(renderLoaders(sources, 'jobs', 'nodeJobModuleLoaders'));
  }
  return declarations.join('\n');
};

export const createInstalledPluginInputsPlugin = (
  appRoot: string,
  distribution: Distribution
): Plugin => {
  const sources = resolveInstalledPluginSources(appRoot, distribution);
  const modules = Object.fromEntries(
    Object.entries(installedInputIds).map(([kind, id]) => [
      `\0${id}`,
      renderInstalledPluginInputs(sources, kind as keyof typeof installedInputIds),
    ])
  );
  return {
    name: 'studio-installed-plugin-inputs',
    resolveId(id) {
      return Object.hasOwn(modules, `\0${id}`) ? `\0${id}` : undefined;
    },
    load(id) {
      return modules[id];
    },
  };
};
