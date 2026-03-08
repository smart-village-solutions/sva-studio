import type { IamRoleListItem } from '@sva/core';
import React from 'react';

import {
  asIamError,
  createRole,
  deleteRole,
  IamHttpError,
  listRoles,
  updateRole,
  type CreateRolePayload,
  type UpdateRolePayload,
} from '../lib/iam-api';
import { useAuth } from '../providers/auth-provider';

type UseRolesResult = {
  readonly roles: readonly IamRoleListItem[];
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly createRole: (payload: CreateRolePayload) => Promise<boolean>;
  readonly updateRole: (roleId: string, payload: UpdateRolePayload) => Promise<boolean>;
  readonly deleteRole: (roleId: string) => Promise<boolean>;
};

export const useRoles = (): UseRolesResult => {
  const { invalidatePermissions } = useAuth();

  const [roles, setRoles] = React.useState<readonly IamRoleListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<IamHttpError | null>(null);

  const refetch = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listRoles();
      setRoles(response.data);
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 403) {
        await invalidatePermissions();
      }
      setRoles([]);
      setError(resolvedError);
    } finally {
      setIsLoading(false);
    }
  }, [invalidatePermissions]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const mutate = React.useCallback(
    async (action: () => Promise<unknown>) => {
      setError(null);
      try {
        await action();
        await refetch();
        return true;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        setError(resolvedError);
        return false;
      }
    },
    [invalidatePermissions, refetch]
  );

  return {
    roles,
    isLoading,
    error,
    refetch,
    createRole: (payload) => mutate(() => createRole(payload)),
    updateRole: (roleId, payload) => mutate(() => updateRole(roleId, payload)),
    deleteRole: (roleId) => mutate(() => deleteRole(roleId)),
  };
};
