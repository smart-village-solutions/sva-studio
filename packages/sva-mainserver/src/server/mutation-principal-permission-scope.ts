type PermissionScopeCandidate = Readonly<{
  action: string;
  resourceType: string;
  accessScope?: string;
}>;

export const selectMainserverActionAccessScopePermissions = <
  TPermission extends PermissionScopeCandidate,
>(
  permissions: readonly TPermission[],
  action: string,
  resourceType: string,
  accessScope: 'all'
): readonly TPermission[] =>
  permissions.filter(
    (permission) =>
      permission.action === action &&
      permission.resourceType === resourceType &&
      (permission.accessScope === undefined || permission.accessScope === accessScope)
  );
