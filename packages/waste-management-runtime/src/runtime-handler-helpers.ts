import {
  wasteManagementOperationsContract,
  type WasteManagementApplyMigrationsJobInput,
  type WasteManagementInitializeJobInput,
  type WasteManagementResetJobInput,
  type WasteManagementSeedJobInput,
  type WasteManagementSyncMainserverJobInput,
  type WasteManagementSyncWasteTypesJobInput,
} from '@sva/plugin-sdk';

import { createImportDataHandler } from './runtime-import-handler.js';
import { createOperationHandler } from './runtime-job-helpers.js';
import type { WasteManagementOperationRuntime } from './runtime-types.js';

export const createWasteRuntimeOperationHandlers = (runtime: WasteManagementOperationRuntime) => ({
  [wasteManagementOperationsContract.jobTypeIds.initializeDataSource]:
    createOperationHandler<WasteManagementInitializeJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.initializeDataSource,
      expectedOperation: 'initialize-data-source',
      phaseKey: 'waste-management.initialize',
      execute: (runtimeArg, instanceId, payload) => runtimeArg.initializeDataSource(instanceId, payload),
    })(runtime),
  [wasteManagementOperationsContract.jobTypeIds.applyMigrations]:
    createOperationHandler<WasteManagementApplyMigrationsJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.applyMigrations,
      expectedOperation: 'apply-migrations',
      phaseKey: 'waste-management.migrations',
      execute: (runtimeArg, instanceId, payload) => runtimeArg.applyMigrations(instanceId, payload),
    })(runtime),
  [wasteManagementOperationsContract.jobTypeIds.importData]: createImportDataHandler(runtime),
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
      execute: (runtimeArg, instanceId, payload) => runtimeArg.syncMainserver(instanceId, payload),
    })(runtime),
  [wasteManagementOperationsContract.jobTypeIds.syncWasteTypes]:
    createOperationHandler<WasteManagementSyncWasteTypesJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncWasteTypes,
      expectedOperation: 'sync-waste-types',
      phaseKey: 'waste-management.sync-waste-types',
      execute: (runtimeArg, instanceId, payload) => runtimeArg.syncWasteTypes(instanceId, payload),
    })(runtime),
});
