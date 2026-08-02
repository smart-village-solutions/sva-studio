const wasteTenantProvisioningStatuses = [
  'provisioning',
  'ready',
  'failed',
  'disabled',
] as const;

export type WasteTenantProvisioningStatus = (typeof wasteTenantProvisioningStatuses)[number];

export type WasteTenantProvisioningRecord = Readonly<{
  instanceId: string;
  status: WasteTenantProvisioningStatus;
  desiredGeneration: number;
  completedGeneration: number;
  databaseName?: string;
  interfaceId?: string;
  activeJobId?: string;
  errorCode?: string;
  errorMessage?: string;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}>;

export const wasteTenantProvisioningContract = {
  statuses: wasteTenantProvisioningStatuses,
  jobTypeId: 'waste-management.provision-tenant-database',
  interfaceAlias: 'waste-management',
  interfaceOwnerId: 'waste-management',
  isStatus: (value: string): value is WasteTenantProvisioningStatus =>
    (wasteTenantProvisioningStatuses as readonly string[]).includes(value),
} as const;

