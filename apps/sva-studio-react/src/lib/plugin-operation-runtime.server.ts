import {
  registerPluginOperationExecutionHandlers,
  type PluginOperationExecutionRegistration,
} from '@sva/auth-runtime/server';
import type { PluginCatalogEntry, PluginManifest } from '@sva/plugin-sdk';
import studioPluginCatalogConfig from '../../plugin-catalog.json';

import { createPluginBuildRegistries, resolvePluginModuleFromRegistry } from './plugin-build-registry.js';
import {
  createStudioPluginCatalogReport,
  getPackagePluginModuleCandidates,
  getWorkspacePluginModuleCandidates,
  type StudioPluginCatalogConfigEntry,
} from './plugin-catalog-loader.js';
import { createWasteManagementOperationRuntime } from './waste-management-operations.server.js';

type PluginOperationExecutionHandler = import('@sva/auth-runtime/server').PluginOperationExecutionHandler;
type PluginJobModuleFactory = (runtime: unknown) => Readonly<Record<string, PluginOperationExecutionHandler>>;
type PluginJobModuleExports = {
  readonly createPluginJobExecutionHandlers?: PluginJobModuleFactory;
};
type PluginJobModuleLoader = () => Promise<PluginJobModuleExports>;
type PluginJobRuntimeFactory = () => unknown;
type PluginJobRuntimeFactoryRegistry = Readonly<Record<string, PluginJobRuntimeFactory>>;
type StudioPluginJobSource = {
  readonly pluginId: string;
  readonly sourceType: PluginCatalogEntry['sourceType'];
  readonly sourceRef: string;
  readonly manifest: PluginManifest;
};

const workspaceJobModuleLoaders = import.meta.glob('../../../../packages/plugin-*/src/server.ts') as Record<
  string,
  PluginJobModuleLoader
>;
const workspacePluginModuleLoaders = {
  ...import.meta.glob('../../../../packages/plugin-*/src/index.ts'),
  ...import.meta.glob('../../../../packages/plugin-*/src/index.tsx'),
} as Record<string, () => Promise<Record<string, unknown>>>;
const nodeJobModuleLoaders = {
  ...import.meta.glob('../../../../node_modules/plugin-*/dist/server.js'),
  ...import.meta.glob('../../../../node_modules/plugin-*/src/server.ts'),
  ...import.meta.glob('../../../../node_modules/@*/plugin-*/dist/server.js'),
  ...import.meta.glob('../../../../node_modules/@*/plugin-*/src/server.ts'),
} as Record<string, PluginJobModuleLoader>;
const nodePluginModuleLoaders = {
  ...import.meta.glob('../../../../node_modules/plugin-*/dist/index.js'),
  ...import.meta.glob('../../../../node_modules/plugin-*/src/index.ts'),
  ...import.meta.glob('../../../../node_modules/plugin-*/src/index.tsx'),
  ...import.meta.glob('../../../../node_modules/@*/plugin-*/dist/index.js'),
  ...import.meta.glob('../../../../node_modules/@*/plugin-*/src/index.ts'),
  ...import.meta.glob('../../../../node_modules/@*/plugin-*/src/index.tsx'),
} as Record<string, () => Promise<Record<string, unknown>>>;
const workspaceManifestModules = import.meta.glob('../../../../packages/plugin-*/plugin.manifest.json', {
  eager: true,
  import: 'default',
}) as Record<string, PluginManifest>;
const nodeManifestModules = {
  ...import.meta.glob('../../../../node_modules/*/plugin.manifest.json', { eager: true, import: 'default' }),
  ...import.meta.glob('../../../../node_modules/@*/*/plugin.manifest.json', { eager: true, import: 'default' }),
} as Record<string, PluginManifest>;

const {
  workspaceManifestRegistry,
  nodeManifestRegistry,
  workspacePluginRegistry: workspaceJobModuleRegistry,
  nodePluginRegistry: nodeJobModuleRegistry,
} = createPluginBuildRegistries({
  workspaceManifestModules,
  workspacePluginModuleLoaders: workspaceJobModuleLoaders,
  nodeManifestModules,
  nodePluginModuleLoaders: nodeJobModuleLoaders,
});
const {
  workspacePluginRegistry: workspaceBrowserPluginRegistry,
  nodePluginRegistry: nodeBrowserPluginRegistry,
} = createPluginBuildRegistries({
  workspaceManifestModules,
  workspacePluginModuleLoaders,
  nodeManifestModules,
  nodePluginModuleLoaders,
});

