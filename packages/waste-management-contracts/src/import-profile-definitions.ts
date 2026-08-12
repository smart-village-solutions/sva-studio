import {
  definePluginImportProfiles,
  wasteManagementOperationsContract,
  type PluginImportProfileDefinition,
} from '@sva/plugin-sdk';

const pluginNamespace = wasteManagementOperationsContract.pluginId;

const wasteManagementPluginImportProfiles = [
  {
    profileId: wasteManagementOperationsContract.importProfileIds.geographyCollectionLocations,
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
    displayName: 'Geografie und Abholorte',
    sourceFormats: [...wasteManagementOperationsContract.importSourceFormats],
    schemaVersion: '1.0.0',
    schemaStrategy: 'waste-management.geografie-abholorte.schema',
    mappingStrategy: 'waste-management.geografie-abholorte.mapping',
    validation: {
      mode: 'preflight-and-commit',
    },
  },
  {
    profileId: wasteManagementOperationsContract.importProfileIds.tours,
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
    displayName: 'Touren',
    sourceFormats: [...wasteManagementOperationsContract.importSourceFormats],
    schemaVersion: '1.0.0',
    schemaStrategy: 'waste-management.touren.schema',
    mappingStrategy: 'waste-management.touren.mapping',
    validation: {
      mode: 'preflight-and-commit',
    },
  },
  {
    profileId: wasteManagementOperationsContract.importProfileIds.dateShifts,
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
    displayName: 'Ausweichtermine',
    sourceFormats: [...wasteManagementOperationsContract.importSourceFormats],
    schemaVersion: '1.0.0',
    schemaStrategy: 'waste-management.ausweichtermine.schema',
    mappingStrategy: 'waste-management.ausweichtermine.mapping',
    validation: {
      mode: 'preflight-and-commit',
    },
  },
  {
    profileId: wasteManagementOperationsContract.importProfileIds.locationTourPickupDates,
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
