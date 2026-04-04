import type { IamPermission } from '@sva/core';

import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { listPermissions } from '../lib/iam-api';
import { useAuth } from '../providers/auth-provider';
import { useIamAdminList } from './use-iam-admin-list';

const rolePermissionsLogger = createOperationLogger('use-role-permissions', 'debug');

type UseRolePermissionsResult = {
  readonly permissions: readonly IamPermission[];
  readonly isLoading: boolean;
  readonly error: ReturnType<typeof useIamAdminList<IamPermission>>['error'];
  readonly refetch: () => Promise<void>;
};

export const useRolePermissions = (): UseRolePermissionsResult => {
  const { invalidatePermissions } = useAuth();
  const adminList = useIamAdminList(listPermissions, invalidatePermissions);

  const refetch = async (): Promise<void> => {
    logBrowserOperationStart(rolePermissionsLogger, 'role_permissions_refetch_started', {
      operation: 'refetch_role_permissions',
    });
    try {
      await adminList.refetch();
      logBrowserOperationSuccess(rolePermissionsLogger, 'role_permissions_refetch_succeeded', {
        operation: 'refetch_role_permissions',
      }, 'debug');
    } catch (error) {
      logBrowserOperationFailure(rolePermissionsLogger, 'role_permissions_refetch_failed', error, {
        operation: 'refetch_role_permissions',
      });
      throw error;
    }
  };

  return {
    permissions: adminList.items,
    isLoading: adminList.isLoading,
    error: adminList.error,
    refetch,
  };
};
