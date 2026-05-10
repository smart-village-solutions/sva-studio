import { registerPluginOperationExecutionHandlers } from '@sva/auth-runtime/server';
import type { PluginJobTypeDefinition, PluginManifest, PluginSnapshot } from '@sva/plugin-sdk';

import { studioPluginSnapshot } from './plugins.js';
import { createWasteManagementOperationRuntime } from './waste-management-operations.server.js';

const studioDeclaredPluginOperationJobTypes = [...studioPluginSnapshot.registry.jobTypes] as const;

type PluginOperationExecutionHandler = import('@sva/auth-runtime/server').PluginOperationExecutionHandler;
type PluginJobModuleFactory = (runtime: unknown) => Readonly<Record<string, PluginOperationExecutionHandler>>;
type PluginJobModuleExports = {
  readonly createPluginJobExecutionHandlers?: PluginJobModuleFactory;
};
type PluginJobRuntimeFactory = () => unknown;
type PluginJobRuntimeFactoryRegistry = Readonly<Record<string, PluginJobRuntimeFactory>>;
type PluginSnapshotSource = PluginSnapshot['pluginSources'][number];

const workspaceJobModules = import.meta.glob('../../../../packages/*/src/server.ts', {
  eager: true,
}) as Record<string, PluginJobModuleExports>;
const nodeJobModules = {
  ...import.meta.glob('../../../../node_modules/*/dist/server.js', { eager: true }),
  ...import.meta.glob('../../../../node_modules/*/src/server.ts', { eager: true }),
  ...import.meta.glob('../../../../node_modules/@*/*/dist/server.js', { eager: true }),
  ...import.meta.glob('../../../../node_modules/@*/*/src/server.ts', { eager: true }),
} as Record<string, PluginJobModuleExports>;

const trimImportGlobPrefix = (path: string): string => path.replace(/^(\.\.\/)+/, '');

const getRelativePackagePath = (path: string, sourceRef: string): string => {
  const normalizedPath = trimImportGlobPrefix(path);
  if (normalizedPath.startsWith(`${sourceRef}/`)) {
    return normalizedPath.slice(sourceRef.length + 1);
  }
  if (normalizedPath.startsWith(`node_modules/${sourceRef}/`)) {
    return normalizedPath.slice(`node_modules/${sourceRef}/`.length);
  }

  return normalizedPath;
};

const workspaceJobModuleRegistry = new Map<string, PluginJobModuleExports>();
for (const [path, moduleExports] of Object.entries(workspaceJobModules)) {
  const normalizedPath = trimImportGlobPrefix(path);
  const match = normalizedPath.match(/^(packages\/[^/]+)\//);
  const sourceRef = match?.[1];
  if (sourceRef) {
    workspaceJobModuleRegistry.set(`${sourceRef}::${getRelativePackagePath(path, sourceRef)}`, moduleExports);
  }
}

const nodeJobModuleRegistry = new Map<string, PluginJobModuleExports>();
for (const [path, moduleExports] of Object.entries(nodeJobModules)) {
  const normalizedPath = trimImportGlobPrefix(path);
  const match = normalizedPath.match(/^node_modules\/((?:@[^/]+\/)?[^/]+)\//);
  const sourceRef = match?.[1];
  if (sourceRef) {
    nodeJobModuleRegistry.set(`${sourceRef}::${getRelativePackagePath(path, sourceRef)}`, moduleExports);
  }
}

const normalizeEntryPath = (value: string): string => value.replace(/^[.][/]/, '').trim();

const getWorkspaceJobModuleCandidates = (jobsEntry: string): readonly string[] => {
  const candidates = ['src/server.ts'];
  const normalizedJobsEntry = normalizeEntryPath(jobsEntry);
  if (normalizedJobsEntry.length > 0 && !candidates.includes(normalizedJobsEntry)) {
    candidates.push(normalizedJobsEntry);
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
}): PluginJobModuleExports | undefined => {
  const candidates =
    input.sourceType === 'workspace'
      ? getWorkspaceJobModuleCandidates(input.jobsEntry)
      : getPackageJobModuleCandidates(input.jobsEntry);
  const registry = input.sourceType === 'workspace' ? workspaceJobModuleRegistry : nodeJobModuleRegistry;

  for (const relativePath of candidates) {
    const moduleExports = registry.get(`${input.sourceRef}::${relativePath}`);
    if (moduleExports) {
      return moduleExports;
    }
  }

  return undefined;
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
  readonly pluginSources: readonly PluginSnapshotSource[];
  readonly runtimeFactories: PluginJobRuntimeFactoryRegistry;
}): Readonly<Record<string, PluginOperationExecutionHandler>> => {
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

    const jobModule = resolvePluginJobModule({
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
};

export const createStudioPluginOperationExecutionHandlers = (): Readonly<
  Record<string, PluginOperationExecutionHandler>
> =>
  createPluginOperationExecutionHandlersFromSnapshot({
    pluginSources: studioPluginSnapshot.pluginSources,
    runtimeFactories: studioPluginJobRuntimeFactories,
  });

const collectDeclaredJobTypeIds = (
  jobTypes: readonly PluginJobTypeDefinition[]
): readonly string[] => jobTypes.map((jobType) => jobType.jobTypeId).sort();

const collectRegisteredHandlerIds = (
  handlers: Readonly<Record<string, PluginOperationExecutionHandler>>
): readonly string[] => Object.keys(handlers).sort();

export const assertPluginOperationExecutionHandlerCoverage = (input: {
  readonly declaredJobTypeIds: readonly string[];
  readonly handlers: Readonly<Record<string, PluginOperationExecutionHandler>>;
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
  handlers: Readonly<Record<string, PluginOperationExecutionHandler>>
): void => {
  assertPluginOperationExecutionHandlerCoverage({
    declaredJobTypeIds: collectDeclaredJobTypeIds(studioDeclaredPluginOperationJobTypes),
    handlers,
  });
};

export const registerStudioPluginOperationHandlers = (): Readonly<
  Record<string, PluginOperationExecutionHandler>
> => {
  const handlers = createStudioPluginOperationExecutionHandlers();
  assertStudioPluginOperationHandlerCoverage(handlers);
  registerPluginOperationExecutionHandlers(handlers);
  return handlers;
};
