type PermissionScopeCandidate = Readonly<{
  action: string;
  resourceType: string;
  accessScope?: string;
}>;

export const hasMainserverActionAccessScope = (
  permissions: readonly PermissionScopeCandidate[],
  action: string,
  resourceType: string,
  accessScope: 'all'
): boolean =>
  permissions.some(
    (permission) =>
      permission.action === action &&
      permission.resourceType === resourceType &&
      (permission.accessScope === undefined || permission.accessScope === accessScope)
  );
