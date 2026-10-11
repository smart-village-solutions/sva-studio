import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PluginManifest } from '@sva/plugin-sdk';
import { studioHostModuleIamContracts } from '@sva/studio-module-iam';
import {
  createStudioPluginCatalogReport,
  getWorkspacePluginDescriptorCandidates,
} from '../../apps/sva-studio-react/src/lib/plugin-catalog-loader.js';
import { appAdminResources } from '../../apps/sva-studio-react/src/routing/admin-resources.js';
import { resolveInstalledPluginSources } from '../../apps/sva-studio-react/plugin-installed-inputs.vite.js';
import pluginCatalog from '../../apps/sva-studio-react/plugin-catalog.json';
import { writeChunkProvenance } from './studio-chunk-provenance.js';

const distributions = ['studio', 'ssf', 'custom'] as const;
type StudioDistribution = (typeof distributions)[number];

const excludedPackages: Readonly<Record<'studio' | 'ssf', readonly string[]>> = {
  studio: ['plugin-ssf'],
  ssf: [
    'plugin-categories',
    'plugin-cockpit',
    'plugin-cockpit-cards',
    'plugin-events',
    'plugin-faq',
    'plugin-generic-items',
    'plugin-news',
    'plugin-poi',
    'plugin-projects',
    'plugin-surveys',
    'plugin-waste-management',
    'waste-management-contracts',
    'waste-management-runtime',
  ],
};

const includedPluginIds: Readonly<Record<'studio' | 'ssf', readonly string[]>> = {
  studio: [
    'categories',
    'cockpit',
    'cockpit-cards',
    'events',
    'faq',
    'generic-items',
    'news',
    'poi',
    'projects',
    'surveys',
    'waste-management',
  ],
  ssf: ['ssf'],
};

const workspacePluginIds = pluginCatalog
  .filter(({ sourceType, enabled }) => sourceType === 'workspace' && enabled)
  .map(({ pluginId }) => pluginId);
const builtInPluginIds: Readonly<Record<'studio' | 'ssf', readonly string[]>> = {
  studio: includedPluginIds.studio,
  ssf: ['ssf'],
};

const parseSelection = (
  distributionInput: string | undefined,
  pluginIdsInput: string | undefined
): Readonly<{ distribution: StudioDistribution; pluginIds: readonly string[] }> => {
  const distribution = distributionInput?.trim() || (pluginIdsInput?.trim() ? 'custom' : 'studio');
  if (!(distributions as readonly string[]).includes(distribution)) {
    throw new Error(`invalid_studio_distribution:${distribution}`);
  }
  if (distribution !== 'custom') {
    if (pluginIdsInput?.trim())
      throw new Error('studio_distribution_and_plugin_selection_conflict');
    return {
      distribution: distribution as 'studio' | 'ssf',
      pluginIds: builtInPluginIds[distribution as 'studio' | 'ssf'],
    };
  }
  const supplied = pluginIdsInput?.split(',').map((id) => id.trim()) ?? [];
  if (supplied.length === 0 || supplied.some((id) => !id)) {
    throw new Error('studio_plugin_selection_required');
  }
  if (new Set(supplied).size !== supplied.length) {
    throw new Error('studio_plugin_selection_duplicate');
  }
  const unknown = supplied.filter((id) => !workspacePluginIds.includes(id));
  if (unknown.length > 0)
    throw new Error(`studio_plugin_selection_unknown:${unknown.sort().join(',')}`);
  const selected = new Set(supplied);
  return { distribution: 'custom', pluginIds: workspacePluginIds.filter((id) => selected.has(id)) };
};

const packagesFor = (distribution: StudioDistribution, pluginIds: readonly string[]) => {
  const selected = new Set(pluginIds);
  return distribution === 'custom'
    ? workspacePluginIds.filter((id) => !selected.has(id)).map((id) => `plugin-${id}`)
    : excludedPackages[distribution];
};

const pluginSetFingerprint = (pluginIds: readonly string[]): string =>
  createHash('sha256').update(JSON.stringify(pluginIds)).digest('hex');

const removePath = (path: string): void => {
  if (existsSync(path)) rmSync(path, { force: true, recursive: true });
};

