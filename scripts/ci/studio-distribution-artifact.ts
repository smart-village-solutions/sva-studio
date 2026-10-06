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
import { join, relative, resolve, sep } from 'node:path';
import { resolveInstalledPluginSources } from '../../apps/sva-studio-react/plugin-installed-inputs.vite.js';

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
  ],
};

const includedPluginIds: Readonly<Record<StudioDistribution, readonly string[]>> = {
  studio: [
    'categories',
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
  const installed = resolveInstalledPluginSources(resolve(outputRoot, '..'), distribution).filter(
    (source) => source.catalog.enabled
  );
  const generated = join(outputRoot, 'server', 'generated');
  mkdirSync(generated, { recursive: true });
  writeFileSync(
    join(generated, 'studio-distribution.json'),
    `${JSON.stringify({ schemaVersion: 1, distribution, includedPluginIds: [...includedPluginIds[distribution], ...installed.map((source) => source.catalog.pluginId)], installedPlugins: installed.map((source) => ({ pluginId: source.catalog.pluginId, sourceRef: source.catalog.sourceRef })), excludedWorkspacePackages: excludedPackages[distribution] }, null, 2)}\n`,
    'utf8'
  );
};

type BuildChunk = Readonly<{ fileName: string; modules: readonly string[] }>;

const readBuildChunks = (
  appRoot: string,
  environment: 'client' | 'ssr' | 'nitro'
): BuildChunk[] => {
  const path = join(appRoot, '.generated', 'chunk-provenance', `${environment}.json`);
  if (!existsSync(path)) throw new Error(`chunk_provenance_build_report_missing:${environment}`);
  const chunks: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (
    !Array.isArray(chunks) ||
    chunks.length === 0 ||
    chunks.some(
      (chunk) =>
        typeof chunk !== 'object' ||
        chunk === null ||
        typeof chunk.fileName !== 'string' ||
        !Array.isArray(chunk.modules) ||
        chunk.modules.some((module: unknown) => typeof module !== 'string')
    )
  )
    throw new Error(`chunk_provenance_build_report_invalid:${environment}`);
  return chunks as BuildChunk[];
};

const listJavaScriptFiles = (root: string): string[] => {
  const files: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`chunk_provenance_symlink_present:${path}`);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && /\.(?:[cm]?js|map)$/.test(entry.name)) {
        files.push(relative(root, path).split(sep).join('/'));
      }
    }
  };
  walk(root);
  return files.sort();
};

const pluginSource = (
  moduleId: string,
  installed: readonly { packageRoot: string; sourceRef: string }[]
): string | undefined => {
  const normalized = moduleId.replaceAll('\\', '/');
  const selected = installed.find(
    ({ packageRoot, sourceRef }) =>
      normalized.startsWith(`${packageRoot}/`) || normalized.includes(`/node_modules/${sourceRef}/`)
  );
  if (selected) return selected.sourceRef;
  return (
    /(?:^|\/)packages\/(plugin-[a-z0-9-]+)\/(?:src|dist)\//.exec(normalized)?.[1] ??
    /(?:^|\/)node_modules\/@sva\/(plugin-[a-z0-9-]+)\//.exec(normalized)?.[1] ??
    /(?:^|\/)node_modules\/\.pnpm\/@sva\+(plugin-[a-z0-9-]+)@/.exec(normalized)?.[1]
  );
};

const resolveNitroModules = (
  chunk: BuildChunk,
  ssrByFile: ReadonlyMap<string, readonly string[]>
): string[] => {
  const modules = [...chunk.modules];
  for (const id of chunk.modules) {
    const marker = '/.nitro/vite/services/ssr/';
    const offset = id.replaceAll('\\', '/').indexOf(marker);
    if (offset < 0) continue;
    const ssrFile = id.slice(offset + marker.length);
    const sources = ssrByFile.get(ssrFile);
    if (!sources) throw new Error(`chunk_provenance_unknown_ssr_chunk:${ssrFile}`);
    modules.push(...sources);
  }
  return modules;
};

