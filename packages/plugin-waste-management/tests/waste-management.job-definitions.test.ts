import { describe, expect, it } from 'vitest';

import {
  createWasteManagementPluginImportProfiles,
  createWasteManagementPluginJobTypes,
} from '../src/waste-management.job-definitions.js';

describe('waste management job definitions', () => {
  it('keeps waste-specific job types inside the waste plugin package', () => {
    expect(createWasteManagementPluginJobTypes()).toEqual([
      {
        jobTypeId: 'waste-management.initialize-data-source',
        queue: 'plugin-operations',
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
        jobTypeId: 'waste-management.apply-migrations',
        queue: 'plugin-operations',
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
        jobTypeId: 'waste-management.import-data',
        queue: 'plugin-operations',
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
        jobTypeId: 'waste-management.seed-data',
        queue: 'plugin-operations',
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
        jobTypeId: 'waste-management.reset-data',
        queue: 'plugin-operations',
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
        jobTypeId: 'waste-management.sync-mainserver',
        queue: 'plugin-operations',
        displayName: 'Waste-Mainserver synchronisieren',
        progress: {
          phaseKeys: ['waste-management.mainserver-sync', 'waste-management.completed'],
          stepKeys: ['load-studio-state', 'sync-mainserver', 'complete-operation'],
        },
        result: {
          summaryKeys: ['durationMs'],
          detailKeys: ['studioItemCount', 'mainserverItemCount', 'createCount', 'deleteCount', 'errorCount'],
        },
        errors: {
          detailKeys: ['failed-step', 'failed-item-key'],
        },
      },
      {
        jobTypeId: 'waste-management.sync-waste-types',
        queue: 'plugin-operations',
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
    ]);
  });

  it('keeps waste-specific import profiles inside the waste plugin package', () => {
    expect(createWasteManagementPluginImportProfiles()).toEqual([
      {
        profileId: 'waste-management.geografie-abholorte',
        jobTypeId: 'waste-management.import-data',
        displayName: 'Geografie und Abholorte',
        sourceFormats: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        schemaVersion: '1.0.0',
        schemaStrategy: 'waste-management.geografie-abholorte.schema',
        mappingStrategy: 'waste-management.geografie-abholorte.mapping',
        validation: {
          mode: 'preflight-and-commit',
        },
      },
      {
        profileId: 'waste-management.touren',
        jobTypeId: 'waste-management.import-data',
        displayName: 'Touren',
        sourceFormats: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        schemaVersion: '1.0.0',
        schemaStrategy: 'waste-management.touren.schema',
        mappingStrategy: 'waste-management.touren.mapping',
        validation: {
          mode: 'preflight-and-commit',
        },
      },
      {
        profileId: 'waste-management.ausweichtermine',
        jobTypeId: 'waste-management.import-data',
        displayName: 'Ausweichtermine',
        sourceFormats: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        schemaVersion: '1.0.0',
        schemaStrategy: 'waste-management.ausweichtermine.schema',
        mappingStrategy: 'waste-management.ausweichtermine.mapping',
        validation: {
          mode: 'preflight-and-commit',
        },
      },
      {
        profileId: 'waste-management.ortsbezogene-tourtermine',
        jobTypeId: 'waste-management.import-data',
        displayName: 'Tourzuordnungen nach Fraktionen',
        sourceFormats: ['text/csv'],
        schemaVersion: '1.0.0',
        schemaStrategy: 'waste-management.ortsbezogene-tourtermine.schema',
        mappingStrategy: 'waste-management.ortsbezogene-tourtermine.mapping',
        validation: {
          mode: 'preflight-and-commit',
        },
      },
    ]);
  });
});
