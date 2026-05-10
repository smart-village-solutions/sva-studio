import { wasteManagementOperationsContract } from '@sva/core';
import type { PluginImportProfileDefinition, PluginJobTypeDefinition } from '@sva/plugin-sdk';
import { definePluginImportProfiles, definePluginJobTypes } from '@sva/plugin-sdk';

const pluginNamespace = wasteManagementOperationsContract.pluginId;

export const createWasteManagementPluginJobTypes = (): readonly PluginJobTypeDefinition[] =>
  definePluginJobTypes(pluginNamespace, [
    {
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.initializeDataSource,
      queue: wasteManagementOperationsContract.queueName,
      displayName: 'Waste-Initialisierung',
      progress: {
        phaseKeys: ['waste-management.initialize', 'waste-management.completed'],
        stepKeys: ['resolve-data-source', 'apply-baseline-schema'],
      },
      result: {
        summaryKeys: ['durationMs'],
        detailKeys: ['applied-migration-count'],
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
        stepKeys: ['resolve-data-source', 'load-migration-plan', 'apply-migration-batch'],
      },
      result: {
        summaryKeys: ['durationMs'],
        detailKeys: ['applied-migration-count', 'target-schema-version'],
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
        phaseKeys: ['ingestion', 'schema-validation', 'mapping', 'preview', 'commit', 'completed'],
        stepKeys: ['parse-source', 'validate-records', 'map-records', 'persist-batch'],
      },
      result: {
        summaryKeys: ['processedItems', 'acceptedItems', 'rejectedItems', 'warningCount', 'durationMs'],
        detailKeys: ['import-profile-id', 'rejected-rows'],
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
        stepKeys: ['resolve-data-source', 'load-seed-bundle', 'persist-seed-batch'],
      },
      result: {
        summaryKeys: ['processedItems', 'acceptedItems', 'durationMs'],
        detailKeys: ['seed-key'],
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
        stepKeys: ['resolve-data-source', 'delete-domain-data', 'verify-empty-state'],
      },
      result: {
        summaryKeys: ['processedItems', 'durationMs'],
        detailKeys: ['deleted-table-count'],
      },
      errors: {
        detailKeys: ['failed-step', 'failed-table'],
      },
    },
  ]);

export const createWasteManagementPluginImportProfiles = (): readonly PluginImportProfileDefinition[] =>
  definePluginImportProfiles(pluginNamespace, [
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
  ]);
