import { normalizePluginNamespace, parseNamespacedPluginIdentifier } from './plugin-identifiers.js';
import type { PluginDefinition } from './plugins.js';
import {
  definePluginJobTypes,
  type PluginJobTypeDefinition,
  type PluginJobTypeRegistryEntry,
} from './plugin-job-types.js';
import {
  definePluginExportProfiles,
  definePluginImportProfiles,
  type PluginExportProfileDefinition,
  type PluginExportProfileRegistryEntry,
  type PluginImportProfileDefinition,
  type PluginImportProfileRegistryEntry,
} from './plugin-profile-definitions.js';

export { definePluginJobTypes } from './plugin-job-types.js';
export type { PluginJobTypeDefinition, PluginJobTypeRegistryEntry } from './plugin-job-types.js';
export {
  definePluginExportProfiles,
  definePluginImportProfiles,
} from './plugin-profile-definitions.js';
export type {
  PluginExportProfileDefinition,
  PluginExportProfileRegistryEntry,
  PluginImportProfileDefinition,
  PluginImportProfileRegistryEntry,
  PluginImportProfileValidationMode,
} from './plugin-profile-definitions.js';

export const mergePluginJobTypes = (
  plugins: readonly PluginDefinition[]
): readonly PluginJobTypeDefinition[] => plugins.flatMap((plugin) => plugin.jobTypes ?? []);

export const mergePluginImportProfiles = (
  plugins: readonly PluginDefinition[]
): readonly PluginImportProfileDefinition[] =>
  plugins.flatMap((plugin) => plugin.importProfiles ?? []);

export const mergePluginExportProfiles = (
  plugins: readonly PluginDefinition[]
): readonly PluginExportProfileDefinition[] =>
  plugins.flatMap((plugin) => plugin.exportProfiles ?? []);

export const createPluginJobTypeRegistry = (
  plugins: readonly PluginDefinition[]
): ReadonlyMap<string, PluginJobTypeRegistryEntry> => {
  const registry = new Map<string, PluginJobTypeRegistryEntry>();

  for (const plugin of plugins) {
    const pluginNamespace = normalizePluginNamespace(plugin.id);

    for (const jobType of plugin.jobTypes ?? []) {
      const normalizedJobType = definePluginJobTypes(pluginNamespace, [jobType])[0];
      if (registry.has(normalizedJobType.jobTypeId)) {
        throw new Error(`duplicate_plugin_job_type:${normalizedJobType.jobTypeId}`);
      }

      const parsed = parseNamespacedPluginIdentifier(normalizedJobType.jobTypeId);
      if (parsed === undefined) {
        throw new Error(`invalid_plugin_job_type:${normalizedJobType.jobTypeId}`);
      }

      registry.set(normalizedJobType.jobTypeId, {
        jobTypeId: normalizedJobType.jobTypeId,
        namespace: parsed.namespace,
        jobName: parsed.name,
        ownerPluginId: pluginNamespace,
        queue: normalizedJobType.queue,
        displayName: normalizedJobType.displayName,
        descriptionKey: normalizedJobType.descriptionKey,
        progress: normalizedJobType.progress,
        result: normalizedJobType.result,
        errors: normalizedJobType.errors,
        executionLane: normalizedJobType.executionLane,
        supportsCancellation: normalizedJobType.supportsCancellation,
        startPolicy: normalizedJobType.startPolicy,
        artifactPermissionId: normalizedJobType.artifactPermissionId,
      });
    }
  }

  return registry;
};

export const createPluginImportProfileRegistry = (
  plugins: readonly PluginDefinition[]
): ReadonlyMap<string, PluginImportProfileRegistryEntry> => {
  const registry = new Map<string, PluginImportProfileRegistryEntry>();
  const jobTypeRegistry = createPluginJobTypeRegistry(plugins);

  for (const plugin of plugins) {
    const pluginNamespace = normalizePluginNamespace(plugin.id);

    for (const profile of plugin.importProfiles ?? []) {
      const normalizedProfile = definePluginImportProfiles(pluginNamespace, [profile])[0];
      if (registry.has(normalizedProfile.profileId)) {
        throw new Error(`duplicate_plugin_import_profile:${normalizedProfile.profileId}`);
      }
      if (jobTypeRegistry.has(normalizedProfile.jobTypeId) === false) {
        throw new Error(
          `unknown_plugin_import_profile_job_type:${normalizedProfile.profileId}:${normalizedProfile.jobTypeId}`
        );
      }

      const parsed = parseNamespacedPluginIdentifier(normalizedProfile.profileId);
      if (parsed === undefined) {
        throw new Error(`invalid_plugin_import_profile:${normalizedProfile.profileId}`);
      }

      registry.set(normalizedProfile.profileId, {
        profileId: normalizedProfile.profileId,
        dataProfileId: normalizedProfile.dataProfileId ?? normalizedProfile.profileId,
        namespace: parsed.namespace,
        profileName: parsed.name,
        ownerPluginId: pluginNamespace,
        jobTypeId: normalizedProfile.jobTypeId,
        displayName: normalizedProfile.displayName,
        sourceFormats: normalizedProfile.sourceFormats,
        schemaVersion: normalizedProfile.schemaVersion,
        schemaStrategy: normalizedProfile.schemaStrategy,
        mappingStrategy: normalizedProfile.mappingStrategy,
        validation: normalizedProfile.validation,
      });
    }
  }

  return registry;
};

export const createPluginExportProfileRegistry = (
  plugins: readonly PluginDefinition[]
): ReadonlyMap<string, PluginExportProfileRegistryEntry> => {
  const registry = new Map<string, PluginExportProfileRegistryEntry>();
  const jobTypeRegistry = createPluginJobTypeRegistry(plugins);

  for (const plugin of plugins) {
    const pluginNamespace = normalizePluginNamespace(plugin.id);

    for (const profile of plugin.exportProfiles ?? []) {
      const normalizedProfile = definePluginExportProfiles(pluginNamespace, [profile])[0];
      if (registry.has(normalizedProfile.profileId)) {
        throw new Error(`duplicate_plugin_export_profile:${normalizedProfile.profileId}`);
      }
      if (!jobTypeRegistry.has(normalizedProfile.jobTypeId)) {
        throw new Error(
          `unknown_plugin_export_profile_job_type:${normalizedProfile.profileId}:${normalizedProfile.jobTypeId}`
        );
      }

      const parsed = parseNamespacedPluginIdentifier(normalizedProfile.profileId);
      if (parsed === undefined) {
        throw new Error(`invalid_plugin_export_profile:${normalizedProfile.profileId}`);
      }

      registry.set(normalizedProfile.profileId, {
        profileId: normalizedProfile.profileId,
        dataProfileId: normalizedProfile.dataProfileId,
        namespace: parsed.namespace,
        profileName: parsed.name,
        ownerPluginId: pluginNamespace,
        jobTypeId: normalizedProfile.jobTypeId,
        displayName: normalizedProfile.displayName,
        targetFormats: normalizedProfile.targetFormats,
        schemaVersion: normalizedProfile.schemaVersion,
        schemaStrategy: normalizedProfile.schemaStrategy,
        mappingStrategy: normalizedProfile.mappingStrategy,
      });
    }
  }

  return registry;
};
