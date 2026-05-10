import {
  registerPluginTranslationResolver,
  type PluginCatalogEntry,
  type PluginManifest,
} from '@sva/plugin-sdk';
import { createBrowserLogger } from '@sva/monitoring-client/logging';
import {
  studioHostModuleIamContracts,
  studioModuleIamContracts,
  studioModuleIamRegistry,
} from '@sva/studio-module-iam';
import studioPluginCatalogConfig from '../../plugin-catalog.json';
import { appAdminResources } from '../routing/admin-resources';

import { mergeI18nResources, resetTranslatorCache, t } from '../i18n';
import {
  createStudioPluginCatalogReport,
  getPackagePluginModuleCandidates,
  getWorkspacePluginModuleCandidates,
  type StudioPluginCatalogConfigEntry,
} from './plugin-catalog-loader.js';

export { studioHostModuleIamContracts, studioModuleIamContracts, studioModuleIamRegistry };

const pluginLogger = createBrowserLogger({
  component: 'plugin-actions',
  level: 'warn',
});

const warnedDeprecatedPluginActionAliases = new Set<string>();

const workspaceManifestModules = import.meta.glob('../../../../packages/*/plugin.manifest.json', {
  eager: true,
  import: 'default',
}) as Record<string, PluginManifest>;
const workspacePluginModules = {
  ...import.meta.glob('../../../../packages/*/src/index.ts', { eager: true }),
  ...import.meta.glob('../../../../packages/*/src/index.tsx', { eager: true }),
} as Record<string, Record<string, unknown>>;
const nodeManifestModules = {
  ...import.meta.glob('../../../../node_modules/*/plugin.manifest.json', { eager: true, import: 'default' }),
  ...import.meta.glob('../../../../node_modules/@*/*/plugin.manifest.json', { eager: true, import: 'default' }),
} as Record<string, PluginManifest>;
const nodePluginModules = {
  ...import.meta.glob('../../../../node_modules/*/dist/index.js', { eager: true }),
  ...import.meta.glob('../../../../node_modules/*/src/index.ts', { eager: true }),
  ...import.meta.glob('../../../../node_modules/*/src/index.tsx', { eager: true }),
  ...import.meta.glob('../../../../node_modules/@*/*/dist/index.js', { eager: true }),
  ...import.meta.glob('../../../../node_modules/@*/*/src/index.ts', { eager: true }),
  ...import.meta.glob('../../../../node_modules/@*/*/src/index.tsx', { eager: true }),
} as Record<string, Record<string, unknown>>;

const trimImportGlobPrefix = (path: string): string => path.replace(/^(\.\.\/)+/, '');

