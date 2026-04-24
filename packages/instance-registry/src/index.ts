export const instanceRegistryVersion = '0.0.1';

export type InstanceRegistryPackageRole = 'instances' | 'host-classification' | 'provisioning' | 'platform-admin-client';

export const instanceRegistryPackageRoles = [
  'instances',
  'host-classification',
  'provisioning',
  'platform-admin-client',
] as const satisfies readonly InstanceRegistryPackageRole[];
