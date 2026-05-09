import { assertPluginContributionAllowedKeys } from './guardrails.js';
import {
  isReservedPluginNamespace,
  normalizePluginIdentifier,
  normalizePluginNamespace,
  parseNamespacedPluginIdentifier,
} from './plugin-identifiers.js';
import type { PluginDefinition } from './plugins.js';

export type PluginJobTypeDefinition = {
  readonly jobTypeId: string;
  readonly queue: string;
  readonly displayName: string;
  readonly descriptionKey?: string;
  readonly progress?: {
    readonly phaseKeys?: readonly string[];
    readonly stepKeys?: readonly string[];
  };
};

export type PluginImportProfileValidationMode = 'preflight-only' | 'preflight-and-commit';

export type PluginImportProfileDefinition = {
  readonly profileId: string;
  readonly jobTypeId: string;
  readonly displayName: string;
  readonly sourceFormats: readonly string[];
  readonly schemaVersion: string;
  readonly schemaStrategy: string;
  readonly mappingStrategy: string;
  readonly validation: {
    readonly mode: PluginImportProfileValidationMode;
  };
};

export type PluginJobTypeRegistryEntry = {
  readonly jobTypeId: string;
  readonly namespace: string;
  readonly jobName: string;
  readonly ownerPluginId: string;
  readonly queue: string;
  readonly displayName: string;
  readonly descriptionKey?: string;
  readonly progress?: {
    readonly phaseKeys?: readonly string[];
    readonly stepKeys?: readonly string[];
  };
};

export type PluginImportProfileRegistryEntry = {
  readonly profileId: string;
  readonly namespace: string;
  readonly profileName: string;
  readonly ownerPluginId: string;
  readonly jobTypeId: string;
  readonly displayName: string;
  readonly sourceFormats: readonly string[];
  readonly schemaVersion: string;
  readonly schemaStrategy: string;
  readonly mappingStrategy: string;
  readonly validation: {
    readonly mode: PluginImportProfileValidationMode;
  };
};

const jobTypeDefinitionAllowedKeys = new Set([
  'jobTypeId',
  'queue',
  'displayName',
  'descriptionKey',
  'progress',
] as const);

const importProfileDefinitionAllowedKeys = new Set([
  'profileId',
  'jobTypeId',
  'displayName',
  'sourceFormats',
  'schemaVersion',
  'schemaStrategy',
  'mappingStrategy',
  'validation',
] as const);

const importProfileValidationAllowedKeys = new Set(['mode'] as const);
const jobTypeProgressAllowedKeys = new Set(['phaseKeys', 'stepKeys'] as const);

const normalizeProgressKeys = (keys: readonly string[] | undefined): readonly string[] | undefined => {
  if (!keys) {
    return undefined;
  }

  const normalizedKeys = keys.map((key) => normalizePluginIdentifier(key));
  if (normalizedKeys.some((key) => key.length === 0)) {
    return undefined;
  }

  return normalizedKeys.length > 0 ? normalizedKeys : undefined;
};

const normalizeJobTypeDefinition = (definition: PluginJobTypeDefinition): PluginJobTypeDefinition => ({
  ...definition,
  jobTypeId: normalizePluginIdentifier(definition.jobTypeId),
  queue: normalizePluginIdentifier(definition.queue),
  displayName: definition.displayName.trim(),
  descriptionKey: normalizePluginIdentifier(definition.descriptionKey ?? '') || undefined,
  progress: definition.progress
    ? {
        phaseKeys: normalizeProgressKeys(definition.progress.phaseKeys),
        stepKeys: normalizeProgressKeys(definition.progress.stepKeys),
      }
    : undefined,
});

const normalizeImportProfileDefinition = (
  definition: PluginImportProfileDefinition
): PluginImportProfileDefinition => ({
  ...definition,
  profileId: normalizePluginIdentifier(definition.profileId),
  jobTypeId: normalizePluginIdentifier(definition.jobTypeId),
  displayName: definition.displayName.trim(),
  sourceFormats: definition.sourceFormats.map((format) => format.trim()).filter((format) => format.length > 0),
  schemaVersion: definition.schemaVersion.trim(),
  schemaStrategy: normalizePluginIdentifier(definition.schemaStrategy),
  mappingStrategy: normalizePluginIdentifier(definition.mappingStrategy),
});

