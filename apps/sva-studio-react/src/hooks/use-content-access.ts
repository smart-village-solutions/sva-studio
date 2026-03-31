import { summarizeContentAccess, withServerDeniedContentAccess, type IamContentAccessSummary, type MePermissionsResponse } from '@sva/core';
import React from 'react';

import { asIamError, IamHttpError } from '../lib/iam-api';
import { useAuth } from '../providers/auth-provider';

type UseContentAccessResult = {
  readonly access: IamContentAccessSummary | null;
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
};

const buildPermissionsPath = (instanceId: string) => `/iam/me/permissions?${new URLSearchParams({ instanceId }).toString()}`;

export const useContentAccess = (): UseContentAccessResult => {
  const { user, invalidatePermissions } = useAuth();
  const [access, setAccess] = React.useState<IamContentAccessSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<IamHttpError | null>(null);

  React.useEffect(() => {
    if (!user?.instanceId) {
      setAccess(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    void fetch(buildPermissionsPath(user.instanceId), {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw asIamError({
            status: response.status,
            code: response.status === 403 ? 'forbidden' : `http_${response.status}`,
            message: `http_${response.status}`,
          });
        }

        const payload = (await response.json()) as MePermissionsResponse;
        if (!controller.signal.aborted) {
          setAccess(summarizeContentAccess(payload.permissions));
        }
      })
      .catch(async (cause) => {
        if (controller.signal.aborted) {
          return;
        }

        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
          setAccess(withServerDeniedContentAccess(undefined));
        }
        setError(resolvedError);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [invalidatePermissions, user?.instanceId]);

  return {
    access,
    isLoading,
    error,
  };
};
