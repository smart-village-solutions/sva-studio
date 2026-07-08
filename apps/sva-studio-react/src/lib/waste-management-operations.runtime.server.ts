import {
  createApplyMigrationsOperation,
  createImportDataOperation,
  createInitializeDataSourceOperation,
  createResetDataOperation,
  createSeedDataOperation,
  createSyncMainserverOperation,
  createSyncWasteTypesOperation,
} from './waste-management-operations.handlers.server.js';
import {
  createMaterializeEmailRemindersOperation,
  createProcessEmailReminderOutboxOperation,
} from './waste-management-email-reminders.server.js';
import type { WasteManagementOperationRuntime, WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

export const createWasteManagementOperationRuntime = (
  deps: WasteOperationRuntimeDeps = {}
): WasteManagementOperationRuntime => ({
  initializeDataSource: createInitializeDataSourceOperation(deps),
  applyMigrations: createApplyMigrationsOperation(deps),
  importData: createImportDataOperation(deps),
  seedData: createSeedDataOperation(deps),
  syncMainserver: createSyncMainserverOperation(deps),
  syncWasteTypes: createSyncWasteTypesOperation(deps),
  materializeEmailReminders: createMaterializeEmailRemindersOperation(deps),
  processEmailReminderOutbox: createProcessEmailReminderOutboxOperation(deps),
  resetData: createResetDataOperation(deps),
});
