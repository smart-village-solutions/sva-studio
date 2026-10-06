import type { PluginCatalogEntry, PluginManifest } from '@sva/plugin-sdk';
import { appAdminResources } from '../routing/admin-resources.js';
import {
  createPluginBuildRegistries,
  resolvePluginModuleFromRegistry,
} from './plugin-build-registry.js';
import {
  createStudioPluginCatalogReport,
  getPackagePluginDescriptorCandidates,
  getWorkspacePluginDescriptorCandidates,
  type StudioPluginCatalogConfigEntry,
} from './plugin-catalog-loader.js';
import { pluginCatalogConfig } from '#studio-plugin-catalog-inputs';
import {
  nodeDescriptorModuleLoaders,
  nodeManifestModules,
  workspaceDescriptorModuleLoaders,
  workspaceManifestModules,
} from '#studio-plugin-server-inputs';

const {
  workspaceManifestRegistry,
  nodeManifestRegistry,
  workspacePluginRegistry: workspaceDescriptorRegistry,
  nodePluginRegistry: nodeDescriptorRegistry,
} = createPluginBuildRegistries({
  workspaceManifestModules,
  workspacePluginModuleLoaders: workspaceDescriptorModuleLoaders,
  nodeManifestModules,
  nodePluginModuleLoaders: nodeDescriptorModuleLoaders,
});

export const studioServerPluginCatalogReport = await createStudioPluginCatalogReport({
  catalogConfig: pluginCatalogConfig as readonly StudioPluginCatalogConfigEntry[],
  resolveManifest: (entry) =>
    entry.sourceType === 'workspace'
      ? workspaceManifestRegistry.get(entry.sourceRef)
      : nodeManifestRegistry.get(entry.sourceRef),
  resolvePluginModule: (entry: PluginCatalogEntry, manifest: PluginManifest) =>
    resolvePluginModuleFromRegistry(
      entry.sourceType === 'workspace' ? workspaceDescriptorRegistry : nodeDescriptorRegistry,
      entry.sourceRef,
      entry.sourceType === 'workspace'
        ? getWorkspacePluginDescriptorCandidates(manifest)
        : getPackagePluginDescriptorCandidates(manifest)
    ),
  adminResources: appAdminResources,
});

export const studioServerPluginSnapshot = studioServerPluginCatalogReport.snapshot;
