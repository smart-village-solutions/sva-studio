import type { IamUserDetail } from '@sva/core';
import React from 'react';

import { getUser, IamHttpError, updateUser, type UpdateUserPayload } from '../lib/iam-api';
import { useAuth } from '../providers/auth-provider';

const asIamError = (error: unknown) =>
  error instanceof IamHttpError
    ? error
    : new IamHttpError({
        status: 500,
        code: 'internal_error',
        message: error instanceof Error ? error.message : String(error),
      });

type UseUserResult = {
  readonly user: IamUserDetail | null;
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly save: (payload: UpdateUserPayload) => Promise<IamUserDetail | null>;
};

export const useUser = (userId: string): UseUserResult => {
  const { invalidatePermissions } = useAuth();
  const [user, setUser] = React.useState<IamUserDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<IamHttpError | null>(null);

  const refetch = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getUser(userId);
      setUser(response.data);
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 403) {
        await invalidatePermissions();
      }
      setUser(null);
      setError(resolvedError);
    } finally {
      setIsLoading(false);
    }
  }, [invalidatePermissions, userId]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const save = React.useCallback(
    async (payload: UpdateUserPayload) => {
      setError(null);
      try {
        const response = await updateUser(userId, payload);
        setUser(response.data);
        return response.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        setError(resolvedError);
        return null;
      }
    },
    [invalidatePermissions, userId]
  );

  return {
    user,
    isLoading,
    error,
    refetch,
    save,
  };
};
