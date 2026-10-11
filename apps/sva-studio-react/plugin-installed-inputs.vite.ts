import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { parseDocument } from 'yaml';
import { definePluginManifest, satisfiesVersionRange, type PluginManifest } from '@sva/plugin-sdk';
import type { Plugin } from 'vite';
import { studioHostPluginPlatform } from './src/lib/plugin-catalog-loader.js';

type Distribution = 'studio' | 'ssf' | 'custom';
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

export const modulePublicCodeInputId = 'virtual:studio-module-publiccode';

type ModulePublicCode = Readonly<{
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
}>;

const readModulePublicCode = (file: string, moduleId: string): ModulePublicCode => {
  const document = parseDocument(readFileSync(file, 'utf8'), { uniqueKeys: true });
  if (document.errors.length > 0) {
    throw new Error(`module_publiccode_yaml_invalid:${moduleId}`);
  }
  const value: unknown = document.toJS();
  if (
    !isRecord(value) ||
    value.publiccodeYmlVersion !== '0' ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    !isRecord(value.description)
  ) {
    throw new Error(`module_publiccode_invalid:${moduleId}`);
  }
  const descriptions: Record<string, { localisedName?: string; shortDescription: string }> = {};
  for (const locale of ['de', 'en']) {
    const entry = value.description[locale];
    if (
      !isRecord(entry) ||
      typeof entry.shortDescription !== 'string' ||
      !entry.shortDescription.trim() ||
      entry.shortDescription.length > 150 ||
      (entry.localisedName !== undefined && typeof entry.localisedName !== 'string')
    ) {
      throw new Error(`module_publiccode_description_invalid:${moduleId}:${locale}`);
    }
    descriptions[locale] = {
      shortDescription: entry.shortDescription,
      ...(typeof entry.localisedName === 'string' ? { localisedName: entry.localisedName } : {}),
    };
  }
  return { name: value.name.trim(), description: descriptions };
};

