import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { resolve } from 'node:path';
import { definePluginManifest, satisfiesVersionRange, type PluginManifest } from '@sva/plugin-sdk';
import { studioHostPluginPlatform } from './src/lib/plugin-catalog-loader.js';
import {
  isInstalledPluginCatalogEntry,
  parsePluginCatalogConfig,
  type InstalledPluginCatalogConfigEntry,
  type PluginCatalogConfigEntry,
} from './src/lib/plugin-catalog-config.js';

export type Distribution = 'studio' | 'ssf' | 'custom';
export type EntryKind = 'browser' | 'descriptor' | 'server' | 'jobs';
export type CatalogRecord = PluginCatalogConfigEntry;
export type InstalledSource = {
  readonly catalog: Pick<
    InstalledPluginCatalogConfigEntry,
    'pluginId' | 'sourceType' | 'enabled' | 'sourceRef'
  >;
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

export const readValidatedPluginCatalog = (appRoot: string): readonly PluginCatalogConfigEntry[] =>
  parsePluginCatalogConfig(readJson(join(appRoot, 'plugin-catalog.json')));

export const readCatalog = (
  appRoot: string,
  distribution: Distribution,
  selectedPluginIds: readonly string[]
): readonly InstalledPluginCatalogConfigEntry[] => {
  return readValidatedPluginCatalog(appRoot)
    .filter(isInstalledPluginCatalogEntry)
    .filter((entry) =>
      distribution === 'custom'
        ? selectedPluginIds.includes(entry.pluginId)
        : entry.distribution === distribution
    );
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
  entry: InstalledPluginCatalogConfigEntry
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

const statOrSkip = (path: string): ReturnType<typeof statSync> | undefined => {
  try {
    return statSync(path);
  } catch {
    // Dangling, looping or unreadable links cannot be bundled either.
    return undefined;
  }
};

const toPackagePath = (packageRoot: string, path: string): string =>
  relative(packageRoot, path).split(sep).join('/');

type PackageContent = { readonly files: string[]; readonly directoryLinks: string[] };

const listPackageContent = (packageRoot: string): PackageContent => {
  const files: string[] = [];
  const directoryLinks: string[] = [];
  const visitedDirectories = new Set<string>();
  const walk = (directory: string): void => {
    const realDirectory = realpathSync(directory);
    // Recorded before the visited check: Vite resolves imports through a link from its target,
    // so retargeting a link between two already walked directories must change the hash.
    if (lstatSync(directory).isSymbolicLink()) {
      directoryLinks.push(
        `${toPackagePath(packageRoot, directory)}\0${toPackagePath(packageRoot, realDirectory)}`
      );
    }
    if (visitedDirectories.has(realDirectory)) return;
    visitedDirectories.add(realDirectory);
    // Sorted so the first path to a directory reached through several links is deterministic.
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      // Follows symlinks like the entry resolution does.
      const stats = statOrSkip(path);
      if (stats?.isDirectory()) {
        if (name !== 'node_modules' && !name.startsWith('.')) walk(path);
      } else if (stats?.isFile()) {
        files.push(toPackagePath(packageRoot, path));
      }
    }
  };
  walk(packageRoot);
  return { files: files.sort(), directoryLinks: directoryLinks.sort() };
};

// Includes the real location, as Vite resolves relative imports from a symlink's target.
const hashFile = (packageRoot: string, path: string): string => {
  const location = toPackagePath(packageRoot, realpathSync(path));
  return `${location}\0${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
};

/**
 * Content fingerprint of the resolved installed and linked plugin packages. Nx hashes only
 * workspace files and lockfile versions, and a linked package keeps its lockfile entry when its
 * files change, so the build target hashes this value as a runtime input. Dependencies of the
 * package (`node_modules`) and dot-directories are not part of the package content; resolved
 * entry files are always hashed, even when the manifest points into such a directory. Symlinks
 * contribute their real target, so retargeting a file or directory link changes the hash.
 */
export const fingerprintInstalledPluginSources = (sources: readonly InstalledSource[]): string => {
  const hash = createHash('sha256');
  for (const source of sources) {
    hash.update(`${source.catalog.sourceRef}\n`);
    const { files, directoryLinks } = listPackageContent(source.packageRoot);
    for (const link of directoryLinks) hash.update(`link:${link}\n`);
    for (const file of files) {
      hash.update(`${file}\0${hashFile(source.packageRoot, join(source.packageRoot, file))}\n`);
    }
    for (const [kind, file] of Object.entries(source.files)) {
      hash.update(`entry:${kind}\0${hashFile(source.packageRoot, file)}\n`);
    }
  }
  return hash.digest('hex');
};