const writeChunkProvenance = (outputRoot: string, distribution: StudioDistribution): void => {
  assertDirectory(outputRoot);
  const appRoot = resolve(outputRoot, '..');
  const installed = resolveInstalledPluginSources(appRoot, distribution)
    .filter((source) => source.catalog.enabled)
    .map((source) => ({
      packageRoot: source.packageRoot.replaceAll('\\', '/'),
      sourceRef: source.catalog.sourceRef,
    }));
  const client = readBuildChunks(appRoot, 'client');
  const ssr = readBuildChunks(appRoot, 'ssr');
  const nitro = readBuildChunks(appRoot, 'nitro');
  const ssrByFile = new Map(ssr.map((chunk) => [chunk.fileName, chunk.modules]));
  if (ssrByFile.size !== ssr.length) throw new Error('chunk_provenance_duplicate_ssr_chunk');
  const expected = new Map<string, readonly string[]>();
  for (const chunk of client) {
    const path = `public/${chunk.fileName}`;
    // Nitro can drop an emitted CSS-only browser entry after Vite's bundle hook.
    if (!existsSync(join(outputRoot, path))) continue;
    if (expected.has(path)) throw new Error(`chunk_provenance_duplicate_chunk:${path}`);
    expected.set(path, chunk.modules);
  }
  for (const chunk of nitro) {
    const path = `server/${chunk.fileName}`;
    if (expected.has(path)) throw new Error(`chunk_provenance_duplicate_chunk:${path}`);
    expected.set(path, resolveNitroModules(chunk, ssrByFile));
  }
  const copiedTslib = [
    'server/node_modules/tslib/tslib.js',
    'server/node_modules/tslib/tslib.es6.js',
    'server/node_modules/tslib/tslib.es6.mjs',
    'server/node_modules/tslib/modules/index.js',
  ];
  for (const path of copiedTslib) {
    if (expected.has(path)) throw new Error(`chunk_provenance_duplicate_chunk:${path}`);
    expected.set(path, []);
  }
  const actual = [
    ...listJavaScriptFiles(join(outputRoot, 'public')).map((path) => `public/${path}`),
    ...listJavaScriptFiles(join(outputRoot, 'server')).map((path) => `server/${path}`),
  ].sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected.keys()].sort())) {
    throw new Error('chunk_provenance_final_file_inventory_mismatch');
  }
  const excluded = new Set(excludedPackages[distribution]);
  const allowed = new Set([
    'plugin-sdk',
    ...includedPluginIds[distribution].map((id) => `plugin-${id}`),
    ...installed.map((source) => source.sourceRef),
  ]);
  const chunks = actual.map((path) => {
    const sources = expected.get(path);
    if (!sources) throw new Error(`chunk_provenance_source_missing:${path}`);
    const pluginPackages = [
      ...new Set(
        sources
          .map((source) => pluginSource(source, installed))
          .filter((name) => name !== undefined)
      ),
    ].sort();
    for (const name of pluginPackages) {
      if (excluded.has(name) || !allowed.has(name)) {
        throw new Error(`chunk_provenance_excluded_plugin:${name}:${path}`);
      }
    }
    return {
      path,
      sha256: createHash('sha256')
        .update(readFileSync(join(outputRoot, path)))
        .digest('hex'),
      pluginPackages,
    };
  });
  const required = [
    distribution === 'ssf' ? 'plugin-ssf' : 'plugin-news',
    ...installed.map((source) => source.sourceRef),
  ];
  for (const name of required) {
    if (
      !chunks.some(
        (chunk) => chunk.path.startsWith('public/') && chunk.pluginPackages.includes(name)
      ) ||
      !chunks.some(
        (chunk) => chunk.path.startsWith('server/_ssr/') && chunk.pluginPackages.includes(name)
      )
    ) {
      throw new Error(`chunk_provenance_required_plugin_missing:${name}`);
    }
  }
  const generated = join(outputRoot, 'server', 'generated');
  mkdirSync(generated, { recursive: true });
  writeFileSync(
    join(generated, 'studio-chunk-provenance.json'),
    `${JSON.stringify({ schemaVersion: 1, distribution, chunks }, null, 2)}\n`,
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
} else if (command === 'write-chunk-provenance') {
  writeChunkProvenance(targetPath, distribution);
} else if (command === 'prune-deploy') {
  pruneDeploy(targetPath, distribution);
} else {
  throw new Error(`invalid_studio_distribution_artifact_command:${command ?? ''}`);
}
