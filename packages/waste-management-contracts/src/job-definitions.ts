import {
  definePluginJobTypes,
  wasteManagementOperationsContract,
  type PluginJobTypeDefinition,
} from '@sva/plugin-sdk';

export { createWasteManagementPluginImportProfiles } from './import-profile-definitions.js';

const pluginNamespace = wasteManagementOperationsContract.pluginId;

const wasteManagementPluginJobTypes = [
  {
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.provisionTenantDatabase,
    queue: wasteManagementOperationsContract.queueName,
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
    errors: {
      detailKeys: ['failed-step', 'error-code'],
    },
  },
  {
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.initializeDataSource,
    queue: wasteManagementOperationsContract.queueName,
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
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.applyMigrations,
    queue: wasteManagementOperationsContract.queueName,
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
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
    queue: wasteManagementOperationsContract.queueName,
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
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.seedData,
    queue: wasteManagementOperationsContract.queueName,
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
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.resetData,
    queue: wasteManagementOperationsContract.queueName,
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
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncMainserver,
    queue: wasteManagementOperationsContract.queueName,
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
      ],
    },
    errors: {
      detailKeys: ['failed-step', 'failed-item-key'],
    },
  },
  {
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncWasteTypes,
    queue: wasteManagementOperationsContract.queueName,
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
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.materializeEmailReminders,
    queue: wasteManagementOperationsContract.queueName,
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
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.processEmailReminderOutbox,
    queue: wasteManagementOperationsContract.queueName,
    displayName: 'Abfall-E-Mail-Erinnerungs-Outbox verarbeiten',
    progress: {
      phaseKeys: ['waste-management.process-email-reminder-outbox', 'waste-management.completed'],
      stepKeys: ['lease-outbox', 'complete-operation'],
    },
    result: {
      summaryKeys: ['durationMs'],
      detailKeys: ['leasedCount', 'sentCount', 'retryScheduledCount', 'failedCount', 'batchSize'],
    },
    errors: {
      detailKeys: ['failed-step', 'outboxId'],
    },
  },
] satisfies readonly PluginJobTypeDefinition[];

export const createWasteManagementPluginJobTypes = (): readonly PluginJobTypeDefinition[] =>
  definePluginJobTypes(pluginNamespace, wasteManagementPluginJobTypes);
