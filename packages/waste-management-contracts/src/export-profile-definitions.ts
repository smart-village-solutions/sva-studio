import { definePluginExportProfiles, type PluginExportProfileDefinition } from '@sva/plugin-sdk';
import { wasteManagementDataProfiles } from './waste-management-data-profiles.js';
import { wasteManagementOperationsContract } from './waste-management-operations-contract.js';

const pluginNamespace = wasteManagementOperationsContract.pluginId;

const wasteManagementPluginExportProfiles = wasteManagementDataProfiles.map((profile) => ({
  profileId: `${profile.profileId}-export`,
  dataProfileId: profile.profileId,
  jobTypeId: wasteManagementOperationsContract.jobTypeIds.exportData,
  displayName: profile.displayName,
  targetFormats: [...profile.formats],
  schemaVersion: profile.formatVersion,
  schemaStrategy: `${profile.profileId}.schema`,
  mappingStrategy: `${profile.profileId}.mapping`,
})) satisfies readonly PluginExportProfileDefinition[];

export const createWasteManagementPluginExportProfiles =
  (): readonly PluginExportProfileDefinition[] =>
    definePluginExportProfiles(pluginNamespace, wasteManagementPluginExportProfiles);
