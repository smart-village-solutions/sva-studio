import {
  definePluginImportProfiles,
  wasteManagementDataProfiles,
  wasteManagementOperationsContract,
  type PluginImportProfileDefinition,
} from '@sva/plugin-sdk';

const pluginNamespace = wasteManagementOperationsContract.pluginId;

const canonicalImportProfiles = wasteManagementDataProfiles.map((profile) => ({
  profileId: profile.profileId,
  dataProfileId: profile.profileId,
  jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
  displayName: profile.displayName,
  sourceFormats:
    profile.profileId ===
      wasteManagementOperationsContract.importProfileIds.geographyCollectionLocations ||
    profile.profileId === wasteManagementOperationsContract.importProfileIds.tours ||
    profile.profileId === wasteManagementOperationsContract.importProfileIds.dateShifts
      ? [
          'application/json',
          'text/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]
      : ['application/json'],
  schemaVersion: profile.formatVersion,
  schemaStrategy: `${profile.profileId}.schema`,
  mappingStrategy: `${profile.profileId}.mapping`,
  validation: { mode: 'preflight-and-commit' as const },
}));

const wasteManagementPluginImportProfiles = [
  ...canonicalImportProfiles,
  {
    profileId: wasteManagementOperationsContract.importProfileIds.dataPackage,
    dataProfileId: wasteManagementOperationsContract.importProfileIds.dataPackage,
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
    displayName: 'Waste-Datenpaket',
    sourceFormats: ['application/zip'],
    schemaVersion: '1.0.0',
    schemaStrategy: 'waste-management.datenpaket.schema',
    mappingStrategy: 'waste-management.datenpaket.mapping',
    validation: { mode: 'preflight-and-commit' as const },
  },
  {
    profileId: wasteManagementOperationsContract.importProfileIds.locationTourPickupDates,
    dataProfileId: wasteManagementOperationsContract.importProfileIds.locationTourPickupDates,
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
    displayName: 'Tourzuordnungen nach Fraktionen',
    sourceFormats: ['text/csv'],
    schemaVersion: '1.0.0',
    schemaStrategy: 'waste-management.ortsbezogene-tourtermine.schema',
    mappingStrategy: 'waste-management.ortsbezogene-tourtermine.mapping',
    validation: {
      mode: 'preflight-and-commit',
    },
  },
] satisfies readonly PluginImportProfileDefinition[];

export const createWasteManagementPluginImportProfiles =
  (): readonly PluginImportProfileDefinition[] =>
    definePluginImportProfiles(pluginNamespace, wasteManagementPluginImportProfiles);
