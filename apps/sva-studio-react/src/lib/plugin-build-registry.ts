import type { PluginManifest } from '@sva/plugin-sdk';

type PluginModuleExports = Record<string, unknown>;

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
  readonly workspacePluginModules: Readonly<Record<string, PluginModuleExports>>;
  readonly nodeManifestModules: Readonly<Record<string, PluginManifest>>;
  readonly nodePluginModules: Readonly<Record<string, PluginModuleExports>>;
}) => {
  const workspaceManifestRegistry = new Map<string, PluginManifest>();
  for (const [path, manifest] of Object.entries(input.workspaceManifestModules)) {
    const sourceRef = getWorkspaceSourceRefFromGlobPath(path);
    if (sourceRef) {
      workspaceManifestRegistry.set(sourceRef, manifest);
    }
  }

  const workspacePluginRegistry = new Map<string, PluginModuleExports>();
  for (const [path, moduleExports] of Object.entries(input.workspacePluginModules)) {
    const sourceRef = getWorkspaceSourceRefFromGlobPath(path);
    if (sourceRef) {
      workspacePluginRegistry.set(`${sourceRef}::${getRelativePackagePath(path, sourceRef)}`, moduleExports);
    }
  }

  const nodeManifestRegistry = new Map<string, PluginManifest>();
  for (const [path, manifest] of Object.entries(input.nodeManifestModules)) {
    const sourceRef = getNodeSourceRefFromGlobPath(path);
    if (sourceRef) {
      nodeManifestRegistry.set(sourceRef, manifest);
    }
  }

  const nodePluginRegistry = new Map<string, PluginModuleExports>();
  for (const [path, moduleExports] of Object.entries(input.nodePluginModules)) {
    const sourceRef = getNodeSourceRefFromGlobPath(path);
    if (sourceRef) {
      nodePluginRegistry.set(`${sourceRef}::${getRelativePackagePath(path, sourceRef)}`, moduleExports);
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
  registry: ReadonlyMap<string, PluginModuleExports>,
  sourceRef: string,
  candidates: readonly string[]
): PluginModuleExports | undefined => {
  for (const relativePath of candidates) {
    const match = registry.get(`${sourceRef}::${relativePath}`);
    if (match) {
      return match;
    }
  }

  return undefined;
};
