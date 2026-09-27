export const wasteManagementTenantLifecycleContract = {
  revision: 'waste-tenant-database-v2',
  readinessCheckIds: {
    provisioning: 'waste-management.tenant-provisioning',
    managedInterface: 'waste-management.tenant-database-interface',
    iamSchema: 'waste-management.iam-data-source-schema',
  },
} as const;
