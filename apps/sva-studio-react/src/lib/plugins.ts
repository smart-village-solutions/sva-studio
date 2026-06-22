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

import { i18nResources, mergeI18nResources, resetMergedI18nResources, resetTranslatorCache, t } from '../i18n';
import {
  createPluginBuildRegistries,
  resolvePluginModuleFromRegistry,
} from './plugin-build-registry.js';
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

const studioPluginTranslationsSignatureKey = Symbol.for('sva-studio.plugin-translations.signature');
const warnedDeprecatedPluginActionAliases = new Set<string>();

const workspaceManifestModules = import.meta.glob('../../../../packages/plugin-*/plugin.manifest.json', {
  eager: true,
  import: 'default',
}) as Record<string, PluginManifest>;
const workspacePluginModuleLoaders = {
  ...import.meta.glob('../../../../packages/plugin-*/src/index.ts'),
  ...import.meta.glob('../../../../packages/plugin-*/src/index.tsx'),
} as Record<string, () => Promise<Record<string, unknown>>>;
const nodeManifestModules = {
  ...import.meta.glob('../../../../node_modules/*/plugin.manifest.json', { eager: true, import: 'default' }),
  ...import.meta.glob('../../../../node_modules/@*/*/plugin.manifest.json', { eager: true, import: 'default' }),
} as Record<string, PluginManifest>;
const nodePluginModuleLoaders = {
  // Restrict eager package-module imports to the documented plugin package naming
  // scheme. Modules stay lazy so disabled or uncatalogized plugins cannot
  // execute top-level code during startup.
  ...import.meta.glob('../../../../node_modules/plugin-*/dist/index.js'),
  ...import.meta.glob('../../../../node_modules/plugin-*/src/index.ts'),
  ...import.meta.glob('../../../../node_modules/plugin-*/src/index.tsx'),
  ...import.meta.glob('../../../../node_modules/@*/plugin-*/dist/index.js'),
  ...import.meta.glob('../../../../node_modules/@*/plugin-*/src/index.ts'),
  ...import.meta.glob('../../../../node_modules/@*/plugin-*/src/index.tsx'),
} as Record<string, () => Promise<Record<string, unknown>>>;

const { workspaceManifestRegistry, workspacePluginRegistry, nodeManifestRegistry, nodePluginRegistry } =
  createPluginBuildRegistries({
    workspaceManifestModules,
    workspacePluginModuleLoaders,
    nodeManifestModules,
    nodePluginModuleLoaders,
  });

const resolveWorkspaceManifest = (entry: StudioPluginCatalogConfigEntry): PluginManifest | undefined =>
  workspaceManifestRegistry.get(entry.sourceRef);

const resolveNodeManifest = (entry: StudioPluginCatalogConfigEntry): PluginManifest | undefined =>
  nodeManifestRegistry.get(entry.sourceRef);

const resolveWorkspacePluginModule = (
  entry: PluginCatalogEntry,
  manifest: PluginManifest
): Promise<Record<string, unknown> | undefined> =>
  resolvePluginModuleFromRegistry(workspacePluginRegistry, entry.sourceRef, getWorkspacePluginModuleCandidates(manifest));

const resolveNodePluginModule = (
  entry: PluginCatalogEntry,
  manifest: PluginManifest
): Promise<Record<string, unknown> | undefined> =>
  resolvePluginModuleFromRegistry(nodePluginRegistry, entry.sourceRef, getPackagePluginModuleCandidates(manifest));

const studioPluginCatalogConfigEntries = studioPluginCatalogConfig as readonly StudioPluginCatalogConfigEntry[];

const studioPluginCatalogReport = await createStudioPluginCatalogReport({
  catalogConfig: studioPluginCatalogConfigEntries,
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
const studioBuildTimeTranslationsSignature = JSON.stringify(studioBuildTimeRegistry.translations);
const studioPluginTranslationsResourcesKey = Symbol.for('sva-studio.plugin-translations.resources');
const globalPluginTranslationState = globalThis as typeof globalThis & {
  [studioPluginTranslationsSignatureKey]?: string;
  [studioPluginTranslationsResourcesKey]?: unknown;
};
const translationResourcesChanged =
  globalPluginTranslationState[studioPluginTranslationsResourcesKey] !== i18nResources;

if (
  translationResourcesChanged ||
  globalPluginTranslationState[studioPluginTranslationsSignatureKey] !== studioBuildTimeTranslationsSignature
) {
  resetMergedI18nResources();
  mergeI18nResources(studioBuildTimeRegistry.translations);
  globalPluginTranslationState[studioPluginTranslationsSignatureKey] = studioBuildTimeTranslationsSignature;
  globalPluginTranslationState[studioPluginTranslationsResourcesKey] = i18nResources;
}

export const studioPlugins = studioBuildTimeRegistry.plugins;
export const studioPluginActionRegistry = studioBuildTimeRegistry.pluginActionRegistry;
export const studioAdminResources = studioBuildTimeRegistry.adminResources;
export const studioContentTypes = studioBuildTimeRegistry.studioContentTypes;
const unifiedContentNavigationTargets = new Set(
  studioAdminResources
    .filter(
      (resource) =>
        resource.guard === 'content' &&
        resource.resourceId !== 'content' &&
        studioContentTypes.some((definition) => definition.contentType === resource.contentUi?.contentType)
    )
    .map((resource) => `/admin/${resource.basePath}`)
);
export const studioPluginNavigation = studioBuildTimeRegistry.navigation.filter(
  (item) => !unifiedContentNavigationTargets.has(item.to)
);
const studioPluginNavigationOwners = new Map(
  studioPlugins.flatMap((plugin) =>
    (plugin.navigation ?? [])
      .filter((item) => !unifiedContentNavigationTargets.has(item.to))
      .map((item) => [item.id, plugin.id] as const)
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
