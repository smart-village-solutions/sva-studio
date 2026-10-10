import {
  createApplyMigrationsOperation,
  createImportDataOperation,
  createInitializeDataSourceOperation,
  createResetDataOperation,
  createSeedDataOperation,
  createSyncMainserverOperation,
  createSyncWasteTypesOperation,
} from './waste-management-operations.handlers.server.js';
import { createExportDataOperation } from './waste-management-operations.export.server.js';
import {
  createMaterializeEmailRemindersOperation,
  createProcessEmailReminderOutboxOperation,
} from './waste-management-email-reminders.server.js';
import type {
  WasteManagementOperationRuntime,
  WasteOperationRuntimeDeps,
} from './waste-management-operations.types.js';
import { createProvisionTenantDatabaseOperation } from './waste-tenant-database-provisioner.server.js';
import { createEnrichPostalCodesOperation } from './waste-management-postal-code-enrichment.server.js';
import { createReadWasteTenantDatabaseReadinessOperation } from './waste-tenant-database-readiness.server.js';
import { createWasteProvisioningAccess } from '../repositories/waste-provisioning.js';
import { createWasteDataSourceAccess } from '../repositories/waste-data-sources.js';

export const createWasteManagementOperationRuntime = (
  deps: WasteOperationRuntimeDeps
): WasteManagementOperationRuntime => {
  const provisioning = deps.withInstanceDb ? createWasteProvisioningAccess(deps.withInstanceDb) : null;
  const dataSources = deps.withInstanceDb ? createWasteDataSourceAccess(deps.withInstanceDb) : null;
  const runtimeDeps = {
    ...deps,
    ...(provisioning
      ? {
          loadProvisioning: deps.loadProvisioning ?? provisioning.loadWasteTenantProvisioningRecord,
          checkSchema: deps.checkSchema ?? dataSources?.checkWasteDataSourceSchema,
          requestProvisioning: deps.requestProvisioning ?? provisioning.requestWasteTenantProvisioning,
          suspendProvisioning: deps.suspendProvisioning ?? provisioning.disableWasteTenantProvisioning,
          claimProvisioning: deps.claimProvisioning ?? provisioning.claimWasteTenantProvisioning,
          completeProvisioning: deps.completeProvisioning ?? provisioning.completeWasteTenantProvisioning,
          failProvisioning: deps.failProvisioning ?? provisioning.failWasteTenantProvisioning,
        }
      : {}),
  };
  return {
  requestTenantDatabaseProvisioning: (instanceId) =>
    requireDependency(runtimeDeps.requestProvisioning, 'waste_provisioning_request_unavailable')(instanceId),
  suspendTenantDatabaseProvisioning: (instanceId) =>
    requireDependency(runtimeDeps.suspendProvisioning, 'waste_provisioning_suspend_unavailable')(instanceId),
  readTenantDatabaseReadiness: createReadWasteTenantDatabaseReadinessOperation(runtimeDeps),
  provisionTenantDatabase: createProvisionTenantDatabaseOperation({
    getProvisionerDatabaseUrl: deps.getProvisionerDatabaseUrl,
    createPool: deps.createPool,
    protectSecret: deps.protectSecret,
    revealSecret: deps.revealSecret,
    now: runtimeDeps.now,
  }),
  initializeDataSource: createInitializeDataSourceOperation(runtimeDeps),
  applyMigrations: createApplyMigrationsOperation(runtimeDeps),
  importData: createImportDataOperation(runtimeDeps),
  exportData: createExportDataOperation(runtimeDeps),
  seedData: createSeedDataOperation(runtimeDeps),
  syncMainserver: createSyncMainserverOperation(runtimeDeps),
  syncWasteTypes: createSyncWasteTypesOperation(runtimeDeps),
  enrichPostalCodes: createEnrichPostalCodesOperation(runtimeDeps),
  materializeEmailReminders: createMaterializeEmailRemindersOperation(runtimeDeps),
  processEmailReminderOutbox: createProcessEmailReminderOutboxOperation(runtimeDeps),
  resetData: createResetDataOperation(runtimeDeps),
  };
};

const requireDependency = <T>(
  dependency: T | undefined,
  message: string
): NonNullable<T> => {
  if (dependency === undefined || dependency === null) {
    throw new Error(message);
  }
  return dependency as NonNullable<T>;
};
