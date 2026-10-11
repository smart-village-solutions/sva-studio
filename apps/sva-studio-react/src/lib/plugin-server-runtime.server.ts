import {
  createPluginServerHandlerDispatcher,
  type PluginServerHandlerDispatcherDependencies,
} from '@sva/auth-runtime/server';
import { pluginServerHost } from '@sva/auth-runtime/plugin-server-host';
import type {
  PluginManifest,
  PluginCatalogSourceType,
  PluginServerExecutionHandler,
  PluginServerHandlerModuleFactory,
} from '@sva/plugin-sdk';
import type {
  WasteJobHost,
  WasteServerContextHost,
  WasteServerLoaderHost,
} from '@sva/waste-management-runtime/server';
import { authRoutePaths } from '@sva/routing/auth';

import {
  createPluginBuildRegistries,
  resolvePluginModuleFromRegistry,
} from './plugin-build-registry.js';
import { studioServerPluginSnapshot } from './plugin-catalog.server.js';
import { createStudioSsfRuntimeServiceAccess } from '#studio-ssf-runtime-service-access';
import {
  nodeManifestModules,
  nodeServerModuleLoaders,
  workspaceManifestModules,
  workspaceServerModuleLoaders,
} from '#studio-plugin-server-inputs';

type PluginServerModuleExports = Readonly<{
  createPluginServerHandlers?: PluginServerHandlerModuleFactory;
}>;

type StudioPluginServerSource = Readonly<{
  pluginId: string;
  sourceType: PluginCatalogSourceType;
  sourceRef: string;
  manifest: PluginManifest;
}>;

const { workspacePluginRegistry: workspaceServerRegistry, nodePluginRegistry: nodeServerRegistry } =
  createPluginBuildRegistries({
    workspaceManifestModules,
    workspacePluginModuleLoaders: workspaceServerModuleLoaders,
    nodeManifestModules,
    nodePluginModuleLoaders: nodeServerModuleLoaders,
  });

const normalizeEntryPath = (value: string): string => value.replace(/^[.][/]/, '').trim();

const getServerModuleCandidates = (
  serverEntry: string,
  sourceType: StudioPluginServerSource['sourceType']
): readonly string[] => {
  const normalizedEntry = normalizeEntryPath(serverEntry);
  const candidates = normalizedEntry ? [normalizedEntry] : [];
  if (
    sourceType === 'workspace' &&
    normalizedEntry.startsWith('dist/') &&
    normalizedEntry.endsWith('.js')
  ) {
    candidates.push(`src/${normalizedEntry.slice('dist/'.length, -'.js'.length)}.ts`);
  }
  if (sourceType === 'workspace' && normalizedEntry.endsWith('.js')) {
    candidates.push(normalizedEntry.slice(0, -'.js'.length) + '.ts');
  }
  for (const fallback of sourceType === 'workspace' ? ['src/server.ts', 'src/server/index.ts'] : []) {
    if (!candidates.includes(fallback)) candidates.push(fallback);
  }
  return candidates;
};

const resolveServerModule = (source: StudioPluginServerSource) =>
  resolvePluginModuleFromRegistry(
    source.sourceType === 'workspace' ? workspaceServerRegistry : nodeServerRegistry,
    source.sourceRef,
    getServerModuleCandidates(source.manifest.entryPoints.server ?? '', source.sourceType)
  ) as Promise<PluginServerModuleExports | undefined>;

type WastePluginServerCapabilities = Omit<
  WasteServerContextHost,
  'startPluginOperationJobFromFacade'
> & WasteServerLoaderHost & WasteJobHost;

