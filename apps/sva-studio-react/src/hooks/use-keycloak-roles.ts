import type { IamKeycloakRealmRole } from '@sva/core';
import React from 'react';

import { listKeycloakRoles, type IamHttpError } from '../lib/iam-api';
import { useAuth } from '../providers/auth-provider';
import { useIamAdminList } from './use-iam-admin-list';

export const useKeycloakRoles = (
  enabled: boolean
): Readonly<{
  roles: readonly IamKeycloakRealmRole[];
  isLoading: boolean;
  error: IamHttpError | null;
  refetch: () => Promise<void>;
}> => {
  const { refreshSession } = useAuth();
  const list = useIamAdminList(listKeycloakRoles, refreshSession, { enabled });
  const [hasStartedEnabledLoad, setHasStartedEnabledLoad] = React.useState(false);

  React.useEffect(() => {
    setHasStartedEnabledLoad(enabled);
  }, [enabled]);

  return {
    roles: list.items,
    isLoading: enabled && (list.isLoading || !hasStartedEnabledLoad),
    error: list.error,
    refetch: list.refetch,
  };
};
