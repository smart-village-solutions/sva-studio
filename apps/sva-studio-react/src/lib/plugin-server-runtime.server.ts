import {
  createPluginServerHandlerDispatcher,
  type PluginServerHandlerDispatcherDependencies,
} from '@sva/auth-runtime/server';
import type {
  PluginManifest,
  PluginCatalogSourceType,
  PluginServerExecutionHandler,
  PluginServerHandlerModuleFactory,
} from '@sva/plugin-sdk';

import {
  createPluginBuildRegistries,
  resolvePluginModuleFromRegistry,
} from './plugin-build-registry.js';
import { studioPluginSnapshot } from './plugins.js';

type PluginServerModuleExports = Readonly<{
  createPluginServerHandlers?: PluginServerHandlerModuleFactory;
}>;

type StudioPluginServerSource = Readonly<{
  pluginId: string;
  sourceType: PluginCatalogSourceType;
  sourceRef: string;
  manifest: PluginManifest;
}>;

const workspaceManifestModules = import.meta.glob(
  '../../../../packages/plugin-*/plugin.manifest.json',
  { eager: true, import: 'default' }
) as Record<string, PluginManifest>;
const workspaceServerModuleLoaders = {
  ...import.meta.glob('../../../../packages/plugin-*/src/server.ts'),
  ...import.meta.glob('../../../../packages/plugin-*/src/server/index.ts'),
} as Record<string, () => Promise<PluginServerModuleExports>>;
const nodeManifestModules = {
  ...import.meta.glob('../../../../node_modules/*/plugin.manifest.json', {
    eager: true,
    import: 'default',
  }),
  ...import.meta.glob('../../../../node_modules/@*/*/plugin.manifest.json', {
    eager: true,
    import: 'default',
  }),
} as Record<string, PluginManifest>;
const nodeServerModuleLoaders = {
  ...import.meta.glob('../../../../node_modules/plugin-*/dist/server.js'),
  ...import.meta.glob('../../../../node_modules/plugin-*/src/server.ts'),
  ...import.meta.glob('../../../../node_modules/plugin-*/src/server/index.ts'),
  ...import.meta.glob('../../../../node_modules/@*/plugin-*/dist/server.js'),
  ...import.meta.glob('../../../../node_modules/@*/plugin-*/src/server.ts'),
  ...import.meta.glob('../../../../node_modules/@*/plugin-*/src/server/index.ts'),
} as Record<string, () => Promise<PluginServerModuleExports>>;

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
  for (const fallback of sourceType === 'workspace'
    ? ['src/server.ts', 'src/server/index.ts']
    : ['dist/server.js', 'src/server.ts', 'src/server/index.ts']) {
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
    for (const [handlerId, handler] of Object.entries(factory())) {
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
    pluginSources: studioPluginSnapshot.pluginSources as readonly StudioPluginServerSource[],
  });
  return createPluginServerHandlerDispatcher({
    descriptors: studioPluginSnapshot.registry.pluginServerHandlerRegistry,
    handlers,
    dependencies: input.dependencies,
  });
};
