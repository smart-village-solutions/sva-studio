import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const source = 'https://github.com/smart-village-solutions/sva-studio';
const repositories = {
  studio: 'ghcr.io/smart-village-solutions/sva-studio',
  ssf: 'ghcr.io/smart-village-solutions/sva-studio-ssf',
};
const regularPlugins = [
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
];
const pluginIds = { studio: regularPlugins, ssf: ['ssf'] };
const packagedRegularPlugins = regularPlugins.filter((id) => id !== 'waste-management');
const excludedWorkspacePackages = {
  studio: ['plugin-ssf'],
  ssf: [...regularPlugins.map((id) => `plugin-${id}`)],
};

const fail = (code) => {
  throw new Error(code);
};

const verifyChunkProvenance = (distribution, provenance, files) => {
  if (
    provenance?.schemaVersion !== 1 ||
    provenance.distribution !== distribution ||
    !Array.isArray(provenance.chunks) ||
    provenance.chunks.length === 0
  )
    fail('chunk_provenance_manifest_invalid');
  if (!Array.isArray(files) || files.length === 0) fail('chunk_provenance_file_inventory_invalid');
  const allowed = new Set(['plugin-sdk', ...pluginIds[distribution].map((id) => `plugin-${id}`)]);
  const excluded = new Set(excludedWorkspacePackages[distribution]);
  const paths = new Set();
  const actual = new Map();
  for (const file of files) {
    if (
      typeof file?.path !== 'string' ||
      !/^(?:public|server)\/[^\s]+\.(?:[cm]?js)$/.test(file.path) ||
      file.path.split('/').includes('..') ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      actual.has(file.path)
    )
      fail('chunk_provenance_file_inventory_invalid');
    actual.set(file.path, file.sha256);
  }
  for (const chunk of provenance.chunks) {
    if (
      typeof chunk?.path !== 'string' ||
      !/^[a-f0-9]{64}$/.test(chunk.sha256) ||
      !Array.isArray(chunk.pluginPackages) ||
      paths.has(chunk.path)
    )
      fail('chunk_provenance_manifest_invalid');
    paths.add(chunk.path);
    if (actual.get(chunk.path) !== chunk.sha256)
      fail(`chunk_provenance_hash_mismatch:${chunk.path}`);
    for (const name of chunk.pluginPackages) {
      if (typeof name !== 'string' || !/^plugin-[a-z0-9-]+$/.test(name)) {
        fail('chunk_provenance_manifest_invalid');
      }
      if (excluded.has(name) || !allowed.has(name))
        fail(`chunk_provenance_excluded_plugin:${name}`);
    }
  }
  if (paths.size !== actual.size) fail('chunk_provenance_file_inventory_mismatch');
  const required = distribution === 'ssf' ? 'plugin-ssf' : 'plugin-news';
  if (
    !provenance.chunks.some(
      (chunk) => chunk.path.startsWith('public/') && chunk.pluginPackages.includes(required)
    ) ||
    !provenance.chunks.some(
      (chunk) => chunk.path.startsWith('server/_ssr/') && chunk.pluginPackages.includes(required)
    )
  ) {
    fail(`chunk_provenance_required_plugin_missing:${required}`);
  }
  return {
    chunks: paths.size,
    pluginPackages: [...new Set(provenance.chunks.flatMap((chunk) => chunk.pluginPackages))].sort(),
  };
};

export const verifyStudioImageContract = (input) => {
  const {
    imageRef,
    expectedRevision,
    distribution,
    inspection,
    runtimeManifest,
    packages,
    chunkProvenance,
    chunkFiles,
  } = input;
  const repository = repositories[distribution];
  if (!repository) fail('invalid_studio_distribution');
  if (!/^[a-f0-9]{40}$/.test(expectedRevision)) fail('invalid_expected_revision');
  const digestPrefix = `${repository}@sha256:`;
  if (
    typeof imageRef !== 'string' ||
    !imageRef.startsWith(digestPrefix) ||
    !/^[a-f0-9]{64}$/.test(imageRef.slice(digestPrefix.length))
  )
    fail('invalid_image_digest_ref');
  const image = Array.isArray(inspection) && inspection.length === 1 ? inspection[0] : null;
  if (!image || !Array.isArray(image.RepoDigests) || !image.RepoDigests.includes(imageRef)) {
    fail('image_digest_mismatch');
  }
  const labels = image.Config?.Labels;
  if (labels?.['org.opencontainers.image.source'] !== source) fail('image_repository_mismatch');
  if (labels?.['org.opencontainers.image.revision'] !== expectedRevision)
    fail('image_revision_mismatch');
  if (labels?.['com.sva-studio.distribution'] !== distribution) fail('image_distribution_mismatch');
  const runtimeDistributions = Array.isArray(image.Config?.Env)
    ? image.Config.Env.filter(
        (entry) => typeof entry === 'string' && entry.startsWith('SVA_STUDIO_DISTRIBUTION=')
      )
    : [];
  if (
    runtimeDistributions.length !== 1 ||
    runtimeDistributions[0] !== `SVA_STUDIO_DISTRIBUTION=${distribution}`
  ) {
    fail('image_runtime_distribution_mismatch');
  }
  if (
    runtimeManifest?.schemaVersion !== 1 ||
    runtimeManifest.distribution !== distribution ||
    JSON.stringify(runtimeManifest.includedPluginIds) !== JSON.stringify(pluginIds[distribution]) ||
    JSON.stringify(runtimeManifest.excludedWorkspacePackages) !==
      JSON.stringify(excludedWorkspacePackages[distribution])
  ) {
    fail('runtime_manifest_mismatch');
  }
  if (
    !Array.isArray(packages) ||
    packages.some((name) => typeof name !== 'string' || !/^[a-z0-9-]+$/.test(name))
  ) {
    fail('invalid_workspace_package_inventory');
  }
  const present = new Set(packages);
  if (!present.has('plugin-sdk')) fail('workspace_package_inventory_incomplete');
  for (const id of [...regularPlugins, 'ssf']) {
    const shouldBePresent =
      distribution === 'studio' ? packagedRegularPlugins.includes(id) : id === 'ssf';
    if (present.has(`plugin-${id}`) !== shouldBePresent)
      fail(`plugin_package_inventory_mismatch:${id}`);
  }
  for (const name of present) {
    if (
      name.startsWith('plugin-') &&
      name !== 'plugin-sdk' &&
      ![...regularPlugins, 'ssf'].some((id) => name === `plugin-${id}`)
    ) {
      fail(`unexpected_plugin_package_present:${name}`);
    }
  }
  for (const name of excludedWorkspacePackages[distribution]) {
    if (present.has(name)) fail(`excluded_workspace_package_present:${name}`);
  }
  if (!present.has('waste-management-contracts') || !present.has('waste-management-runtime')) {
    fail('waste_management_workspace_package_missing');
  }
  const verifiedChunks = verifyChunkProvenance(distribution, chunkProvenance, chunkFiles);
  return {
    imageRef,
    revision: expectedRevision,
    distribution,
    includedPluginIds: pluginIds[distribution],
    excludedWorkspacePackages: excludedWorkspacePackages[distribution],
    presentWorkspacePackages: [...present]
      .filter((name) => name.startsWith('plugin-') || name.startsWith('waste-management-'))
      .sort(),
    verifiedChunks,
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    process.stdout.write(`${JSON.stringify(verifyStudioImageContract(input))}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'image_contract_invalid'}\n`);
    process.exitCode = 1;
  }
}
