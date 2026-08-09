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
import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { useAuth } from '../providers/auth-provider';
import { requestEffectiveAccessInvalidation } from '../providers/effective-access-invalidation';
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

const rolesLogger = createOperationLogger('roles-hook', 'debug');

export const useRoles = (): UseRolesResult => {
  const { refreshSession } = useAuth();
  const [reconcileReport, setReconcileReport] = React.useState<RoleReconcileReport | null>(null);
  const adminList = useIamAdminList(listRoles, refreshSession, {
    invalidateEffectiveAccessOnMutation: true,
  });

  return {
    roles: adminList.items,
    isLoading: adminList.isLoading,
    error: adminList.error,
    mutationError: adminList.mutationError,
    reconcileReport,
    refetch: adminList.refetch,
    clearMutationError: adminList.clearMutationError,
    createRole: (payload) =>
      adminList.runMutation(() => createRole(payload), { operation: 'create_role' }),
    updateRole: (roleId, payload) =>
      adminList.runMutation(() => updateRole(roleId, payload), { operation: 'update_role' }),
    deleteRole: (roleId) =>
      adminList.runMutation(() => deleteRole(roleId), { operation: 'delete_role' }),
    retryRoleSync: (roleId) =>
      adminList.runMutation(() => updateRole(roleId, { retrySync: true }), {
        operation: 'retry_role_sync',
      }),
    reconcile: async () => {
      adminList.setError(null);
      setReconcileReport(null);
      logBrowserOperationStart(rolesLogger, 'roles_reconcile_started', {
        operation: 'reconcile_roles',
      });
      try {
        const response = await reconcileRoles();
        requestEffectiveAccessInvalidation();
        setReconcileReport(response.data);
        await adminList.refetch();
        logBrowserOperationSuccess(rolesLogger, 'roles_reconcile_succeeded', {
          operation: 'reconcile_roles',
        });
        return true;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401) {
          await refreshSession();
          rolesLogger.info('session_refreshed_after_401', {
            operation: 'reconcile_roles',
            status: resolvedError.status,
            error_code: resolvedError.code,
          });
        }
        adminList.setError(resolvedError);
        logBrowserOperationFailure(rolesLogger, 'roles_reconcile_failed', resolvedError, {
          operation: 'reconcile_roles',
        });
        return false;
      }
    },
  };
};
