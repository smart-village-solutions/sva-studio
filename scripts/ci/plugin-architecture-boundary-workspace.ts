import path from 'node:path';

export const WORKSPACE_DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;
export const ALLOWED_WORKSPACE_DEPENDENCIES = new Set(['@sva/plugin-sdk', '@sva/studio-ui-react']);
export const FORBIDDEN_HOST_WORKSPACE_PACKAGES = new Set([
  '@sva/core',
  '@sva/auth-runtime',
  '@sva/server-runtime',
  '@sva/routing',
  '@sva/iam-core',
  '@sva/iam-admin',
  '@sva/iam-governance',
  '@sva/instance-registry',
  '@sva/data',
  '@sva/data-client',
  '@sva/data-repositories',
  '@sva/sva-mainserver',
  '@sva/studio-module-iam',
  '@sva/monitoring-client',
  '@sva/media',
]);
export const FORBIDDEN_PATH_SIGNALS = ['route-binding', 'plugin-catalog', 'catalog-loader', 'plugin-build-registry', 'mainserver-', 'admin-resource-'];
export const REVIEW_REQUIRED_PATH_SIGNALS = ['server.ts', 'plugin-operations.ts', '.controller.', '.loaders.', '.state.', '.submissions.'];

export type PackageJson = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

export type PluginPackage = {
  packageName: string;
  packageDir: string;
  packageJson: PackageJson;
};

export type PluginArchitectureImportKind = 'runtime' | 'type' | 'reexport';

export type WorkspaceImportEdge = {
  importSpecifier: string;
  kind: PluginArchitectureImportKind;
};

const getWorkspacePackageName = (moduleSpecifier: string): string | null => {
  if (!moduleSpecifier.startsWith('@sva/')) return null;
  const [scope, packageName] = moduleSpecifier.split('/');
  return scope && packageName ? `${scope}/${packageName}` : null;
};

export const isAllowedWorkspaceModuleSpecifier = (moduleSpecifier: string): boolean => {
  const workspacePackageName = getWorkspacePackageName(moduleSpecifier);
  return workspacePackageName ? ALLOWED_WORKSPACE_DEPENDENCIES.has(workspacePackageName) : false;
};

export const isForbiddenHostWorkspaceModuleSpecifier = (moduleSpecifier: string): boolean => {
  const workspacePackageName = getWorkspacePackageName(moduleSpecifier);
  return workspacePackageName ? FORBIDDEN_HOST_WORKSPACE_PACKAGES.has(workspacePackageName) : false;
};

export const getWorkspaceImportSubject = (moduleSpecifier: string): string => getWorkspacePackageName(moduleSpecifier) ?? moduleSpecifier;

export const matchesReviewRequiredPathSignal = (relativePath: string, signal: string): boolean => {
  const normalizedPath = relativePath.toLowerCase();
  if (signal === 'server.ts' || signal === 'plugin-operations.ts') return path.posix.basename(normalizedPath) === signal;
  return normalizedPath.includes(signal);
};
