export const wasteManagementTenantLifecycleContract = {
  revision: 'waste-tenant-database-v1',
  readinessCheckIds: {
    provisioning: 'waste-management.tenant-provisioning',
    managedInterface: 'waste-management.tenant-database-interface',
  },
} as const;
