import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { resolve } from 'node:path';
import { definePluginManifest, satisfiesVersionRange, type PluginManifest } from '@sva/plugin-sdk';
import { studioHostPluginPlatform } from './src/lib/plugin-catalog-loader.js';

export type Distribution = 'studio' | 'ssf' | 'custom';
export type EntryKind = 'browser' | 'descriptor' | 'server' | 'jobs';
export type CatalogRecord = {
  readonly pluginId: string;
  readonly sourceType: 'workspace' | 'linked-package' | 'installed-distribution';
  readonly enabled: boolean;
  readonly sourceRef: string;
  readonly distribution?: Distribution;
};
export type InstalledSource = {
  readonly catalog: Omit<CatalogRecord, 'distribution'>;
  readonly manifest: PluginManifest;
  readonly packageRoot: string;
  readonly files: Partial<Record<EntryKind, string>>;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, 'utf8')) as unknown;

export const serializeJavaScriptValue = (value: unknown): string => {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('installed_plugin_module_serialization_failed');
  return serialized
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
};

export const readCatalog = (
  appRoot: string,
  distribution: Distribution,
  selectedPluginIds: readonly string[]
): readonly CatalogRecord[] => {
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
      !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/u.test(value.sourceRef) ||
      value.sourceRef.split('/').some((part) => part === '.' || part === '..') ||
      typeof value.enabled !== 'boolean' ||
      (value.distribution !== 'studio' && value.distribution !== 'ssf')
    ) {
      throw new Error('installed_plugin_catalog_entry_invalid');
    }
    const entry = value as CatalogRecord;
    if (
      distribution === 'custom'
        ? selectedPluginIds.includes(entry.pluginId)
        : entry.distribution === distribution
    ) {
      entries.push(entry);
    }
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

const resolveEnabledPluginFiles = (
  packageRoot: string,
  manifest: PluginManifest,
  distribution: Distribution
): Partial<Record<EntryKind, string>> => {
  if (distribution === 'ssf' && manifest.entryPoints.jobs) {
    throw new Error(`installed_plugin_jobs_unsupported:${manifest.pluginId}:ssf`);
  }
  if (
    distribution === 'studio' &&
    manifest.entryPoints.jobs &&
    manifest.runtimeRequirements?.jobs !== 'waste-management.operations'
  ) {
    throw new Error(`installed_plugin_jobs_unsupported:${manifest.pluginId}:studio`);
  }
  const files: Partial<Record<EntryKind, string>> = {};
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
    throw new Error(`installed_plugin_incompatible:${manifest.pluginId}`);
  }
  for (const kind of ['browser', 'descriptor', 'server', 'jobs'] as const) {
    const path = manifest.entryPoints[kind];
    if (path) files[kind] = resolveEntryFile(packageRoot, manifest.pluginId, kind, path);
  }
  if (!files.browser || !files.descriptor) {
    throw new Error(`installed_plugin_entry_missing:${manifest.pluginId}:browser_or_descriptor`);
  }
  return files;
};

const resolveInstalledPluginSource = (
  appRoot: string,
  distribution: Distribution,
  dependencies: Record<string, unknown>,
  entry: CatalogRecord
): InstalledSource => {
  if (!Object.hasOwn(dependencies, entry.sourceRef)) {
    throw new Error(`installed_plugin_dependency_missing:${entry.pluginId}`);
  }
  let packageRoot: string;
  try {
    packageRoot = realpathSync(join(appRoot, 'node_modules', entry.sourceRef));
  } catch {
    throw new Error(`installed_plugin_manifest_missing:${entry.pluginId}`);
  }
  const manifestPath = join(packageRoot, 'plugin.manifest.json');
  try {
    if (!statSync(manifestPath).isFile()) throw new Error('not_file');
  } catch {
    throw new Error(`installed_plugin_manifest_missing:${entry.pluginId}`);
  }
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
  const catalog = {
    pluginId: entry.pluginId,
    sourceType: entry.sourceType,
    enabled: entry.enabled,
    sourceRef: entry.sourceRef,
  };
  if (!entry.enabled) {
    return { catalog, manifest, packageRoot, files: {} };
  }
  const files = resolveEnabledPluginFiles(packageRoot, manifest, distribution);
  return { catalog, manifest, packageRoot, files };
};

export const resolveInstalledPluginSources = (
  appRoot: string,
  distribution: Distribution,
  selectedPluginIds: readonly string[] = []
): readonly InstalledSource[] => {
  const appPackage = readJson(join(appRoot, 'package.json'));
  if (!isRecord(appPackage)) throw new Error('studio_package_invalid');
  const dependencies = isRecord(appPackage.dependencies) ? appPackage.dependencies : {};
  return readCatalog(appRoot, distribution, selectedPluginIds).map((entry) =>
    resolveInstalledPluginSource(appRoot, distribution, dependencies, entry)
  );
};
