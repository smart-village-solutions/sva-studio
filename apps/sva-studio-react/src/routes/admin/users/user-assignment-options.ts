import { isTenantRoleVisible } from '../../../lib/iam-role-governance';

type UserAssignableRole = Parameters<typeof isTenantRoleVisible>[0] & {
  readonly id: string;
};

type UserAssignableGroup = {
  readonly isActive?: boolean;
};

export const selectAssignableRoles = <TRole extends UserAssignableRole>(roles: readonly TRole[]): TRole[] =>
  roles.filter((role) => isTenantRoleVisible(role));

export const selectAssignableGroups = <TGroup extends UserAssignableGroup>(groups: readonly TGroup[]): TGroup[] =>
  groups.filter((group) => group.isActive !== false);