const studioPluginCatalogConfigEntries = studioPluginCatalogConfig as readonly StudioPluginCatalogConfigEntry[];
const resolveStudioPluginManifest = (entry: StudioPluginCatalogConfigEntry): PluginManifest | undefined =>
  entry.sourceType === 'workspace' ? workspaceManifestRegistry.get(entry.sourceRef) : nodeManifestRegistry.get(entry.sourceRef);

const resolveWorkspacePluginModule = (
  entry: PluginCatalogEntry,
  manifest: PluginManifest
): Promise<Record<string, unknown> | undefined> =>
  resolvePluginModuleFromRegistry(workspaceBrowserPluginRegistry, entry.sourceRef, getWorkspacePluginModuleCandidates(manifest));

const resolveNodePluginModule = (
  entry: PluginCatalogEntry,
  manifest: PluginManifest
): Promise<Record<string, unknown> | undefined> =>
  resolvePluginModuleFromRegistry(nodeBrowserPluginRegistry, entry.sourceRef, getPackagePluginModuleCandidates(manifest));

const studioPluginCatalogReport = await createStudioPluginCatalogReport({
  catalogConfig: studioPluginCatalogConfigEntries,
  resolveManifest: resolveStudioPluginManifest,
  resolvePluginModule: (entry, manifest) =>
    entry.sourceType === 'workspace'
      ? resolveWorkspacePluginModule(entry, manifest)
      : resolveNodePluginModule(entry, manifest),
});
const studioDeclaredPluginOperationJobTypeIds = studioPluginCatalogReport.snapshot.registry.jobTypes.map(
  (jobType) => jobType.jobTypeId
) as readonly string[];
const studioPluginJobSources = studioPluginCatalogReport.snapshot.pluginSources.filter(
  (entry): entry is StudioPluginJobSource => Boolean(entry.manifest.entryPoints.jobs)
);

const normalizeEntryPath = (value: string): string => value.replace(/^[.][/]/, '').trim();

const getWorkspaceJobModuleCandidates = (jobsEntry: string): readonly string[] => {
  const normalizedJobsEntry = normalizeEntryPath(jobsEntry);
  if (normalizedJobsEntry.length === 0) {
    return ['src/server.ts'];
  }

  const candidates = [normalizedJobsEntry];
  if (normalizedJobsEntry.startsWith('dist/') && normalizedJobsEntry.endsWith('.js')) {
    candidates.push(`src/${normalizedJobsEntry.slice('dist/'.length, -'.js'.length)}.ts`);
  }
  if (normalizedJobsEntry.endsWith('.js')) {
    candidates.push(normalizedJobsEntry.slice(0, -'.js'.length) + '.ts');
  }
  if (!candidates.includes('src/server.ts')) {
    candidates.push('src/server.ts');
  }

  return candidates;
};

const getPackageJobModuleCandidates = (jobsEntry: string): readonly string[] => {
  const candidates = [] as string[];
  const normalizedJobsEntry = normalizeEntryPath(jobsEntry);
  if (normalizedJobsEntry.length > 0) {
    candidates.push(normalizedJobsEntry);
  }
  for (const fallback of ['dist/server.js', 'src/server.ts']) {
    if (!candidates.includes(fallback)) {
      candidates.push(fallback);
    }
  }
  return candidates;
};

const resolvePluginJobModule = (input: {
  readonly sourceRef: string;
  readonly jobsEntry: string;
  readonly sourceType: string;
}): Promise<PluginJobModuleExports | undefined> => {
  const candidates =
    input.sourceType === 'workspace'
      ? getWorkspaceJobModuleCandidates(input.jobsEntry)
      : getPackageJobModuleCandidates(input.jobsEntry);
  const registry = input.sourceType === 'workspace' ? workspaceJobModuleRegistry : nodeJobModuleRegistry;

  for (const relativePath of candidates) {
    const moduleLoader = registry.get(`${input.sourceRef}::${relativePath}`);
    if (moduleLoader) {
      return moduleLoader();
    }
  }

  return Promise.resolve(undefined);
};

const studioPluginJobRuntimeFactories: PluginJobRuntimeFactoryRegistry = {
  'waste-management.operations': () => createWasteManagementOperationRuntime(),
};

