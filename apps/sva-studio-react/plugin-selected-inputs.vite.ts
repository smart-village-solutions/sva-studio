import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import {
  isRecord,
  readJson,
  serializeJavaScriptValue,
  type CatalogRecord,
} from './plugin-installed-inputs.sources.js';

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
