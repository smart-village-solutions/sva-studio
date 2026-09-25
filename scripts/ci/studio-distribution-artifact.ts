import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const distributions = ['studio', 'ssf'] as const;
type StudioDistribution = (typeof distributions)[number];

const excludedPackages: Readonly<Record<StudioDistribution, readonly string[]>> = {
  studio: ['plugin-ssf'],
  ssf: [
    'plugin-categories',
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

const includedPluginIds: Readonly<Record<StudioDistribution, readonly string[]>> = {
  studio: ['categories', 'cockpit-cards', 'events', 'faq', 'generic-items', 'news', 'poi', 'projects', 'surveys', 'waste-management'],
  ssf: ['ssf'],
};

const parseDistribution = (value: string | undefined): StudioDistribution => {
  if (value && (distributions as readonly string[]).includes(value)) {
    return value as StudioDistribution;
  }
  throw new Error(`invalid_studio_distribution:${value ?? ''}`);
};

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

const writeManifest = (outputRoot: string, distribution: StudioDistribution): void => {
  assertDirectory(outputRoot);
  const generated = join(outputRoot, 'server', 'generated');
  mkdirSync(generated, { recursive: true });
  writeFileSync(
    join(generated, 'studio-distribution.json'),
    `${JSON.stringify({ schemaVersion: 1, distribution, includedPluginIds: includedPluginIds[distribution] }, null, 2)}\n`,
    'utf8'
  );
};

const pruneDeploy = (deployRoot: string, distribution: StudioDistribution): void => {
  assertDirectory(deployRoot);
  for (const packageName of excludedPackages[distribution]) {
    removeDeployedWorkspacePackage(deployRoot, packageName);
  }
};

const [command, target, distributionInput] = process.argv.slice(2);
const distribution = parseDistribution(distributionInput);
const targetPath = resolve(target ?? '');

if (command === 'write-manifest') {
  writeManifest(targetPath, distribution);
} else if (command === 'prune-deploy') {
  pruneDeploy(targetPath, distribution);
} else {
  throw new Error(`invalid_studio_distribution_artifact_command:${command ?? ''}`);
}
