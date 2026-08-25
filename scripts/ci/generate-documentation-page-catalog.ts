import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { PluginDefinition, PluginManifest } from '@sva/plugin-sdk';

import type { AppRouteBindings } from '../../packages/routing/src/index.ts';
import { collectDocumentationPageCatalog } from '../../packages/routing/src/documentation-page-catalog.ts';
import { appAdminResources } from '../../apps/sva-studio-react/src/routing/admin-resources.ts';
import {
  extractPluginDefinition,
  getWorkspacePluginModuleCandidates,
  type StudioPluginCatalogConfigEntry,
} from '../../apps/sva-studio-react/src/lib/plugin-catalog-loader.ts';

const outputPath = resolve('docs/user-documentation/page-catalog.json');
const pluginCatalogPath = resolve('apps/sva-studio-react/plugin-catalog.json');
const component = () => null;
const bindings = new Proxy(
  {},
  {
    get: () => component,
    getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true, value: component }),
  }
) as AppRouteBindings;

const readPluginCatalog = async (): Promise<readonly StudioPluginCatalogConfigEntry[]> => {
  const value: unknown = JSON.parse(await readFile(pluginCatalogPath, 'utf8'));
  if (!Array.isArray(value)) {
    throw new Error('invalid_studio_plugin_catalog');
  }
  return value as readonly StudioPluginCatalogConfigEntry[];
};

const loadWorkspacePlugin = async (
  entry: StudioPluginCatalogConfigEntry
): Promise<PluginDefinition> => {
  const pluginRoot = resolve(entry.sourceRef);
  const manifest = JSON.parse(
    await readFile(resolve(pluginRoot, 'plugin.manifest.json'), 'utf8')
  ) as PluginManifest;
  for (const candidate of getWorkspacePluginModuleCandidates(manifest)) {
    const modulePath = resolve(pluginRoot, candidate);
    if (!modulePath.startsWith(`${pluginRoot}/`)) {
      continue;
    }
    const exists = await access(modulePath).then(
      () => true,
      () => false
    );
    if (!exists) {
      continue;
    }
    const definition = extractPluginDefinition(await import(pathToFileURL(modulePath).href));
    if (definition?.id === entry.pluginId) {
      return definition;
    }
  }
  throw new Error(`documentation_plugin_module_missing:${entry.pluginId}`);
};

const loadPackagePlugin = async (
  entry: StudioPluginCatalogConfigEntry
): Promise<PluginDefinition> => {
  const definition = extractPluginDefinition(await import(entry.sourceRef));
  if (definition?.id !== entry.pluginId) {
    throw new Error(`documentation_plugin_module_missing:${entry.pluginId}`);
  }
  return definition;
};

const loadEnabledPlugins = async (): Promise<readonly PluginDefinition[]> => {
  const entries = (await readPluginCatalog()).filter((entry) => entry.enabled);
  return Promise.all(
    entries.map((entry) =>
      entry.sourceType === 'workspace' ? loadWorkspacePlugin(entry) : loadPackagePlugin(entry)
    )
  );
};

export const createDocumentationPageCatalogJson = async (): Promise<string> =>
  `${JSON.stringify(
    collectDocumentationPageCatalog({
      bindings,
      adminResources: appAdminResources,
      plugins: await loadEnabledPlugins(),
    }),
    null,
    2
  )}\n`;

const run = async (): Promise<void> => {
  const mode = process.argv[2];
  const generated = await createDocumentationPageCatalogJson();
  if (mode === '--write') {
    await writeFile(outputPath, generated, 'utf8');
    return;
  }
  if (mode === '--check') {
    const current = await readFile(outputPath, 'utf8').catch(() => '');
    if (current !== generated) {
      throw new Error('documentation_page_catalog_outdated');
    }
    return;
  }
  throw new Error('usage: generate-documentation-page-catalog.ts --write|--check');
};

void run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
