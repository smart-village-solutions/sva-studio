import {
  dsrExportStudioJobRegistration,
  mediaContentSaveRecoveryStudioJobRegistration,
  registerPluginOperationExecutionHandlers,
  registerStudioJobExecutionHandlers,
  type PluginOperationExecutionRegistration,
  readPluginOperationInput,
  storePluginOperationArtifact,
} from '@sva/auth-runtime/server';
import {
  loadDefaultExternalInterfaceRecord,
  loadExternalInterfaceRecordByAlias,
  listExternalInterfaceRecords,
  saveExternalInterfaceRecord,
} from '@sva/data-repositories/server';
import { type PluginCatalogEntry, type PluginManifest } from '@sva/plugin-sdk';
import {
  createOrUpdateSvaMainserverStaticContent,
  createSvaMainserverWastePickupTimes,
  deleteSvaMainserverWastePickupTimes,
  listSvaMainserverWasteSyncSnapshot,
} from '@sva/sva-mainserver/server';
import { createPluginBuildRegistries } from './plugin-build-registry.js';
import { studioServerPluginCatalogReport } from './plugin-catalog.server.js';
import {
  nodeJobModuleLoaders,
  nodeManifestModules,
  workspaceJobModuleLoaders,
  workspaceManifestModules,
} from '#studio-plugin-operation-inputs';
import { createNodemailerMailDispatcher } from '@sva/mail-runtime';
import { protectField, revealField } from '@sva/auth-runtime/server';
import { pluginServerHost } from '@sva/auth-runtime/plugin-server-host';
import { createWasteManagementOperationRuntime } from '@sva/waste-management-runtime/server';
import { createMapPostalCodeResolver } from './map-geocoding-api.operations.js';
type PluginOperationExecutionHandler =
  import('@sva/auth-runtime/server').PluginOperationExecutionHandler;
type PluginJobModuleFactory = (
  runtime: unknown
) => Readonly<Record<string, PluginOperationExecutionHandler>>;
type PluginJobModuleExports = {
  readonly createPluginJobExecutionHandlers?: PluginJobModuleFactory;
};
type PluginJobRuntimeFactory = () => unknown;
type PluginJobRuntimeFactoryRegistry = Readonly<Record<string, PluginJobRuntimeFactory>>;
type StudioPluginJobSource = {
  readonly pluginId: string;
  readonly sourceType: PluginCatalogEntry['sourceType'];
  readonly sourceRef: string;
  readonly manifest: PluginManifest;
};

const compareAlphabetically = (left: string, right: string): number =>
  left.localeCompare(right, 'de');

const privilegedRuntimeOwners = new Map([['waste-management.operations', 'waste-management']]);

const {
  workspacePluginRegistry: workspaceJobModuleRegistry,
  nodePluginRegistry: nodeJobModuleRegistry,
} = createPluginBuildRegistries({
  workspaceManifestModules,
  workspacePluginModuleLoaders: workspaceJobModuleLoaders,
  nodeManifestModules,
  nodePluginModuleLoaders: nodeJobModuleLoaders,
});
const studioPluginCatalogReport = studioServerPluginCatalogReport;
const studioDeclaredPluginOperationJobTypeIds =
  studioPluginCatalogReport.snapshot.registry.jobTypes.map((jobType) => jobType.jobTypeId);
const studioPluginJobSources = studioPluginCatalogReport.snapshot.pluginSources.filter(
  (entry): entry is StudioPluginJobSource =>
    Boolean(entry.manifest.entryPoints.jobs)
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
  const normalizedJobsEntry = normalizeEntryPath(jobsEntry);
  return normalizedJobsEntry ? [normalizedJobsEntry] : [];
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
  const registry =
    input.sourceType === 'workspace' ? workspaceJobModuleRegistry : nodeJobModuleRegistry;

  for (const relativePath of candidates) {
    const moduleLoader = registry.get(`${input.sourceRef}::${relativePath}`);
    if (moduleLoader) {
      return moduleLoader();
    }
  }

  return Promise.resolve(undefined);
};

