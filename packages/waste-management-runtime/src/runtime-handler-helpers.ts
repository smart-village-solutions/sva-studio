import {
  wasteManagementOperationsContract,
  type WasteManagementApplyMigrationsJobInput,
  type WasteManagementExportJobInput,
  type WasteManagementInitializeJobInput,
  type WasteManagementMaterializeEmailRemindersJobInput,
  type WasteManagementProcessEmailReminderOutboxJobInput,
  type WasteManagementProvisionTenantDatabaseJobInput,
  type WasteManagementResetJobInput,
  type WasteManagementSeedJobInput,
  type WasteManagementSyncMainserverJobInput,
  type WasteManagementSyncWasteTypesJobInput,
} from '@sva/plugin-sdk';
import type { WasteManagementEnrichPostalCodesJobInput } from '@sva/core';

import { createImportDataHandler } from './runtime-import-handler.js';
import { createOperationHandler } from './runtime-job-helpers.js';
import type { WasteManagementOperationRuntime } from './runtime-types.js';

const wasteTenantDatabaseRevision = 'waste-tenant-database-v1';

const createProvisionTenantDatabaseHandler = (runtime: WasteManagementOperationRuntime) => {
  const executeProvisioning =
    createOperationHandler<WasteManagementProvisionTenantDatabaseJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.provisionTenantDatabase,
      expectedOperation: 'provision-tenant-database',
      phaseKey: 'waste-management.provision-database',
      execute: (runtimeArg, instanceId, payload, _progressReporter, context) =>
        runtimeArg.provisionTenantDatabase(instanceId, payload, {
          jobId: context.jobId,
        }),
    })(runtime);

  return async (context: Parameters<typeof executeProvisioning>[0]) => {
    if (!context.tenantLifecycle) {
      return executeProvisioning(context);
    }
    if (
      context.tenantLifecycle.operation !== 'provision' &&
      context.tenantLifecycle.operation !== 'reconcile'
    ) {
      throw new Error(
        `unsupported_waste_tenant_lifecycle_operation:${context.tenantLifecycle.operation}`
      );
    }

    const result = await executeProvisioning({
      ...context,
      job: {
        ...context.job,
        inputPayload: {
          operation: 'provision-tenant-database',
          desiredGeneration: context.tenantLifecycle.generation,
        },
      },
    });

    return {
      ...result,
      tenantLifecycle: {
        revision: wasteTenantDatabaseRevision,
        checks: [],
      },
    };
  };
};

const createEnrichPostalCodesHandler = (runtime: WasteManagementOperationRuntime) =>
  createOperationHandler<WasteManagementEnrichPostalCodesJobInput>({
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.enrichPostalCodes,
    expectedOperation: 'enrich-postal-codes',
    phaseKey: 'waste-management.enrich-postal-codes',
    useRuntimeManagedProgress: () => true,
    execute: (runtimeArg, instanceId, payload, progressReporter, context) =>
      runtimeArg.enrichPostalCodes(instanceId, payload, progressReporter, context),
  })(runtime);

const createEmailReminderHandlers = (runtime: WasteManagementOperationRuntime) => ({
  [wasteManagementOperationsContract.jobTypeIds.materializeEmailReminders]:
    createOperationHandler<WasteManagementMaterializeEmailRemindersJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.materializeEmailReminders,
      expectedOperation: 'materialize-email-reminders',
      phaseKey: 'waste-management.materialize-email-reminders',
      execute: (runtimeArg, instanceId, payload) =>
        runtimeArg.materializeEmailReminders(instanceId, payload),
    })(runtime),
  [wasteManagementOperationsContract.jobTypeIds.processEmailReminderOutbox]:
    createOperationHandler<WasteManagementProcessEmailReminderOutboxJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.processEmailReminderOutbox,
      expectedOperation: 'process-email-reminder-outbox',
      phaseKey: 'waste-management.process-email-reminder-outbox',
      execute: (runtimeArg, instanceId, payload) =>
        runtimeArg.processEmailReminderOutbox(instanceId, payload),
    })(runtime),
});

export const createWasteRuntimeOperationHandlers = (runtime: WasteManagementOperationRuntime) => ({
  [wasteManagementOperationsContract.jobTypeIds.provisionTenantDatabase]:
    createProvisionTenantDatabaseHandler(runtime),
  [wasteManagementOperationsContract.jobTypeIds.initializeDataSource]:
    createOperationHandler<WasteManagementInitializeJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.initializeDataSource,
      expectedOperation: 'initialize-data-source',
      phaseKey: 'waste-management.initialize',
      execute: (runtimeArg, instanceId, payload) =>
        runtimeArg.initializeDataSource(instanceId, payload),
    })(runtime),
  [wasteManagementOperationsContract.jobTypeIds.applyMigrations]:
    createOperationHandler<WasteManagementApplyMigrationsJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.applyMigrations,
      expectedOperation: 'apply-migrations',
      phaseKey: 'waste-management.migrations',
      execute: (runtimeArg, instanceId, payload) => runtimeArg.applyMigrations(instanceId, payload),
    })(runtime),
  [wasteManagementOperationsContract.jobTypeIds.importData]: createImportDataHandler(runtime),
  [wasteManagementOperationsContract.jobTypeIds.exportData]:
    createOperationHandler<WasteManagementExportJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.exportData,
      expectedOperation: 'export-data',
      phaseKey: 'waste-management.export-running',
      execute: (runtimeArg, instanceId, payload, _progressReporter, context) =>
        runtimeArg.exportData(instanceId, payload, { jobId: context.jobId }),
    })(runtime),
  [wasteManagementOperationsContract.jobTypeIds.seedData]:
    createOperationHandler<WasteManagementSeedJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.seedData,
      expectedOperation: 'seed-data',
      phaseKey: 'waste-management.seed',
      execute: (runtimeArg, instanceId, payload) => runtimeArg.seedData(instanceId, payload),
    })(runtime),
  [wasteManagementOperationsContract.jobTypeIds.resetData]:
    createOperationHandler<WasteManagementResetJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.resetData,
      expectedOperation: 'reset-data',
      phaseKey: 'waste-management.reset',
      execute: (runtimeArg, instanceId, payload) => runtimeArg.resetData(instanceId, payload),
    })(runtime),
  [wasteManagementOperationsContract.jobTypeIds.syncMainserver]:
    createOperationHandler<WasteManagementSyncMainserverJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncMainserver,
      expectedOperation: 'sync-mainserver',
      phaseKey: 'waste-management.mainserver-sync',
      useRuntimeManagedProgress: () => true,
      execute: (runtimeArg, instanceId, payload, progressReporter) =>
        runtimeArg.syncMainserver(instanceId, payload, progressReporter),
    })(runtime),
  [wasteManagementOperationsContract.jobTypeIds.syncWasteTypes]:
    createOperationHandler<WasteManagementSyncWasteTypesJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncWasteTypes,
      expectedOperation: 'sync-waste-types',
      phaseKey: 'waste-management.sync-waste-types',
      execute: (runtimeArg, instanceId, payload) => runtimeArg.syncWasteTypes(instanceId, payload),
    })(runtime),
  [wasteManagementOperationsContract.jobTypeIds.enrichPostalCodes]:
    createEnrichPostalCodesHandler(runtime),
  ...createEmailReminderHandlers(runtime),
});
