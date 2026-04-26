import type { IamUserRoleAssignment } from '@sva/core';

export { buildUpdatedUserParams } from '@sva/iam-admin';

export const hasSystemAdminRole = (
  roles: readonly Pick<IamUserRoleAssignment, 'roleKey'>[]
): boolean => roles.some((role) => role.roleKey === 'system_admin');
