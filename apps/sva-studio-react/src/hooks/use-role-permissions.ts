import type { IamPermission } from '@sva/core';

import { listPermissions } from '../lib/iam-api';
import { useAuth } from '../providers/auth-provider';
import { useIamAdminList } from './use-iam-admin-list';

type UseRolePermissionsResult = {
  readonly permissions: readonly IamPermission[];
  readonly isLoading: boolean;
  readonly error: ReturnType<typeof useIamAdminList<IamPermission>>['error'];
  readonly refetch: () => Promise<void>;
};

export const useRolePermissions = (): UseRolePermissionsResult => {
  const { invalidatePermissions } = useAuth();
  const adminList = useIamAdminList(listPermissions, invalidatePermissions);

  return {
    permissions: adminList.items,
    isLoading: adminList.isLoading,
    error: adminList.error,
    refetch: adminList.refetch,
  };
};
