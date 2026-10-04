import { assertPluginContributionAllowedKeys } from './guardrails.js';
import {
  isReservedPluginNamespace,
  normalizePluginIdentifier,
  normalizePluginNamespace,
  parseNamespacedPluginIdentifier,
} from './plugin-identifiers.js';

export type PluginImportProfileValidationMode = 'preflight-only' | 'preflight-and-commit';

export type PluginImportProfileDefinition = {
  readonly profileId: string;
  readonly dataProfileId?: string;
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

export type PluginExportProfileDefinition = {
  readonly profileId: string;
  readonly dataProfileId: string;
  readonly jobTypeId: string;
  readonly displayName: string;
  readonly targetFormats: readonly string[];
  readonly schemaVersion: string;
  readonly schemaStrategy: string;
  readonly mappingStrategy: string;
};

export type PluginImportProfileRegistryEntry = {
  readonly profileId: string;
  readonly dataProfileId: string;
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

export type PluginExportProfileRegistryEntry = {
  readonly profileId: string;
  readonly dataProfileId: string;
  readonly namespace: string;
  readonly profileName: string;
  readonly ownerPluginId: string;
  readonly jobTypeId: string;
  readonly displayName: string;
  readonly targetFormats: readonly string[];
  readonly schemaVersion: string;
  readonly schemaStrategy: string;
  readonly mappingStrategy: string;
};

const importProfileDefinitionAllowedKeys = new Set([
  'profileId',
  'dataProfileId',
  'jobTypeId',
  'displayName',
  'sourceFormats',
  'schemaVersion',
  'schemaStrategy',
  'mappingStrategy',
  'validation',
] as const);

const exportProfileDefinitionAllowedKeys = new Set([
  'profileId',
  'dataProfileId',
  'jobTypeId',
  'displayName',
  'targetFormats',
  'schemaVersion',
  'schemaStrategy',
  'mappingStrategy',
] as const);

const importProfileValidationAllowedKeys = new Set(['mode'] as const);
const normalizeImportProfileDefinition = (
  definition: PluginImportProfileDefinition
): PluginImportProfileDefinition => ({
  ...definition,
  profileId: normalizePluginIdentifier(definition.profileId),
  dataProfileId: normalizePluginIdentifier(definition.dataProfileId ?? definition.profileId),
  jobTypeId: normalizePluginIdentifier(definition.jobTypeId),
  displayName: definition.displayName.trim(),
  sourceFormats: definition.sourceFormats
    .map((format) => format.trim())
    .filter((format) => format.length > 0),
  schemaVersion: definition.schemaVersion.trim(),
  schemaStrategy: normalizePluginIdentifier(definition.schemaStrategy),
  mappingStrategy: normalizePluginIdentifier(definition.mappingStrategy),
});

const normalizeExportProfileDefinition = (
  definition: PluginExportProfileDefinition
): PluginExportProfileDefinition => ({
  ...definition,
  profileId: normalizePluginIdentifier(definition.profileId),
  dataProfileId: normalizePluginIdentifier(definition.dataProfileId),
  jobTypeId: normalizePluginIdentifier(definition.jobTypeId),
  displayName: definition.displayName.trim(),
  targetFormats: definition.targetFormats
    .map((format) => format.trim())
    .filter((format) => format.length > 0),
  schemaVersion: definition.schemaVersion.trim(),
  schemaStrategy: normalizePluginIdentifier(definition.schemaStrategy),
  mappingStrategy: normalizePluginIdentifier(definition.mappingStrategy),
});

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
      profile,
      importProfileDefinitionAllowedKeys,
      normalizedNamespace,
      normalizePluginIdentifier(profile.profileId)
    );
    assertPluginContributionAllowedKeys(
      profile.validation,
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

    const parsedDataProfile = parseNamespacedPluginIdentifier(
      normalizedProfile.dataProfileId ?? normalizedProfile.profileId
    );
    if (parsedDataProfile === undefined || parsedDataProfile.namespace !== normalizedNamespace) {
      throw new Error(
        `plugin_import_data_profile_namespace_mismatch:${normalizedNamespace}:${normalizedProfile.dataProfileId}`
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

export const definePluginExportProfiles = <
  const TExportProfiles extends readonly PluginExportProfileDefinition[],
>(
  namespace: string,
  exportProfiles: TExportProfiles
): TExportProfiles => {
  const normalizedNamespace = normalizePluginNamespace(namespace);
  if (isReservedPluginNamespace(normalizedNamespace)) {
    throw new Error(`reserved_plugin_namespace:${normalizedNamespace}`);
  }

  const normalizedExportProfiles = exportProfiles.map((profile) => {
    assertPluginContributionAllowedKeys(
      profile,
      exportProfileDefinitionAllowedKeys,
      normalizedNamespace,
      normalizePluginIdentifier(profile.profileId)
    );

    const normalizedProfile = normalizeExportProfileDefinition(profile);
    const parsedProfile = parseNamespacedPluginIdentifier(normalizedProfile.profileId);
    if (parsedProfile === undefined) {
      throw new Error(`invalid_plugin_export_profile:${normalizedProfile.profileId}`);
    }
    if (parsedProfile.namespace !== normalizedNamespace) {
      throw new Error(
        `plugin_export_profile_namespace_mismatch:${normalizedNamespace}:${parsedProfile.namespace}:${normalizedProfile.profileId}`
      );
    }

    const parsedDataProfile = parseNamespacedPluginIdentifier(normalizedProfile.dataProfileId);
    if (parsedDataProfile === undefined || parsedDataProfile.namespace !== normalizedNamespace) {
      throw new Error(
        `plugin_export_data_profile_namespace_mismatch:${normalizedNamespace}:${normalizedProfile.dataProfileId}`
      );
    }

    const parsedJobType = parseNamespacedPluginIdentifier(normalizedProfile.jobTypeId);
    if (parsedJobType === undefined || parsedJobType.namespace !== normalizedNamespace) {
      throw new Error(
        `plugin_export_profile_job_type_namespace_mismatch:${normalizedNamespace}:${normalizedProfile.jobTypeId}`
      );
    }

    if (
      normalizedProfile.displayName.length === 0 ||
      normalizedProfile.targetFormats.length === 0 ||
      normalizedProfile.schemaVersion.length === 0 ||
      normalizedProfile.schemaStrategy.length === 0 ||
      normalizedProfile.mappingStrategy.length === 0
    ) {
      throw new Error(`invalid_plugin_export_profile:${normalizedProfile.profileId}`);
    }

    return normalizedProfile;
  });

  return normalizedExportProfiles as unknown as TExportProfiles;
};
