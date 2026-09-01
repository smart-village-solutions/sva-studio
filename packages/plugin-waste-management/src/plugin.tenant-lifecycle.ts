import {
  wasteManagementOperationsContract,
  type PluginTenantLifecycleDefinition,
} from '@sva/plugin-sdk';
import { wasteManagementTenantLifecycleContract } from '@sva/waste-management-contracts';

export const wasteManagementTenantLifecycle: PluginTenantLifecycleDefinition = {
  contractVersion: 1,
  operations: [
    {
      operation: 'provision',
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.provisionTenantDatabase,
    },
    {
      operation: 'reconcile',
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.provisionTenantDatabase,
    },
    {
      operation: 'readiness',
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.tenantReadiness,
    },
  ],
  readinessChecks: [
    {
      checkId: wasteManagementTenantLifecycleContract.readinessCheckIds.provisioning,
      titleKey: 'wasteManagement.readiness.provisioning',
      required: true,
      repairOperation: 'reconcile',
    },
    {
      checkId: wasteManagementTenantLifecycleContract.readinessCheckIds.managedInterface,
      titleKey: 'wasteManagement.readiness.managedInterface',
      required: true,
      repairOperation: 'reconcile',
    },
  ],
};
