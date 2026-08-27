import { describe, expect, it } from 'vitest';

import {
  createWasteManagementPluginImportProfiles,
  createWasteManagementPluginJobTypes,
} from '../src/waste-management.job-definitions.js';

describe('waste management job definitions', () => {
  it('keeps the contracts-owned waste job types available through the plugin compatibility export', () => {
    const jobTypes = createWasteManagementPluginJobTypes();
    expect(
      jobTypes.filter(({ jobTypeId }) => jobTypeId !== 'waste-management.export-data')
    ).toEqual([
      {
        jobTypeId: 'waste-management.provision-tenant-database',
        queue: 'plugin-operations',
        displayName: 'Waste-Tenant-Datenbank provisionieren',
        progress: {
          phaseKeys: [
            'waste-management.provision-database',
            'waste-management.apply-migrations',
            'waste-management.verify-access',
            'waste-management.completed',
          ],
          stepKeys: [
            'provision-roles',
            'provision-database',
            'materialize-interface',
            'apply-migrations',
            'verify-access',
          ],
        },
        result: {
          summaryKeys: ['durationMs'],
          detailKeys: ['databaseName', 'interfaceId', 'desiredGeneration'],
        },
        errors: { detailKeys: ['failed-step', 'error-code'] },
      },
      {
        jobTypeId: 'waste-management.initialize-data-source',
        queue: 'plugin-operations',
        displayName: 'Abfall-Initialisierung',
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
        displayName: 'Abfall-Migrationen anwenden',
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
        displayName: 'Abfall-Daten importieren',
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
        displayName: 'Abfallinitialdaten laden',
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
        displayName: 'Abfalldaten zurücksetzen',
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
        displayName: 'Abfalldaten mit dem Mainserver synchronisieren',
        progress: {
          phaseKeys: ['waste-management.mainserver-sync', 'waste-management.completed'],
          stepKeys: [
            'load-studio-state',
            'load-mainserver-snapshot',
            'diff-sync-state',
            'create-batches',
            'delete-batches',
            'complete-operation',
          ],
        },
        result: {
          summaryKeys: ['durationMs'],
          detailKeys: [
            'studioItemCount',
            'mainserverItemCount',
            'createCount',
            'createBatchCount',
            'deleteCount',
            'deleteByIdCount',
            'deleteByValueCount',
            'errorCount',
            'totalBatchCount',
            'processedItemCount',
            'finalCreateCount',
            'finalDeleteCount',
            'averageBatchDurationMs',
            'longestBatchDurationMs',
            'studioSnapshotCount',
            'mainserverSnapshotCount',
            'sourceRevision',
            'yearWindow',
          ],
        },
        errors: {
          detailKeys: ['failed-step', 'failed-item-key'],
        },
      },
      {
        jobTypeId: 'waste-management.sync-waste-types',
        queue: 'plugin-operations',
        displayName: 'Abfall-Typen mit Mainserver synchronisieren',
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
      {
        jobTypeId: 'waste-management.enrich-postal-codes',
        queue: 'plugin-operations',
        displayName: 'Fehlende Waste-Postleitzahlen ergänzen',
        progress: {
          phaseKeys: ['waste-management.enrich-postal-codes', 'waste-management.completed'],
          stepKeys: ['load-cities', 'resolve-postal-codes', 'complete-operation'],
        },
        result: {
          summaryKeys: ['durationMs'],
          detailKeys: [
            'cityCount',
            'missingCount',
            'resolvedCount',
            'updatedCount',
            'ambiguousCount',
            'notFoundCount',
            'failedCount',
            'skippedExistingCount',
            'providerRequestCount',
            'requestBudget',
            'budgetExhausted',
            'unprocessedCount',
          ],
        },
        errors: {
          detailKeys: ['failed-step', 'error-code'],
        },
      },
      {
        jobTypeId: 'waste-management.materialize-email-reminders',
        queue: 'plugin-operations',
        displayName: 'Abfall-E-Mail-Erinnerungen materialisieren',
        progress: {
          phaseKeys: ['waste-management.materialize-email-reminders', 'waste-management.completed'],
          stepKeys: ['load-reminder-state', 'complete-operation'],
        },
        result: {
          summaryKeys: ['durationMs'],
          detailKeys: [
            'activeSubscriptionCount',
            'createdOutboxCount',
            'duplicateOutboxCount',
            'skippedPickupCount',
          ],
        },
        errors: {
          detailKeys: ['failed-step'],
        },
      },
      {
        jobTypeId: 'waste-management.process-email-reminder-outbox',
        queue: 'plugin-operations',
        displayName: 'Abfall-E-Mail-Erinnerungs-Outbox verarbeiten',
        progress: {
          phaseKeys: [
            'waste-management.process-email-reminder-outbox',
            'waste-management.completed',
          ],
          stepKeys: ['lease-outbox', 'complete-operation'],
        },
        result: {
          summaryKeys: ['durationMs'],
          detailKeys: [
            'leasedCount',
            'sentCount',
            'retryScheduledCount',
            'failedCount',
            'batchSize',
          ],
        },
        errors: {
          detailKeys: ['failed-step', 'outboxId'],
        },
      },
    ]);
    expect(jobTypes).toContainEqual(
      expect.objectContaining({
        jobTypeId: 'waste-management.export-data',
        queue: 'plugin-operations',
      })
    );
  });

  it('keeps the contracts-owned import profiles available through the plugin compatibility export', () => {
    const profiles = createWasteManagementPluginImportProfiles();
    const legacyProfileIds = new Set([
      'waste-management.geografie-abholorte',
      'waste-management.touren',
      'waste-management.ausweichtermine',
      'waste-management.ortsbezogene-tourtermine',
    ]);
    expect(
      profiles
        .filter(({ profileId }) => legacyProfileIds.has(profileId))
        .map(({ dataProfileId: _dataProfileId, sourceFormats, ...profile }) => ({
          ...profile,
          sourceFormats: sourceFormats.filter((format) => format !== 'application/json'),
        }))
    ).toEqual([
      {
        profileId: 'waste-management.geografie-abholorte',
        jobTypeId: 'waste-management.import-data',
        displayName: 'Geografie und Abholorte',
        sourceFormats: [
          'text/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
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
        sourceFormats: [
          'text/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
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
        sourceFormats: [
          'text/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
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
    expect(profiles.map(({ profileId }) => profileId)).toEqual([
      'waste-management.fraktionen',
      'waste-management.geografie-abholorte',
      'waste-management.abstandspresets',
      'waste-management.touren',
      'waste-management.abholort-tour-zuordnungen',
      'waste-management.tour-einsaetze',
      'waste-management.ausweichtermine',
      'waste-management.feiertagsregeln',
      'waste-management.portable-einstellungen',
      'waste-management.datenpaket',
      'waste-management.ortsbezogene-tourtermine',
    ]);
  });
});