const getWorkspaceSourceRefFromGlobPath = (path: string): string | undefined => {
  const match = trimImportGlobPrefix(path).match(/^(packages\/[^/]+)\//);
  return match?.[1];
};

const getNodeSourceRefFromGlobPath = (path: string): string | undefined => {
  const match = trimImportGlobPrefix(path).match(/^node_modules\/((?:@[^/]+\/)?[^/]+)\//);
  return match?.[1];
};

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

const workspaceManifestRegistry = new Map<string, PluginManifest>();
for (const [path, manifest] of Object.entries(workspaceManifestModules)) {
  const sourceRef = getWorkspaceSourceRefFromGlobPath(path);
  if (sourceRef) {
    workspaceManifestRegistry.set(sourceRef, manifest);
  }
}

const workspacePluginRegistry = new Map<string, Record<string, unknown>>();
for (const [path, moduleExports] of Object.entries(workspacePluginModules)) {
  const sourceRef = getWorkspaceSourceRefFromGlobPath(path);
  if (sourceRef) {
    workspacePluginRegistry.set(`${sourceRef}::${getRelativePackagePath(path, sourceRef)}`, moduleExports);
  }
}

const nodeManifestRegistry = new Map<string, PluginManifest>();
for (const [path, manifest] of Object.entries(nodeManifestModules)) {
  const sourceRef = getNodeSourceRefFromGlobPath(path);
  if (sourceRef) {
    nodeManifestRegistry.set(sourceRef, manifest);
  }
}

const nodePluginRegistry = new Map<string, Record<string, unknown>>();
for (const [path, moduleExports] of Object.entries(nodePluginModules)) {
  const sourceRef = getNodeSourceRefFromGlobPath(path);
  if (sourceRef) {
    nodePluginRegistry.set(`${sourceRef}::${getRelativePackagePath(path, sourceRef)}`, moduleExports);
  }
}

const resolveWorkspaceManifest = (entry: StudioPluginCatalogConfigEntry): PluginManifest | undefined =>
  workspaceManifestRegistry.get(entry.sourceRef);

const resolveNodeManifest = (entry: StudioPluginCatalogConfigEntry): PluginManifest | undefined =>
  nodeManifestRegistry.get(entry.sourceRef);

const resolveWorkspacePluginModule = (
  entry: PluginCatalogEntry,
  manifest: PluginManifest
): Record<string, unknown> | undefined => {
  for (const relativePath of getWorkspacePluginModuleCandidates(manifest)) {
    const match = workspacePluginRegistry.get(`${entry.sourceRef}::${relativePath}`);
    if (match) {
      return match;
    }
  }

  return undefined;
};

const resolveNodePluginModule = (
  entry: PluginCatalogEntry,
  manifest: PluginManifest
): Record<string, unknown> | undefined => {
  for (const relativePath of getPackagePluginModuleCandidates(manifest)) {
    const match = nodePluginRegistry.get(`${entry.sourceRef}::${relativePath}`);
    if (match) {
      return match;
    }
  }

  return undefined;
};

const studioPluginCatalogReport = createStudioPluginCatalogReport({
  catalogConfig: studioPluginCatalogConfig as readonly StudioPluginCatalogConfigEntry[],
  resolveManifest: (entry) => (entry.sourceType === 'workspace' ? resolveWorkspaceManifest(entry) : resolveNodeManifest(entry)),
  resolvePluginModule: (entry, manifest) =>
    entry.sourceType === 'workspace'
      ? resolveWorkspacePluginModule(entry, manifest)
      : resolveNodePluginModule(entry, manifest),
  adminResources: appAdminResources,
});

for (const issue of studioPluginCatalogReport.issues) {
  const logFields = {
    plugin_id: issue.pluginId,
    source_ref: issue.sourceRef,
    source_type: issue.sourceType,
    reason_code: issue.code,
    message: issue.message,
  };
  if (issue.severity === 'error') {
    pluginLogger.error('plugin_catalog_entry_rejected', logFields);
  } else {
    pluginLogger.warn('plugin_catalog_entry_skipped', logFields);
  }
}

export const studioPluginCatalog = studioPluginCatalogReport.catalog;
export const studioPluginCatalogIssues = studioPluginCatalogReport.issues;
export const studioPluginSnapshot = studioPluginCatalogReport.snapshot;

export const studioBuildTimeRegistry = studioPluginSnapshot.registry;

mergeI18nResources(studioBuildTimeRegistry.translations);

export const studioPlugins = studioBuildTimeRegistry.plugins;
export const studioPluginRegistry = studioBuildTimeRegistry.pluginRegistry;
export const studioPluginActionRegistry = studioBuildTimeRegistry.pluginActionRegistry;
export const studioPluginModuleIamRegistry = studioBuildTimeRegistry.pluginModuleIamRegistry;
export const studioPluginModuleIamContracts = studioBuildTimeRegistry.pluginModuleIamContracts;
export const studioPluginRoutes = studioBuildTimeRegistry.routes;
export const studioPluginNavigation = studioBuildTimeRegistry.navigation;
export const studioPluginContentTypes = studioBuildTimeRegistry.contentTypes;
export const studioAdminResources = studioBuildTimeRegistry.adminResources;
const studioPluginNavigationOwners = new Map(
  studioPlugins.flatMap((plugin) =>
    (plugin.navigation ?? []).map((item) => [item.id, plugin.id] as const)
  )
);

export const getStudioPluginAction = (actionId: string) => {
  const action = studioPluginActionRegistry.get(actionId);
  if (action?.deprecatedAlias && warnedDeprecatedPluginActionAliases.has(action.deprecatedAlias) === false) {
    warnedDeprecatedPluginActionAliases.add(action.deprecatedAlias);
    pluginLogger.warn('plugin_action_alias_deprecated', {
      requested_action_id: action.deprecatedAlias,
      canonical_action_id: action.actionId,
      owner_plugin_id: action.ownerPluginId,
    });
  }

  return action;
};

export const getStudioPluginNavigationModuleId = (item: { readonly id: string }): string | null =>
  studioPluginNavigationOwners.get(item.id) ?? null;

export const initializePluginTranslations = () => {
  registerPluginTranslationResolver((key, variables) => t(key, variables));
  resetTranslatorCache();
};

initializePluginTranslations();