export const definePluginJobTypes = <const TJobTypes extends readonly PluginJobTypeDefinition[]>(
  namespace: string,
  jobTypes: TJobTypes
): TJobTypes => {
  const normalizedNamespace = normalizePluginNamespace(namespace);
  if (isReservedPluginNamespace(normalizedNamespace)) {
    throw new Error(`reserved_plugin_namespace:${normalizedNamespace}`);
  }

  const normalizedJobTypes = jobTypes.map((jobType) => {
    assertPluginContributionAllowedKeys(
      jobType as Record<string, unknown>,
      jobTypeDefinitionAllowedKeys,
      normalizedNamespace,
      normalizePluginIdentifier(jobType.jobTypeId)
    );
    if (jobType.progress) {
      assertPluginContributionAllowedKeys(
        jobType.progress as Record<string, unknown>,
        jobTypeProgressAllowedKeys,
        normalizedNamespace,
        normalizePluginIdentifier(jobType.jobTypeId)
      );
    }

    const normalizedJobType = normalizeJobTypeDefinition(jobType);
    const parsed = parseNamespacedPluginIdentifier(normalizedJobType.jobTypeId);
    if (parsed === undefined) {
      throw new Error(`invalid_plugin_job_type:${normalizedJobType.jobTypeId}`);
    }
    if (parsed.namespace !== normalizedNamespace) {
      throw new Error(
        `plugin_job_type_namespace_mismatch:${normalizedNamespace}:${parsed.namespace}:${normalizedJobType.jobTypeId}`
      );
    }
    if (
      normalizedJobType.queue.length === 0 ||
      normalizedJobType.displayName.length === 0 ||
      (jobType.progress?.phaseKeys && normalizedJobType.progress?.phaseKeys === undefined) ||
      (jobType.progress?.stepKeys && normalizedJobType.progress?.stepKeys === undefined)
    ) {
      throw new Error(`invalid_plugin_job_type:${normalizedJobType.jobTypeId}`);
    }

    return normalizedJobType;
  });

  return normalizedJobTypes as unknown as TJobTypes;
};

export const definePluginImportProfiles = <
  const TImportProfiles extends readonly PluginImportProfileDefinition[],
>(
  namespace: string,
  importProfiles: TImportProfiles
): TImportProfiles => {
  const normalizedNamespace = normalizePluginNamespace(namespace);
  if (isReservedPluginNamespace(normalizedNamespace)) {
    throw new Error(`reserved_plugin_namespace:${normalizedNamespace}`);
  }

  const normalizedImportProfiles = importProfiles.map((profile) => {
    assertPluginContributionAllowedKeys(
      profile as Record<string, unknown>,
      importProfileDefinitionAllowedKeys,
      normalizedNamespace,
      normalizePluginIdentifier(profile.profileId)
    );
    assertPluginContributionAllowedKeys(
      profile.validation as Record<string, unknown>,
      importProfileValidationAllowedKeys,
      normalizedNamespace,
      normalizePluginIdentifier(profile.profileId)
    );

    const normalizedProfile = normalizeImportProfileDefinition(profile);
    const profileId = normalizedProfile.profileId;
    const parsedProfile = parseNamespacedPluginIdentifier(profileId);
    if (parsedProfile === undefined) {
      throw new Error(`invalid_plugin_import_profile:${profileId}`);
    }
    if (parsedProfile.namespace !== normalizedNamespace) {
      throw new Error(
        `plugin_import_profile_namespace_mismatch:${normalizedNamespace}:${parsedProfile.namespace}:${profileId}`
      );
    }

    const parsedJobType = parseNamespacedPluginIdentifier(normalizedProfile.jobTypeId);
    if (parsedJobType === undefined) {
      throw new Error(`invalid_plugin_import_profile_job_type:${normalizedProfile.jobTypeId}`);
    }
    if (parsedJobType.namespace !== normalizedNamespace) {
      throw new Error(
        `plugin_import_profile_job_type_namespace_mismatch:${normalizedNamespace}:${parsedJobType.namespace}:${normalizedProfile.jobTypeId}`
      );
    }

    if (
      normalizedProfile.displayName.length === 0 ||
      normalizedProfile.sourceFormats.length === 0 ||
      normalizedProfile.schemaVersion.length === 0 ||
      normalizedProfile.schemaStrategy.length === 0 ||
      normalizedProfile.mappingStrategy.length === 0
    ) {
      throw new Error(`invalid_plugin_import_profile:${profileId}`);
    }

    return normalizedProfile;
  });

  return normalizedImportProfiles as unknown as TImportProfiles;
};

export const mergePluginJobTypes = (
  plugins: readonly PluginDefinition[]
): readonly PluginJobTypeDefinition[] => plugins.flatMap((plugin) => plugin.jobTypes ?? []);

export const mergePluginImportProfiles = (
  plugins: readonly PluginDefinition[]
): readonly PluginImportProfileDefinition[] => plugins.flatMap((plugin) => plugin.importProfiles ?? []);

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
