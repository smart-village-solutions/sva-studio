export const iamAdminVersion = '0.0.1';

export type IamAdminPackageRole = 'users' | 'roles' | 'groups' | 'organizations' | 'tenant-admin-client';

export const iamAdminPackageRoles = [
  'users',
  'roles',
  'groups',
  'organizations',
  'tenant-admin-client',
] as const satisfies readonly IamAdminPackageRole[];