const resolvePluginJobRuntimeRequirement = (input: {
  readonly pluginId: string;
  readonly manifest: PluginManifest;
}): string => {
  const jobsEntry = input.manifest.entryPoints.jobs;
  const runtimeRequirement = input.manifest.runtimeRequirements?.jobs;

  if (jobsEntry && !runtimeRequirement) {
    throw new Error(`plugin_job_runtime_requirement_missing:${input.pluginId}`);
  }

  return runtimeRequirement ?? '';
};

export const createPluginOperationExecutionHandlersFromSnapshot = (input: {
  readonly pluginSources: readonly StudioPluginJobSource[];
  readonly runtimeFactories: PluginJobRuntimeFactoryRegistry;
}): Promise<Readonly<Record<string, PluginOperationExecutionHandler>>> => {
  return (async () => {
    const handlerEntries: Array<readonly [string, PluginOperationExecutionHandler]> = [];

    for (const source of input.pluginSources) {
      const jobsEntry = source.manifest.entryPoints.jobs;
      if (!jobsEntry) {
        continue;
      }

      const runtimeRequirement = resolvePluginJobRuntimeRequirement({
        pluginId: source.pluginId,
        manifest: source.manifest,
      });
      const runtimeFactory = input.runtimeFactories[runtimeRequirement];
      if (!runtimeFactory) {
        throw new Error(`plugin_job_runtime_provider_missing:${source.pluginId}:${runtimeRequirement}`);
      }

      const jobModule = await resolvePluginJobModule({
        sourceRef: source.sourceRef,
        jobsEntry,
        sourceType: source.sourceType,
      });
      const createPluginJobExecutionHandlers = jobModule?.createPluginJobExecutionHandlers;
      if (!createPluginJobExecutionHandlers) {
        throw new Error(`missing_plugin_job_module_factory:${source.pluginId}`);
      }

      for (const [jobTypeId, handler] of Object.entries(createPluginJobExecutionHandlers(runtimeFactory()))) {
        handlerEntries.push([jobTypeId, handler] as const);
      }
    }

    return Object.fromEntries(handlerEntries);
  })();
};

export const createStudioPluginOperationExecutionHandlers = async (): Promise<
  Readonly<Record<string, PluginOperationExecutionRegistration>>
> => {
  return (async () => {
    const handlers = await createPluginOperationExecutionHandlersFromSnapshot({
      pluginSources: studioPluginJobSources,
      runtimeFactories: studioPluginJobRuntimeFactories,
    });

    return Object.fromEntries(
      Object.entries(handlers).map(([jobTypeId, handler]) => [
        jobTypeId,
        {
          handler,
          queueName: 'plugin-operations',
        },
      ])
    );
  })();
};

const collectRegisteredHandlerIds = (
  handlers: Readonly<Record<string, PluginOperationExecutionRegistration>>
): readonly string[] => Object.keys(handlers).sort();

export const assertPluginOperationExecutionHandlerCoverage = (input: {
  readonly declaredJobTypeIds: readonly string[];
  readonly handlers: Readonly<Record<string, PluginOperationExecutionRegistration>>;
}): void => {
  const declaredJobTypeIds = [...input.declaredJobTypeIds].sort();
  const registeredHandlerIds = collectRegisteredHandlerIds(input.handlers);

  const missingHandlerIds = declaredJobTypeIds.filter((jobTypeId) => !registeredHandlerIds.includes(jobTypeId));
  if (missingHandlerIds.length > 0) {
    throw new Error(`missing_plugin_operation_handlers:${missingHandlerIds.join(',')}`);
  }

  const unknownHandlerIds = registeredHandlerIds.filter((jobTypeId) => !declaredJobTypeIds.includes(jobTypeId));
  if (unknownHandlerIds.length > 0) {
    throw new Error(`unknown_plugin_operation_handlers:${unknownHandlerIds.join(',')}`);
  }
};

export const assertStudioPluginOperationHandlerCoverage = (
  handlers: Readonly<Record<string, PluginOperationExecutionRegistration>>
): void => {
  assertPluginOperationExecutionHandlerCoverage({
    declaredJobTypeIds: [...studioDeclaredPluginOperationJobTypeIds].sort(),
    handlers,
  });
};

export const registerStudioPluginOperationHandlers = async (): Promise<
  Readonly<Record<string, PluginOperationExecutionRegistration>>
> => {
  return (async () => {
    const handlers = await createStudioPluginOperationExecutionHandlers();
    assertStudioPluginOperationHandlerCoverage(handlers);
    registerPluginOperationExecutionHandlers(handlers);
    return handlers;
  })();
};
