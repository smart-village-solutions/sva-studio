import type { PluginManifest } from '@sva/plugin-sdk';

type PluginModuleExports = Record<string, unknown>;
type PluginModuleLoader = () => Promise<PluginModuleExports>;

export const trimImportGlobPrefix = (path: string): string => path.replace(/^(\.\.\/)+/, '');

export const getWorkspaceSourceRefFromGlobPath = (path: string): string | undefined => {
  const match = trimImportGlobPrefix(path).match(/^(packages\/[^/]+)\//);
  return match?.[1];
};

export const getNodeSourceRefFromGlobPath = (path: string): string | undefined => {
  const match = trimImportGlobPrefix(path).match(/^node_modules\/((?:@[^/]+\/)?[^/]+)\//);
  return match?.[1];
};

export const getRelativePackagePath = (path: string, sourceRef: string): string => {
  const normalizedPath = trimImportGlobPrefix(path);
  if (normalizedPath.startsWith(`${sourceRef}/`)) {
    return normalizedPath.slice(sourceRef.length + 1);
  }
  if (normalizedPath.startsWith(`node_modules/${sourceRef}/`)) {
    return normalizedPath.slice(`node_modules/${sourceRef}/`.length);
  }

  return normalizedPath;
};

export const createPluginBuildRegistries = (input: {
  readonly workspaceManifestModules: Readonly<Record<string, PluginManifest>>;
  readonly workspacePluginModuleLoaders: Readonly<Record<string, PluginModuleLoader>>;
  readonly nodeManifestModules: Readonly<Record<string, PluginManifest>>;
  readonly nodePluginModuleLoaders: Readonly<Record<string, PluginModuleLoader>>;
}) => {
  const workspaceManifestRegistry = new Map<string, PluginManifest>();
  for (const [path, manifest] of Object.entries(input.workspaceManifestModules)) {
    const sourceRef = getWorkspaceSourceRefFromGlobPath(path);
    if (sourceRef) {
      workspaceManifestRegistry.set(sourceRef, manifest);
    }
  }

  const workspacePluginRegistry = new Map<string, PluginModuleLoader>();
  for (const [path, moduleLoader] of Object.entries(input.workspacePluginModuleLoaders)) {
    const sourceRef = getWorkspaceSourceRefFromGlobPath(path);
    if (sourceRef) {
      workspacePluginRegistry.set(`${sourceRef}::${getRelativePackagePath(path, sourceRef)}`, moduleLoader);
    }
  }

  const nodeManifestRegistry = new Map<string, PluginManifest>();
  for (const [path, manifest] of Object.entries(input.nodeManifestModules)) {
    const sourceRef = getNodeSourceRefFromGlobPath(path);
    if (sourceRef) {
      nodeManifestRegistry.set(sourceRef, manifest);
    }
  }

  const nodePluginRegistry = new Map<string, PluginModuleLoader>();
  for (const [path, moduleLoader] of Object.entries(input.nodePluginModuleLoaders)) {
    const sourceRef = getNodeSourceRefFromGlobPath(path);
    if (sourceRef) {
      nodePluginRegistry.set(`${sourceRef}::${getRelativePackagePath(path, sourceRef)}`, moduleLoader);
    }
  }

  return {
    workspaceManifestRegistry,
    workspacePluginRegistry,
    nodeManifestRegistry,
    nodePluginRegistry,
  };
};

export const resolvePluginModuleFromRegistry = (
  registry: ReadonlyMap<string, PluginModuleLoader>,
  sourceRef: string,
  candidates: readonly string[]
): Promise<PluginModuleExports | undefined> => {
  for (const relativePath of candidates) {
    const loader = registry.get(`${sourceRef}::${relativePath}`);
    if (loader) {
      return loader();
    }
  }

  return Promise.resolve(undefined);
};
