type PermissionScopeCandidate = Readonly<{
  action: string;
  resourceType: string;
  accessScope?: string;
}>;

export const hasMainserverActionAccessScope = (
  permissions: readonly PermissionScopeCandidate[],
  action: string,
  accessScope: 'all'
): boolean =>
  permissions.some(
    (permission) =>
      permission.action === action &&
      permission.resourceType === (action.split('.')[0] ?? '') &&
      permission.accessScope === accessScope
  );
