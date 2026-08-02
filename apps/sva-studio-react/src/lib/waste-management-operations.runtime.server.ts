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
import { createProvisionTenantDatabaseOperation } from './waste-tenant-database-provisioner.server.js';

export const createWasteManagementOperationRuntime = (
  deps: WasteOperationRuntimeDeps = {}
): WasteManagementOperationRuntime => ({
  provisionTenantDatabase: createProvisionTenantDatabaseOperation({
    getProvisionerDatabaseUrl: () => process.env.WASTE_DATABASE_PROVISIONER_URL,
    createPool: deps.createPool,
    protectSecret: deps.protectSecret,
    now: deps.now,
  }),
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
