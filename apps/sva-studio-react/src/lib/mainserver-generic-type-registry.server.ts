import {
  createMainserverGenericTypeRegistry,
  type MainserverGenericItemOwnershipDefinition,
} from '@sva/plugin-sdk';
import {
  isSvaMainserverGenericItemProjectionContentType,
  type SvaMainserverGenericItemProjectionContentType,
  type SvaMainserverGenericTypeOwnership,
} from '@sva/sva-mainserver';
import studioPluginCatalogConfig from '../../plugin-catalog.json';

import {
  getNodeSourceRefFromGlobPath,
  getWorkspaceSourceRefFromGlobPath,
} from './plugin-build-registry.js';
import type { StudioPluginCatalogConfigEntry } from './plugin-catalog-loader.js';

type OwnershipModule = Readonly<Record<string, unknown>>;

const isOwnershipDefinition = (value: unknown): value is MainserverGenericItemOwnershipDefinition =>
  Boolean(value) &&
  typeof value === 'object' &&
  typeof (value as { contentType?: unknown }).contentType === 'string' &&
  typeof (value as { mainserverGenericType?: unknown }).mainserverGenericType === 'string';

const collectOwnershipModules = (
  modules: Readonly<Record<string, OwnershipModule>>,
  resolveSourceRef: (path: string) => string | undefined
): ReadonlyMap<string, MainserverGenericItemOwnershipDefinition> => {
  const result = new Map<string, MainserverGenericItemOwnershipDefinition>();
  for (const [path, moduleExports] of Object.entries(modules)) {
    const sourceRef = resolveSourceRef(path);
    const definition = Object.values(moduleExports).find(isOwnershipDefinition);
    if (sourceRef && definition) result.set(sourceRef, definition);
  }
  return result;
};

export const createStudioMainserverGenericTypeRegistry = (input: {
  catalogConfig: readonly StudioPluginCatalogConfigEntry[];
  workspaceModules: Readonly<Record<string, OwnershipModule>>;
  nodeModules: Readonly<Record<string, OwnershipModule>>;
}): ReadonlyMap<string, SvaMainserverGenericItemProjectionContentType> => {
  const workspaceDefinitions = collectOwnershipModules(
    input.workspaceModules,
    getWorkspaceSourceRefFromGlobPath
  );
  const nodeDefinitions = collectOwnershipModules(input.nodeModules, getNodeSourceRefFromGlobPath);
  const enabledDefinitions = input.catalogConfig.flatMap((entry) => {
    if (!entry.enabled) return [];
    const definition =
      entry.sourceType === 'workspace'
        ? workspaceDefinitions.get(entry.sourceRef)
        : nodeDefinitions.get(entry.sourceRef);
    if (!definition) return [];
    if (definition.contentType.split('.')[0] !== entry.pluginId) {
      throw new Error(
        `mainserver_generic_item_plugin_mismatch:${entry.pluginId}:${definition.contentType}`
      );
    }
    return [definition];
  });
  const genericTypeRegistry = createMainserverGenericTypeRegistry(enabledDefinitions);
  const validatedRegistry = new Map<string, SvaMainserverGenericItemProjectionContentType>();

  for (const [genericType, contentType] of genericTypeRegistry) {
    if (!isSvaMainserverGenericItemProjectionContentType(contentType)) {
      throw new Error(`unsupported_mainserver_generic_item_content_type:${contentType}`);
    }
    validatedRegistry.set(genericType, contentType);
  }
  return validatedRegistry;
};

const workspaceOwnershipModules = {
  ...import.meta.glob('../../../../packages/plugin-*/src/generic-item-ownership.ts', {
    eager: true,
  }),
} as Record<string, OwnershipModule>;
const nodeOwnershipModules = {
  ...import.meta.glob('../../../../node_modules/plugin-*/dist/generic-item-ownership.js', {
    eager: true,
  }),
  ...import.meta.glob('../../../../node_modules/@*/plugin-*/dist/generic-item-ownership.js', {
    eager: true,
  }),
} as Record<string, OwnershipModule>;

export const studioMainserverGenericTypeRegistry = createStudioMainserverGenericTypeRegistry({
  catalogConfig: studioPluginCatalogConfig as readonly StudioPluginCatalogConfigEntry[],
  workspaceModules: workspaceOwnershipModules,
  nodeModules: nodeOwnershipModules,
});

export const studioMainserverGenericTypeOwnership: SvaMainserverGenericTypeOwnership =
  Object.fromEntries(studioMainserverGenericTypeRegistry);
