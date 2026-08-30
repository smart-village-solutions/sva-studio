import { wasteManagementOperationsContract, type PluginJobTypeDefinition } from '@sva/plugin-sdk';

export const wasteTenantReadinessJobType = {
  jobTypeId: wasteManagementOperationsContract.jobTypeIds.tenantReadiness,
  queue: wasteManagementOperationsContract.queueName,
  displayName: 'Waste-Tenant-Datenbank prüfen',
  progress: {
    phaseKeys: ['waste-management.tenant-readiness', 'waste-management.completed'],
    stepKeys: ['load-provisioning-state', 'complete-operation'],
  },
  errors: {
    detailKeys: ['failed-step', 'error-code'],
  },
} as const satisfies PluginJobTypeDefinition;