export const createModulePublicCodePlugin = (
  appRoot: string,
  distribution: Distribution,
  selectedPluginIds: readonly string[]
): Plugin => {
  const workspaceRoot = resolve(appRoot, '../..');
  const rawCatalog = readJson(join(appRoot, 'plugin-catalog.json'));
  if (!Array.isArray(rawCatalog)) throw new Error('plugin_catalog_invalid');
  const metadata: Record<string, ModulePublicCode> = {
    media: readModulePublicCode(join(workspaceRoot, 'packages/media/publiccode.yml'), 'media'),
  };
  for (const entry of rawCatalog as CatalogRecord[]) {
    if (
      entry.sourceType !== 'workspace' ||
      (distribution === 'studio' && entry.pluginId === 'ssf') ||
      (distribution === 'ssf' && entry.pluginId !== 'ssf') ||
      (distribution === 'custom' && !selectedPluginIds.includes(entry.pluginId))
    )
      continue;
    metadata[entry.pluginId] = readModulePublicCode(
      join(workspaceRoot, entry.sourceRef, 'publiccode.yml'),
      entry.pluginId
    );
  }
  for (const entry of readCatalog(appRoot, distribution, selectedPluginIds)) {
    const file = join(appRoot, 'node_modules', entry.sourceRef, 'publiccode.yml');
    if (!existsSync(file)) throw new Error(`module_publiccode_missing:${entry.pluginId}`);
    metadata[entry.pluginId] = readModulePublicCode(file, entry.pluginId);
  }
  const virtualId = `\0${modulePublicCodeInputId}`;
  return {
    name: 'studio-module-publiccode',
    resolveId(id) {
      return id === modulePublicCodeInputId ? virtualId : undefined;
    },
    load(id) {
      return id === virtualId
        ? `export const modulePublicCode = ${serializeJavaScriptValue(metadata)};`
        : undefined;
    },
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8')) as unknown;

const serializeJavaScriptValue = (value: unknown): string => {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('installed_plugin_module_serialization_failed');
  return serialized
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
};

const javascriptStringLiteral = (value: string): string => serializeJavaScriptValue(value);

const readCatalog = (
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

export const resolveInstalledPluginSources = (
  appRoot: string,
  distribution: Distribution,
  selectedPluginIds: readonly string[] = []
): readonly InstalledSource[] => {
  const appPackage = readJson(join(appRoot, 'package.json'));
  if (!isRecord(appPackage)) throw new Error('studio_package_invalid');
  const dependencies = isRecord(appPackage.dependencies) ? appPackage.dependencies : {};
  const sources: InstalledSource[] = [];
  for (const entry of readCatalog(appRoot, distribution, selectedPluginIds)) {
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
    if (entry.enabled && distribution === 'ssf' && manifest.entryPoints.jobs) {
      throw new Error(`installed_plugin_jobs_unsupported:${entry.pluginId}:ssf`);
    }
    if (
      entry.enabled &&
      distribution === 'studio' &&
      manifest.entryPoints.jobs &&
      manifest.runtimeRequirements?.jobs !== 'waste-management.operations'
    ) {
      throw new Error(`installed_plugin_jobs_unsupported:${entry.pluginId}:studio`);
    }
    const files: Partial<Record<EntryKind, string>> = {};
    if (entry.enabled) {
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
      for (const kind of ['browser', 'descriptor', 'server', 'jobs'] as const) {
        const path = manifest.entryPoints[kind];
        if (path) files[kind] = resolveEntryFile(packageRoot, entry.pluginId, kind, path);
      }
      if (!files.browser || !files.descriptor) {
        throw new Error(`installed_plugin_entry_missing:${entry.pluginId}:browser_or_descriptor`);
      }
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
  `export const nodeManifestModules = ${serializeJavaScriptValue(
    Object.fromEntries(
      sources.map((source) => [
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
        `${javascriptStringLiteral(registryPath(source, kind))}: () => import(${javascriptStringLiteral(source.files[kind]!)})`
    );
  return `export const ${exportName} = { ${entries.join(', ')} };`;
};

export const renderInstalledPluginInputs = (
  sources: readonly InstalledSource[],
  module: keyof typeof installedInputIds
): string => {
  if (module === 'catalog') {
    return `export const installedPluginCatalogConfig = ${serializeJavaScriptValue(sources.map((source) => source.catalog))};`;
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
  distribution: Distribution,
  selectedPluginIds: readonly string[] = []
): Plugin => {
  const sources = resolveInstalledPluginSources(appRoot, distribution, selectedPluginIds);
  const modules = Object.fromEntries(
    Object.entries(installedInputIds).map(([kind, id]) => [
      `\0${id}`,
      renderInstalledPluginInputs(sources, kind as keyof typeof installedInputIds),
    ])
  );
  modules['\0virtual:studio-empty-plugin-runtime-factories'] =
    'export const selectedPluginJobRuntimeFactories = {};';
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

const selectedWorkspaceInputIds = {
  catalog: 'virtual:studio-selected-plugin-catalog',
  client: 'virtual:studio-selected-plugin-client',
  server: 'virtual:studio-selected-plugin-server',
  jobs: 'virtual:studio-selected-plugin-jobs',
  ownership: 'virtual:studio-selected-plugin-ownership',
  runtimeFactories: 'virtual:studio-selected-plugin-runtime-factories',
} as const;

const renderStaticModuleMap = (
  entries: readonly Readonly<{ key: string; path: string }>[],
  exportName: string,
  eager: false | 'default' | 'namespace' = false
): string => {
  const localPrefix = exportName.replace(/[^a-zA-Z0-9_$]/gu, '_');
  const imports = entries.map((entry, index) =>
    eager !== false
      ? `import ${eager === 'namespace' ? `* as ${localPrefix}Module${index}` : `${localPrefix}Module${index}`} from ${serializeJavaScriptValue(entry.path)};`
      : `const ${localPrefix}Load${index} = () => import(${serializeJavaScriptValue(entry.path)});`
  );
  const values = entries.map(
    (entry, index) =>
      `${serializeJavaScriptValue(entry.key)}: ${eager !== false ? `${localPrefix}Module${index}` : `${localPrefix}Load${index}`}`
  );
  return `${imports.join('\n')}\nexport const ${exportName} = { ${values.join(', ')} };`;
};

const resolveWorkspacePluginFiles = (
  workspaceRoot: string,
  catalog: readonly CatalogRecord[],
  selectedPluginIds: readonly string[]
) => {
  const selected = new Set(selectedPluginIds);
  const entries = catalog.filter(
    (entry) => entry.sourceType === 'workspace' && selected.has(entry.pluginId)
  );
  const byKind = {
    manifests: [] as { key: string; path: string }[],
    browser: [] as { key: string; path: string }[],
    descriptors: [] as { key: string; path: string }[],
    server: [] as { key: string; path: string }[],
    jobs: [] as { key: string; path: string }[],
    ownership: [] as { key: string; path: string }[],
  };
  for (const entry of entries) {
    const packageRoot = resolve(workspaceRoot, entry.sourceRef);
    const manifestPath = join(packageRoot, 'plugin.manifest.json');
    if (!existsSync(manifestPath))
      throw new Error(`workspace_plugin_manifest_missing:${entry.pluginId}`);
    const manifest = readJson(manifestPath);
    if (!isRecord(manifest) || manifest.pluginId !== entry.pluginId) {
      throw new Error(`workspace_plugin_manifest_mismatch:${entry.pluginId}`);
    }
    const keyPrefix = `../../../../${entry.sourceRef}`;
    byKind.manifests.push({ key: `${keyPrefix}/plugin.manifest.json`, path: manifestPath });
    const files = (names: readonly string[], target: { key: string; path: string }[]) => {
      for (const name of names) {
        const path = join(packageRoot, name);
        if (existsSync(path)) target.push({ key: `${keyPrefix}/${name}`, path });
      }
    };
    files(['src/browser.ts', 'src/browser.tsx', 'src/index.ts', 'src/index.tsx'], byKind.browser);
    files(
      entry.pluginId === 'waste-management'
        ? ['src/descriptor.ts']
        : ['src/plugin.tsx', 'src/descriptor.ts'],
      byKind.descriptors
    );
    files(['src/server.ts', 'src/server/index.ts'], byKind.server);
    files(['src/server.ts'], byKind.jobs);
    files(['src/generic-item-ownership.ts'], byKind.ownership);
    if (byKind.browser.filter(({ key }) => key.startsWith(`${keyPrefix}/`)).length === 0) {
      throw new Error(`workspace_plugin_browser_entry_missing:${entry.pluginId}`);
    }
    if (byKind.descriptors.filter(({ key }) => key.startsWith(`${keyPrefix}/`)).length === 0) {
      throw new Error(`workspace_plugin_descriptor_entry_missing:${entry.pluginId}`);
    }
  }
  return byKind;
};

export const createSelectedWorkspacePluginInputsPlugin = (
  appRoot: string,
  selectedPluginIds: readonly string[]
): Plugin => {
  const workspaceRoot = resolve(appRoot, '../..');
  const rawCatalog = readJson(join(appRoot, 'plugin-catalog.json'));
  if (!Array.isArray(rawCatalog)) throw new Error('plugin_catalog_invalid');
  const catalog = rawCatalog as CatalogRecord[];
  const knownIds = catalog
    .filter((entry) => entry.sourceType === 'workspace')
    .map((entry) => entry.pluginId);
  const unknownIds = selectedPluginIds.filter((pluginId) => !knownIds.includes(pluginId));
  if (unknownIds.length > 0) {
    throw new Error(`studio_plugin_selection_unknown:${unknownIds.sort().join(',')}`);
  }
  const files = resolveWorkspacePluginFiles(workspaceRoot, catalog, selectedPluginIds);
  const modules: Record<string, string> = {
    [`\0${selectedWorkspaceInputIds.catalog}`]:
      `import { installedPluginCatalogConfig } from 'virtual:studio-installed-plugin-catalog';\n` +
      `export const pluginCatalogConfig = [...${serializeJavaScriptValue(catalog.filter((entry) => entry.sourceType === 'workspace' && selectedPluginIds.includes(entry.pluginId)))}, ...installedPluginCatalogConfig];`,
    [`\0${selectedWorkspaceInputIds.client}`]: [
      `export { nodeManifestModules, nodePluginModuleLoaders, nodeDescriptorModuleLoaders } from 'virtual:studio-installed-plugin-client';`,
      renderStaticModuleMap(files.manifests, 'workspaceManifestModules', 'default'),
      renderStaticModuleMap(files.browser, 'workspacePluginModuleLoaders'),
      renderStaticModuleMap(files.descriptors, 'workspaceDescriptorModuleLoaders'),
      `export { pluginCatalogConfig } from 'virtual:studio-selected-plugin-catalog';`,
    ].join('\n'),
    [`\0${selectedWorkspaceInputIds.server}`]: [
      `export { nodeManifestModules, nodeServerModuleLoaders, nodeDescriptorModuleLoaders } from 'virtual:studio-installed-plugin-server';`,
      renderStaticModuleMap(files.manifests, 'workspaceManifestModules', 'default'),
      renderStaticModuleMap(files.server, 'workspaceServerModuleLoaders'),
      renderStaticModuleMap(files.descriptors, 'workspaceDescriptorModuleLoaders'),
    ].join('\n'),
    [`\0${selectedWorkspaceInputIds.jobs}`]: [
      `export { nodeJobModuleLoaders, nodeManifestModules } from 'virtual:studio-installed-plugin-server';`,
      renderStaticModuleMap(files.jobs, 'workspaceJobModuleLoaders'),
      renderStaticModuleMap(files.manifests, 'workspaceManifestModules', 'default'),
    ].join('\n'),
    [`\0${selectedWorkspaceInputIds.ownership}`]: `${renderStaticModuleMap(files.ownership, 'workspaceOwnershipModules', 'namespace')}\nexport const nodeOwnershipModules = {};`,
    [`\0${selectedWorkspaceInputIds.runtimeFactories}`]: selectedPluginIds.includes('ssf')
      ? `import { createStudioSsfAuthorizationProjectionRuntime } from ${serializeJavaScriptValue(join(appRoot, 'src/lib/ssf-authorization-projection-runtime.server.ts'))};\nexport const selectedPluginJobRuntimeFactories = { 'ssf.authorization-projection': () => createStudioSsfAuthorizationProjectionRuntime() };`
      : `export const selectedPluginJobRuntimeFactories = {};`,
  };
  return {
    name: 'studio-selected-workspace-plugin-inputs',
    resolveId(id) {
      return Object.hasOwn(modules, `\0${id}`) ? `\0${id}` : undefined;
    },
    load(id) {
      return modules[id];
    },
  };
};
