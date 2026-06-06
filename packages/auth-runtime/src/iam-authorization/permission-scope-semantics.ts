import type {
  IamPermissionRuntimeScope,
  IamRolePermissionAssignmentScope,
} from '@sva/core';
import {
  getManagedPermissionMetadata,
  listManagedPermissionMetadata,
} from '@sva/iam-admin';

type PermissionScopeSemanticsInput = {
  permissionKey: string;
  accessScope?: IamRolePermissionAssignmentScope | null;
};

const scopeSensitivePermissionKeys = listManagedPermissionMetadata()
  .filter((permission) => permission.runtimeScope !== 'instance')
  .map((permission) => permission.permissionKey);

const scopeSensitivePermissionKeySet: ReadonlySet<string> = new Set(
  scopeSensitivePermissionKeys
);

export const listScopeSensitivePermissionKeys = (): readonly string[] =>
  scopeSensitivePermissionKeys;

export const resolvePermissionRuntimeScope = (
  input: PermissionScopeSemanticsInput
): IamPermissionRuntimeScope => {
  const metadata = getManagedPermissionMetadata(input.permissionKey);
  if (metadata?.runtimeScope) {
    return metadata.runtimeScope;
  }

  if (input.accessScope && input.accessScope !== 'all') {
    return 'record';
  }

  return 'instance';
};

export const isScopeSensitivePermission = (
  input: PermissionScopeSemanticsInput
): boolean =>
  scopeSensitivePermissionKeySet.has(input.permissionKey) ||
  resolvePermissionRuntimeScope(input) !== 'instance';

export const projectOrganizationIdForPermission = (input: {
  permissionKey: string;
  accessScope?: IamRolePermissionAssignmentScope | null;
  organizationId?: string | null;
}): string | undefined =>
  isScopeSensitivePermission(input) ? input.organizationId ?? undefined : undefined;
