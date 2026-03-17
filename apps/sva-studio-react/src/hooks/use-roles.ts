import type { IamRoleListItem } from '@sva/core';
import React from 'react';

import {
  asIamError,
  createRole,
  deleteRole,
  IamHttpError,
  listRoles,
  reconcileRoles,
  updateRole,
  type CreateRolePayload,
  type RoleReconcileReport,
  type UpdateRolePayload,
} from '../lib/iam-api';
import { useAuth } from '../providers/auth-provider';
import { useIamAdminList } from './use-iam-admin-list';

type UseRolesResult = {
  readonly roles: readonly IamRoleListItem[];
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly mutationError: IamHttpError | null;
  readonly reconcileReport: RoleReconcileReport | null;
  readonly refetch: () => Promise<void>;
  readonly clearMutationError: () => void;
  readonly createRole: (payload: CreateRolePayload) => Promise<boolean>;
  readonly updateRole: (roleId: string, payload: UpdateRolePayload) => Promise<boolean>;
  readonly deleteRole: (roleId: string) => Promise<boolean>;
  readonly retryRoleSync: (roleId: string) => Promise<boolean>;
  readonly reconcile: () => Promise<boolean>;
};

export const useRoles = (): UseRolesResult => {
  const { invalidatePermissions } = useAuth();
  const [reconcileReport, setReconcileReport] = React.useState<RoleReconcileReport | null>(null);
  const adminList = useIamAdminList(listRoles, invalidatePermissions);

  return {
    roles: adminList.items,
    isLoading: adminList.isLoading,
    error: adminList.error,
    mutationError: adminList.mutationError,
    reconcileReport,
    refetch: adminList.refetch,
    clearMutationError: adminList.clearMutationError,
    createRole: (payload) => adminList.runMutation(() => createRole(payload)),
    updateRole: (roleId, payload) => adminList.runMutation(() => updateRole(roleId, payload)),
    deleteRole: (roleId) => adminList.runMutation(() => deleteRole(roleId)),
    retryRoleSync: (roleId) => adminList.runMutation(() => updateRole(roleId, { retrySync: true })),
    reconcile: async () => {
      adminList.setError(null);
      setReconcileReport(null);
      try {
        const response = await reconcileRoles();
        setReconcileReport(response.data);
        await adminList.refetch();
        return true;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        adminList.setError(resolvedError);
        return false;
      }
    },
  };
};
