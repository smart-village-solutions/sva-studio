import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseDocument } from 'yaml';
import type { Plugin } from 'vite';
import {
  isRecord,
  readCatalog,
  readJson,
  resolveInstalledPluginSources,
  serializeJavaScriptValue,
  type CatalogRecord,
  type Distribution,
  type EntryKind,
  type InstalledSource,
} from './plugin-installed-inputs.sources.js';

export { resolveInstalledPluginSources };
export { createSelectedWorkspacePluginInputsPlugin } from './plugin-selected-inputs.vite.js';

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

const javascriptStringLiteral = (value: string): string => serializeJavaScriptValue(value);

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
