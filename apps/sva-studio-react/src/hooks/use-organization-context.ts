import type { IamOrganizationContext } from '@sva/core';
import React from 'react';

import { asIamError, getMyOrganizationContext, IamHttpError, updateMyOrganizationContext } from '../lib/iam-api';
import { useAuth } from '../providers/auth-provider';

type UseOrganizationContextResult = {
  readonly context: IamOrganizationContext | null;
  readonly isLoading: boolean;
  readonly isUpdating: boolean;
  readonly error: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly switchOrganization: (organizationId: string) => Promise<boolean>;
};

export const useOrganizationContext = (): UseOrganizationContextResult => {
  const { isAuthenticated, invalidatePermissions } = useAuth();
  const [context, setContext] = React.useState<IamOrganizationContext | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [error, setError] = React.useState<IamHttpError | null>(null);

  const loadContext = React.useCallback(async () => {
    if (!isAuthenticated) {
      setContext(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await getMyOrganizationContext();
      setContext(response.data);
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 403) {
        await invalidatePermissions();
      }
      setContext(null);
      setError(resolvedError);
    } finally {
      setIsLoading(false);
    }
  }, [invalidatePermissions, isAuthenticated]);

  React.useEffect(() => {
    void loadContext();
  }, [loadContext]);

  return {
    context,
    isLoading,
    isUpdating,
    error,
    refetch: loadContext,
    switchOrganization: async (organizationId) => {
      setIsUpdating(true);
      setError(null);
      try {
        const response = await updateMyOrganizationContext(organizationId);
        setContext(response.data);
        await invalidatePermissions();
        return true;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        setError(resolvedError);
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
  };
};