const createWastePluginServerCapabilities = (): WastePluginServerCapabilities => ({
  emitAuthAuditEvent: pluginServerHost.emitAuthAuditEvent,
  listExternalInterfaceRecords: pluginServerHost.listExternalInterfaceRecords,
  loadDefaultExternalInterfaceRecord: pluginServerHost.loadDefaultExternalInterfaceRecord,
  saveExternalInterfaceRecord: pluginServerHost.saveExternalInterfaceRecord,
  saveExternalInterfaceConnectionCheck: pluginServerHost.saveExternalInterfaceConnectionCheck,
  withInstanceDb: pluginServerHost.withInstanceDb,
  revealField: pluginServerHost.revealField,
  completeIdempotency: pluginServerHost.completeIdempotency,
  hasIdempotentAuditEvent: pluginServerHost.hasIdempotentAuditEvent,
  releaseIdempotencyReservation: pluginServerHost.releaseIdempotencyReservation,
  renewIdempotencyLease: pluginServerHost.renewIdempotencyLease,
  reserveIdempotency: pluginServerHost.reserveIdempotency,
  resolveIamActorInfo: pluginServerHost.resolveActorInfo,
  authorizePluginAction: pluginServerHost.authorizePluginAction,
  buildLogContext: pluginServerHost.buildLogContext,
  readPluginOperationInput: pluginServerHost.readPluginOperationInput,
  storePluginOperationInput: pluginServerHost.storePluginOperationInput,
  withStudioJobRepository: pluginServerHost.withStudioJobRepository,
  readConfiguredPluginTenantAccess: pluginServerHost.readConfiguredPluginTenantAccess,
  translatePluginTenantLifecycleMessage: pluginServerHost.translatePluginTenantLifecycleMessage,
  createApiError: pluginServerHost.createApiError,
  validateCsrf: pluginServerHost.validateCsrf,
  createPluginOperationJob: pluginServerHost.createPluginOperationJob,
  markPluginOperationEnqueueFailed: pluginServerHost.markPluginOperationEnqueueFailed,
  queuePluginOperationJob: pluginServerHost.queuePluginOperationJob,
  createJsonItemResponse: pluginServerHost.createJsonItemResponse,
  toPayloadHash: pluginServerHost.toPayloadHash,
});

export const createPluginServerExecutionHandlersFromSnapshot = async (input: {
  readonly pluginSources: readonly StudioPluginServerSource[];
  readonly loadServerModule?: (
    source: StudioPluginServerSource
  ) => Promise<PluginServerModuleExports | undefined>;
}): Promise<Readonly<Record<string, PluginServerExecutionHandler>>> => {
  const handlers: Record<string, PluginServerExecutionHandler> = {};
  const loadServerModule = input.loadServerModule ?? resolveServerModule;
  for (const source of input.pluginSources) {
    if (!source.manifest.entryPoints.server) continue;
    const factory = (await loadServerModule(source))?.createPluginServerHandlers;
    if (!factory) throw new Error(`missing_plugin_server_module_factory:${source.pluginId}`);
    const bindings = source.pluginId === 'waste-management'
      ? (factory as (capabilities: WastePluginServerCapabilities) => Readonly<Record<string, PluginServerExecutionHandler>>)(createWastePluginServerCapabilities())
      : (factory as () => Readonly<Record<string, PluginServerExecutionHandler>>)();
    for (const [handlerId, handler] of Object.entries(bindings)) {
      if (typeof handler !== 'function') {
        throw new Error(`invalid_plugin_server_handler_binding:${source.pluginId}:${handlerId}`);
      }
      if (handlers[handlerId]) {
        throw new Error(`duplicate_plugin_server_handler_binding:${handlerId}`);
      }
      handlers[handlerId] = handler;
    }
  }
  return handlers;
};

export const createStudioPluginServerHandlerDispatcher = async (
  input: {
    readonly dependencies?: PluginServerHandlerDispatcherDependencies;
  } = {}
): Promise<(request: Request) => Promise<Response | null>> => {
  const handlers = await createPluginServerExecutionHandlersFromSnapshot({
    pluginSources: studioServerPluginSnapshot.pluginSources as readonly StudioPluginServerSource[],
  });
  const dispatchPlugin = createPluginServerHandlerDispatcher({
    descriptors: studioServerPluginSnapshot.registry.pluginServerHandlerRegistry,
    handlers,
    reservedPaths: authRoutePaths,
    dependencies: {
      ...createStudioSsfRuntimeServiceAccess(),
      ...input.dependencies,
    },
  });
  return dispatchPlugin;
};
