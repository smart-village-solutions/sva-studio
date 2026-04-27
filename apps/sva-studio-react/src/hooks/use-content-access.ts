import { summarizeContentAccess, withServerDeniedContentAccess, type IamContentAccessSummary, type MePermissionsResponse } from '@sva/core';
import React from 'react';

import { asIamError, fetchWithRequestTimeout, IamHttpError } from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationAbort,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { useAuth } from '../providers/auth-provider';

const contentAccessLogger = createOperationLogger('use-content-access', 'debug');

type UseContentAccessResult = {
  readonly access: IamContentAccessSummary | null;
  readonly permissionActions: readonly string[];
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
};

const buildPermissionsPath = (instanceId: string) => `/iam/me/permissions?${new URLSearchParams({ instanceId }).toString()}`;

export const useContentAccess = (): UseContentAccessResult => {
  const { user, invalidatePermissions } = useAuth();
  const [access, setAccess] = React.useState<IamContentAccessSummary | null>(null);
  const [permissionActions, setPermissionActions] = React.useState<readonly string[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<IamHttpError | null>(null);

  React.useEffect(() => {
    if (!user?.instanceId) {
      setAccess(null);
      setPermissionActions([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    logBrowserOperationStart(contentAccessLogger, 'content_access_load_started', {
      operation: 'load_content_access',
      instance_id: user.instanceId,
    });
    setIsLoading(true);
    setError(null);

    void fetchWithRequestTimeout(buildPermissionsPath(user.instanceId), undefined, {
      signal: controller.signal,
      timeoutMs: 10_000,
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
          setPermissionActions(
            [...new Set(payload.permissions.filter((permission) => permission.effect !== 'deny').map((permission) => permission.action))]
              .filter(Boolean)
              .sort((left, right) => left.localeCompare(right))
          );
          logBrowserOperationSuccess(contentAccessLogger, 'content_access_load_succeeded', {
            operation: 'load_content_access',
            instance_id: user.instanceId,
            permission_count: payload.permissions.length,
          }, 'debug');
        }
      })
      .catch(async (cause) => {
        if (controller.signal.aborted) {
          logBrowserOperationAbort(contentAccessLogger, 'content_access_load_aborted', {
            operation: 'load_content_access',
            instance_id: user.instanceId,
          });
          return;
        }

        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
          logBrowserOperationSuccess(contentAccessLogger, 'permission_invalidated_after_403', {
            operation: 'load_content_access',
            instance_id: user.instanceId,
            status: resolvedError.status,
            error_code: resolvedError.code,
          }, 'debug');
          setAccess(withServerDeniedContentAccess(undefined));
          setPermissionActions([]);
        }
        logBrowserOperationFailure(contentAccessLogger, 'content_access_load_failed', resolvedError, {
          operation: 'load_content_access',
          instance_id: user.instanceId,
          status: resolvedError.status,
          error_code: resolvedError.code,
        });
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
    permissionActions,
    isLoading,
    error,
  };
};
