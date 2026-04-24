export const iamAdminVersion = '0.0.1';

export type IamAdminPackageRole = 'users' | 'roles' | 'groups' | 'organizations' | 'tenant-admin-client';

export const iamAdminPackageRoles = [
  'users',
  'roles',
  'groups',
  'organizations',
  'tenant-admin-client',
] as const satisfies readonly IamAdminPackageRole[];

export {
  buildRoleSyncFailure,
  getRoleDisplayName,
  getRoleExternalName,
  mapRoleListItem,
  mapRoleSyncErrorCode,
  sanitizeRoleAuditDetails,
  sanitizeRoleErrorMessage,
} from './role-audit.js';

export {
  loadRoleById,
  loadRoleListItemById,
  loadRoleListItems,
  type ManagedRoleRow,
} from './role-query.js';