const studioPluginJobRuntimeFactories: PluginJobRuntimeFactoryRegistry = {
  'waste-management.operations': () =>
    createWasteManagementOperationRuntime({
      dispatchMail: createNodemailerMailDispatcher({}),
      revealSecret: (ciphertext, aad) => revealField(ciphertext, aad) ?? undefined,
      protectSecret: protectField,
      createPostalCodeResolver: createMapPostalCodeResolver,
      withInstanceDb: pluginServerHost.withInstanceDb,
      loadDefaultInterfaceRecord: loadDefaultExternalInterfaceRecord,
      listInterfaceRecords: listExternalInterfaceRecords,
      saveInterfaceRecord: saveExternalInterfaceRecord,
      loadManagedInterface: loadExternalInterfaceRecordByAlias,
      readPluginOperationInput,
      storeJobArtifact: storePluginOperationArtifact,
      getProvisionerDatabaseUrl: () => process.env.WASTE_DATABASE_PROVISIONER_URL,
      listMainserverWasteSyncSnapshot: listSvaMainserverWasteSyncSnapshot,
      createMainserverWastePickupTimes: createSvaMainserverWastePickupTimes,
      deleteMainserverWastePickupTimes: deleteSvaMainserverWastePickupTimes,
      writeWasteStaticContent: createOrUpdateSvaMainserverStaticContent,
    }),
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
    const handlerOwners = new Map<string, string>();

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
        throw new Error(
          `plugin_job_runtime_provider_missing:${source.pluginId}:${runtimeRequirement}`
        );
      }

      const createPluginJobExecutionHandlers = (
        await resolvePluginJobModule({
          sourceRef: source.sourceRef,
          jobsEntry,
          sourceType: source.sourceType,
        })
      )?.createPluginJobExecutionHandlers;
      if (!createPluginJobExecutionHandlers) {
        throw new Error(`missing_plugin_job_module_factory:${source.pluginId}`);
      }

      for (const [jobTypeId, handler] of Object.entries(
        createPluginJobExecutionHandlers(runtimeFactory())
      )) {
        const existingOwner = handlerOwners.get(jobTypeId);
        if (existingOwner) {
          throw new Error(
            `duplicate_plugin_operation_handler:${jobTypeId}:${source.pluginId}:${existingOwner}`
          );
        }
        handlerOwners.set(jobTypeId, source.pluginId);
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

    return Object.fromEntries(Object.entries(handlers).map(([jobTypeId, handler]) => {
      const jobType = studioPluginCatalogReport.snapshot.registry.pluginJobTypeRegistry.get(jobTypeId);
      if (!jobType) throw new Error(`plugin_operation_job_type_missing:${jobTypeId}`);
      const source = studioPluginJobSources.find((entry) => entry.pluginId === jobType.ownerPluginId);
      const runtimeRequirement = source?.manifest.runtimeRequirements?.jobs;
      const executionLane = jobType.executionLane ?? 'default';
      if (
        executionLane === 'privileged' &&
        privilegedRuntimeOwners.get(runtimeRequirement ?? '') !== jobType.ownerPluginId
      ) {
        throw new Error(`plugin_job_privileged_execution_not_allowed:${jobType.ownerPluginId}`);
      }
      return [jobTypeId, {
        handler,
        queueName: jobType.queue,
        executionLane,
        supportsCancellation: jobType.supportsCancellation === true,
        startPolicy: jobType.startPolicy ?? 'standard',
        artifactPermissionId: jobType.artifactPermissionId,
      }];
    }));
  })();
};

const collectRegisteredHandlerIds = (
  handlers: Readonly<Record<string, PluginOperationExecutionRegistration>>
): readonly string[] => Object.keys(handlers).sort(compareAlphabetically);

export const assertPluginOperationExecutionHandlerCoverage = (input: {
  readonly declaredJobTypeIds: readonly string[];
  readonly handlers: Readonly<Record<string, PluginOperationExecutionRegistration>>;
}): void => {
  const declaredJobTypeIds = [...input.declaredJobTypeIds].sort(compareAlphabetically);
  const registeredHandlerIds = collectRegisteredHandlerIds(input.handlers);

  const missingHandlerIds = declaredJobTypeIds.filter(
    (jobTypeId) => !registeredHandlerIds.includes(jobTypeId)
  );
  if (missingHandlerIds.length > 0) {
    throw new Error(`missing_plugin_operation_handlers:${missingHandlerIds.join(',')}`);
  }

  const unknownHandlerIds = registeredHandlerIds.filter(
    (jobTypeId) => !declaredJobTypeIds.includes(jobTypeId)
  );
  if (unknownHandlerIds.length > 0) {
    throw new Error(`unknown_plugin_operation_handlers:${unknownHandlerIds.join(',')}`);
  }
};

export const assertStudioPluginOperationHandlerCoverage = (
  handlers: Readonly<Record<string, PluginOperationExecutionRegistration>>
): void => {
  assertPluginOperationExecutionHandlerCoverage({
    declaredJobTypeIds: [...studioDeclaredPluginOperationJobTypeIds].sort(compareAlphabetically),
    handlers,
  });
};

export const registerStudioPluginOperationHandlers = async (): Promise<
  Readonly<Record<string, PluginOperationExecutionRegistration>>
> => {
  return (async () => {
    const handlers = await createStudioPluginOperationExecutionHandlers();
    assertStudioPluginOperationHandlerCoverage(handlers);
    registerStudioJobExecutionHandlers([
      dsrExportStudioJobRegistration,
      mediaContentSaveRecoveryStudioJobRegistration,
    ]);
    registerPluginOperationExecutionHandlers(handlers);
    return handlers;
  })();
};
