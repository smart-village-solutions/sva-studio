import { wasteManagementHttpRuntime } from '@sva/waste-management-runtime/server';
import { pluginServerHost } from '@sva/auth-runtime/plugin-server-host';

export const {
  wasteManagementOverviewLoaders,
  wasteManagementEntityLoaders,
  wasteManagementEntitySavers,
  wasteManagementServerLoaderInternals,
} = wasteManagementHttpRuntime.createWasteServerLoaders({
  listExternalInterfaceRecords: pluginServerHost.listExternalInterfaceRecords,
  loadDefaultExternalInterfaceRecord: pluginServerHost.loadDefaultExternalInterfaceRecord,
  loadWasteTenantProvisioningRecord: pluginServerHost.loadWasteTenantProvisioningRecord,
  withInstanceDb: pluginServerHost.withInstanceDb,
  withStudioJobRepository: pluginServerHost.withStudioJobRepository,
  revealField: pluginServerHost.revealField,
  readPluginOperationInput: pluginServerHost.readPluginOperationInput,
  listWasteManagementAuditRecords: pluginServerHost.listWasteManagementAuditRecords,
  listWasteManagementTechnicalAuditRecords:
    pluginServerHost.listWasteManagementTechnicalAuditRecords,
});
