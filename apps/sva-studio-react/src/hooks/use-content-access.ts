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
import { requestSingleFlight } from '../lib/request-singleflight';
import { useAuth } from '../providers/auth-provider';
import { useOrganizationContext } from './use-organization-context';

const contentAccessLogger = createOperationLogger('use-content-access', 'debug');

type UseContentAccessResult = {
  readonly access: IamContentAccessSummary | null;
  readonly permissionActions: readonly string[];
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
};

const collectEffectivePermissionActions = (permissions: MePermissionsResponse['permissions']): readonly string[] => {
  const deniedActions = new Set(
    permissions
      .filter((permission) => permission.effect === 'deny')
      .map((permission) => permission.action)
      .filter((action): action is string => typeof action === 'string' && action.length > 0)
  );

  return [...new Set(
    permissions
      .filter((permission) => permission.effect !== 'deny')
      .map((permission) => permission.action)
      .filter((action): action is string => typeof action === 'string' && action.length > 0)
      .filter((action) => !deniedActions.has(action))
  )].sort((left, right) => left.localeCompare(right));
};

const buildPermissionsPath = (instanceId: string, organizationId?: string) => {
  const searchParams = new URLSearchParams({ instanceId });
  if (organizationId) {
    searchParams.set('organizationId', organizationId);
  }
  return `/iam/me/permissions?${searchParams.toString()}`;
};

export const useContentAccess = (): UseContentAccessResult => {
  const { user, invalidatePermissions } = useAuth();
  const organizationContext = useOrganizationContext();
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

    let isActive = true;
    logBrowserOperationStart(contentAccessLogger, 'content_access_load_started', {
      operation: 'load_content_access',
      instance_id: user.instanceId,
    });
    setIsLoading(true);
    setError(null);

    const permissionsPath = buildPermissionsPath(user.instanceId, organizationContext.context?.activeOrganizationId ?? undefined);

    void requestSingleFlight(`iam:permissions:${permissionsPath}`, async () => {
      const response = await fetchWithRequestTimeout(permissionsPath, undefined, { timeoutMs: 10_000 });
        if (!response.ok) {
          throw asIamError({
            status: response.status,
            code: response.status === 403 ? 'forbidden' : `http_${response.status}`,
            message: `http_${response.status}`,
          });
        }

        return (await response.json()) as MePermissionsResponse;
      })
      .then((payload) => {
        if (isActive) {
          setAccess(summarizeContentAccess(payload.permissions));
          setPermissionActions(collectEffectivePermissionActions(payload.permissions));
          logBrowserOperationSuccess(contentAccessLogger, 'content_access_load_succeeded', {
            operation: 'load_content_access',
            instance_id: user.instanceId,
            permission_count: payload.permissions.length,
          }, 'debug');
        }
      })
      .catch(async (cause) => {
        if (!isActive) {
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
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [invalidatePermissions, organizationContext.context?.activeOrganizationId, user?.instanceId]);

  return {
    access,
    permissionActions,
    isLoading,
    error,
  };
};
