import { wasteManagementOperationsContract } from '@sva/plugin-sdk';
import type { PluginImportProfileDefinition, PluginJobTypeDefinition } from '@sva/plugin-sdk';
import { definePluginImportProfiles, definePluginJobTypes } from '@sva/plugin-sdk';

const pluginNamespace = wasteManagementOperationsContract.pluginId;

const wasteManagementPluginJobTypes = [
  {
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.initializeDataSource,
    queue: wasteManagementOperationsContract.queueName,
    displayName: 'Waste-Initialisierung',
    progress: {
      phaseKeys: ['waste-management.initialize', 'waste-management.completed'],
      stepKeys: ['resolve-operation', 'complete-operation'],
    },
    result: {
      summaryKeys: ['durationMs'],
      detailKeys: ['connectionCheck', 'schemaInspection'],
    },
    errors: {
      detailKeys: ['failed-step', 'failed-migration'],
    },
  },
  {
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.applyMigrations,
    queue: wasteManagementOperationsContract.queueName,
    displayName: 'Waste-Migrationen anwenden',
    progress: {
      phaseKeys: ['waste-management.migrations', 'waste-management.completed'],
      stepKeys: ['resolve-operation', 'complete-operation'],
    },
    result: {
      summaryKeys: ['durationMs'],
      detailKeys: ['requestedByVersion', 'schemaInspection', 'appliedStatementCount'],
    },
    errors: {
      detailKeys: ['failed-step', 'failed-migration'],
    },
  },
  {
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
    queue: wasteManagementOperationsContract.queueName,
    displayName: 'Waste-Daten importieren',
    progress: {
      phaseKeys: [
        'waste-management.import-preparation',
        'waste-management.import-running',
        'waste-management.completed',
      ],
      stepKeys: ['prepare-import', 'process-rows', 'complete-operation'],
    },
    result: {
      summaryKeys: ['durationMs'],
      detailKeys: [
        'importProfileId',
        'sourceFormat',
        'dryRun',
        'rowCount',
        'rows',
        'upserts',
        'createdFractions',
        'createdTours',
        'createdLocations',
        'createdAssignments',
        'skippedRows',
        'errorCount',
        'preview',
      ],
    },
    errors: {
      detailKeys: ['failed-step', 'source-row'],
    },
  },
  {
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.seedData,
    queue: wasteManagementOperationsContract.queueName,
    displayName: 'Waste-Seed laden',
    progress: {
      phaseKeys: ['waste-management.seed', 'waste-management.completed'],
      stepKeys: ['resolve-operation', 'complete-operation'],
    },
    result: {
      summaryKeys: ['durationMs'],
      detailKeys: ['seedKey', 'seededEntityCount'],
    },
    errors: {
      detailKeys: ['failed-step', 'failed-entity'],
    },
  },
  {
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.resetData,
    queue: wasteManagementOperationsContract.queueName,
    displayName: 'Waste-Daten zurücksetzen',
    progress: {
      phaseKeys: ['waste-management.reset', 'waste-management.completed'],
      stepKeys: ['resolve-operation', 'complete-operation'],
    },
    result: {
      summaryKeys: ['durationMs'],
      detailKeys: ['confirmationTokenLength', 'deletedRows'],
    },
    errors: {
      detailKeys: ['failed-step', 'failed-table'],
    },
  },
  {
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncWasteTypes,
    queue: wasteManagementOperationsContract.queueName,
    displayName: 'Waste-Typen mit Mainserver synchronisieren',
    progress: {
      phaseKeys: ['waste-management.sync-waste-types', 'waste-management.completed'],
      stepKeys: ['build-static-content', 'push-static-content'],
    },
    result: {
      summaryKeys: ['durationMs'],
      detailKeys: ['staticContentName', 'version', 'fractionCount'],
    },
    errors: {
      detailKeys: ['failed-step'],
    },
  },
] satisfies readonly PluginJobTypeDefinition[];

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

export const createWasteManagementPluginJobTypes = (): readonly PluginJobTypeDefinition[] =>
  definePluginJobTypes(pluginNamespace, wasteManagementPluginJobTypes);

export const createWasteManagementPluginImportProfiles = (): readonly PluginImportProfileDefinition[] =>
  definePluginImportProfiles(pluginNamespace, wasteManagementPluginImportProfiles);
