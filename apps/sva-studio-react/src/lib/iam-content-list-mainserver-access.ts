import type { IamContentAccessSummary } from '@sva/core';

const deriveNamespacedAction = (
  contentType: string,
  action: 'create' | 'update'
): string | null => {
  const namespace = contentType.split('.')[0]?.trim();
  return namespace ? `${namespace}.${action}` : null;
};

export type PermissionView = Readonly<{ action: string }>;

const hasAllowedAction = (permissions: readonly PermissionView[], action: string): boolean =>
  permissions.some((permission) => permission.action === action);

export const createMainserverItemAccess = (
  contentType: string,
  permissions: readonly PermissionView[]
): IamContentAccessSummary => {
  const updateAction = deriveNamespacedAction(contentType, 'update');
  const createAction = deriveNamespacedAction(contentType, 'create');
  const canUpdate = updateAction ? hasAllowedAction(permissions, updateAction) : false;
  const canCreate = createAction ? hasAllowedAction(permissions, createAction) : false;

  return canUpdate
    ? {
        state: 'editable',
        canRead: true,
        canCreate,
        canUpdate: true,
        organizationIds: [],
        sourceKinds: [],
      }
    : {
        state: 'read_only',
        canRead: true,
        canCreate,
        canUpdate: false,
        reasonCode: 'content_update_missing',
        organizationIds: [],
        sourceKinds: [],
      };
};