const removeDeployedWorkspacePackage = (deployRoot: string, packageName: string): void => {
  const nodeModules = join(deployRoot, 'node_modules');
  removePath(join(nodeModules, '@sva', packageName));

  const pnpmStore = join(nodeModules, '.pnpm');
  if (!existsSync(pnpmStore)) return;
  for (const entry of readdirSync(pnpmStore, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    removePath(join(pnpmStore, entry.name, 'node_modules', '@sva', packageName));
  }
};

const assertDirectory = (path: string): void => {
  if (!existsSync(path) || !lstatSync(path).isDirectory()) {
    throw new Error(`distribution_artifact_directory_missing:${path}`);
  }
};

const createProvisioningSnapshot = async (selectedPluginIds: readonly string[]) => {
  const workspaceRoot = resolve(dirname(process.argv[1]!), '../..');
  const report = await createStudioPluginCatalogReport({
    catalogConfig: pluginCatalog.filter(
      ({ sourceType, pluginId }) =>
        sourceType === 'workspace' && selectedPluginIds.includes(pluginId)
    ) as Parameters<typeof createStudioPluginCatalogReport>[0]['catalogConfig'],
    resolveManifest: (entry) =>
      JSON.parse(
        readFileSync(join(workspaceRoot, entry.sourceRef, 'plugin.manifest.json'), 'utf8')
      ) as PluginManifest,
    resolvePluginModule: async (entry, manifest) => {
      for (const candidate of getWorkspacePluginDescriptorCandidates(manifest)) {
        const path = join(workspaceRoot, entry.sourceRef, candidate);
        if (existsSync(path)) return import(pathToFileURL(path).href);
      }
      return undefined;
    },
    adminResources: appAdminResources,
  });
  if (report.activeCatalog.length !== selectedPluginIds.length || report.issues.length > 0) {
    throw new Error(
      `custom_plugin_catalog_rejected:${report.issues.map(({ code }) => code).join(',')}`
    );
  }
  const { snapshot } = report;
  return {
    activationPolicies: snapshot.tenantActivationPolicySnapshot,
    moduleIamContracts: [
      ...snapshot.registry.pluginModuleIamContracts,
      ...studioHostModuleIamContracts,
    ],
    tenantLifecycles: snapshot.registry.tenantLifecycles,
  };
};

const writeManifest = async (
  outputRoot: string,
  distribution: StudioDistribution,
  selectedPluginIds: readonly string[]
): Promise<void> => {
  assertDirectory(outputRoot);
  const installed = resolveInstalledPluginSources(
    resolve(outputRoot, '..'),
    distribution,
    selectedPluginIds
  ).filter((source) => source.catalog.enabled);
  const generated = join(outputRoot, 'server', 'generated');
  mkdirSync(generated, { recursive: true });
  writeFileSync(
    join(generated, 'studio-distribution.json'),
    `${JSON.stringify({ schemaVersion: 1, distribution, ...(distribution === 'custom' ? { pluginSetFingerprint: pluginSetFingerprint(selectedPluginIds), provisioningSnapshot: await createProvisioningSnapshot(selectedPluginIds) } : {}), includedPluginIds: [...selectedPluginIds, ...installed.map((source) => source.catalog.pluginId)], installedPlugins: installed.map((source) => ({ pluginId: source.catalog.pluginId, sourceRef: source.catalog.sourceRef })), excludedWorkspacePackages: packagesFor(distribution, selectedPluginIds) }, null, 2)}\n`,
    'utf8'
  );
};

const pruneDeploy = (
  deployRoot: string,
  distribution: StudioDistribution,
  selectedPluginIds: readonly string[]
): void => {
  assertDirectory(deployRoot);
  for (const packageName of packagesFor(distribution, selectedPluginIds)) {
    removeDeployedWorkspacePackage(deployRoot, packageName);
  }
};

const [command, target, distributionInput] = process.argv.slice(2);
const { distribution, pluginIds } = parseSelection(
  distributionInput,
  process.env.SVA_STUDIO_PLUGIN_IDS
);
const targetPath = resolve(target ?? '');

if (command === 'selection') {
  process.stdout.write(
    `${JSON.stringify({ distribution, pluginIds, pluginSetFingerprint: pluginSetFingerprint(pluginIds) })}\n`
  );
} else if (command === 'write-manifest') {
  void writeManifest(targetPath, distribution, pluginIds).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
} else if (command === 'write-chunk-provenance') {
  assertDirectory(targetPath);
  writeChunkProvenance(targetPath, distribution, pluginIds, packagesFor(distribution, pluginIds));
} else if (command === 'prune-deploy') {
  pruneDeploy(targetPath, distribution, pluginIds);
} else {
  throw new Error(`invalid_studio_distribution_artifact_command:${command ?? ''}`);
}
