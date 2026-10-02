import type { AuthorizeResponse, EffectivePermission } from '@sva/iam-core';

import React from 'react';

import { fetchWithRequestTimeout } from '../../lib/iam-api';

import {
  logBrowserOperationAbort,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../../lib/browser-operation-logging';

import { type IamCockpitTabKey } from '../../lib/iam-viewer-access';

import { t } from '../../i18n';

import type { IamApiErrorPayload } from './-iam-page-shared';
import {
  FILTER_REQUEST_DEBOUNCE_MS,
  buildPermissionsPath,
  buildSelectOptions,
  iamViewerLogger,
} from './-iam-page-shared';
import {
  filterPermissions,
  mapAuthorizeDecision,
  type AuthorizeDecisionViewModel,
  type IamPermissionsResponse,
} from './-iam.models';

const collectOrganizationOptions = (permissions: readonly EffectivePermission[]) => {
  const organizationIds = new Set<string>();
  for (const permission of permissions) {
    organizationIds.add(permission.organizationId ?? '');
  }
  return [...organizationIds];
};

const usePermissionsState = ({
  activeTab,
  allowedTabs,
  canAccessCockpit,
  cockpitEnabled,
  instanceId,
  refreshSession,
}: Readonly<{
  activeTab: IamCockpitTabKey;
  allowedTabs: readonly IamCockpitTabKey[];
  canAccessCockpit: boolean;
  cockpitEnabled: boolean;
  instanceId: string;
  refreshSession: () => Promise<void>;
}>) => {
  const [organizationId, setOrganizationId] = React.useState('');
  const [actingAsUserId, setActingAsUserId] = React.useState('');
  const [queryText, setQueryText] = React.useState('');
  const [selectedOrganizationIds, setSelectedOrganizationIds] = React.useState<string[]>([]);
  const [permissions, setPermissions] = React.useState<readonly EffectivePermission[]>([]);
  const [permissionSubject, setPermissionSubject] = React.useState<
    IamPermissionsResponse['subject'] | null
  >(null);
  const [isLoadingPermissions, setIsLoadingPermissions] = React.useState(false);
  const [permissionsError, setPermissionsError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (
      !cockpitEnabled ||
      !canAccessCockpit ||
      !instanceId ||
      activeTab !== 'rights' ||
      !allowedTabs.includes('rights')
    ) {
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      logBrowserOperationStart(iamViewerLogger, 'iam_permissions_load_started', {
        operation: 'load_permissions',
        instance_id: instanceId,
        organization_id: organizationId.trim() || undefined,
        acting_as_user_id: actingAsUserId.trim() || undefined,
      });
      setIsLoadingPermissions(true);
      setPermissionsError(null);

      try {
        const response = await fetchWithRequestTimeout(
          buildPermissionsPath({
            instanceId,
            organizationId: organizationId.trim() || undefined,
            actingAsUserId: actingAsUserId.trim() || undefined,
          }),
          undefined,
          {
            signal: controller.signal,
            timeoutMs: 10_000,
          }
        );

        if (!active || controller.signal.aborted) {
          return;
        }

        if (!response.ok) {
          if (response.status === 401) {
            await refreshSession();
            iamViewerLogger.info('session_refreshed_after_401', {
              operation: 'load_permissions',
              status: response.status,
            });
          }
          const payload = (await response.json().catch(() => null)) as IamApiErrorPayload | null;
          setPermissions([]);
          setPermissionSubject(null);
          setPermissionsError(payload?.error ?? `http_${response.status}`);
          logBrowserOperationFailure(
            iamViewerLogger,
            'iam_permissions_load_failed',
            new Error(payload?.error ?? `http_${response.status}`),
            {
              operation: 'load_permissions',
              instance_id: instanceId,
              status: response.status,
            }
          );
          return;
        }

        const payload = (await response.json()) as IamPermissionsResponse;
        setPermissions(payload.permissions);
        setPermissionSubject(payload.subject);
        logBrowserOperationSuccess(
          iamViewerLogger,
          'iam_permissions_load_succeeded',
          {
            operation: 'load_permissions',
            instance_id: instanceId,
            permission_count: payload.permissions.length,
          },
          'debug'
        );
      } catch (error) {
        if (!active || controller.signal.aborted) {
          logBrowserOperationAbort(iamViewerLogger, 'iam_permissions_load_aborted', {
            operation: 'load_permissions',
            instance_id: instanceId,
          });
          return;
        }
        setPermissions([]);
        setPermissionSubject(null);
        setPermissionsError(error instanceof Error ? error.message : String(error));
        logBrowserOperationFailure(iamViewerLogger, 'iam_permissions_load_failed', error, {
          operation: 'load_permissions',
          instance_id: instanceId,
        });
      } finally {
        if (active) {
          setIsLoadingPermissions(false);
        }
      }
    }, FILTER_REQUEST_DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    actingAsUserId,
    activeTab,
    allowedTabs,
    canAccessCockpit,
    cockpitEnabled,
    instanceId,
    refreshSession,
    organizationId,
  ]);

  const filteredPermissions = React.useMemo(
    () =>
      filterPermissions(permissions, {
        query: queryText,
        organizationIds: selectedOrganizationIds,
      }),
    [permissions, queryText, selectedOrganizationIds]
  );
  const organizationOptions = React.useMemo(
    () => collectOrganizationOptions(permissions),
    [permissions]
  );
  const handleOrganizationFilterToggle = (organizationValue: string) => {
    setSelectedOrganizationIds((current) =>
      current.includes(organizationValue)
        ? current.filter((entry) => entry !== organizationValue)
        : [...current, organizationValue]
    );
  };

  return {
    actingAsUserId,
    filteredPermissions,
    handleOrganizationFilterToggle,
    isLoadingPermissions,
    organizationId,
    organizationOptions,
    permissionSubject,
    permissionsError,
    queryText,
    selectedOrganizationIds,
    setActingAsUserId,
    setOrganizationId,
    setQueryText,
  };
};

const useAuthorizeState = ({
  actingAsUserId,
  instanceId,
  organizationId,
  refreshSession,
}: Readonly<{
  actingAsUserId: string;
  instanceId: string;
  organizationId: string;
  refreshSession: () => Promise<void>;
}>) => {
  const [authorizeAction, setAuthorizeAction] = React.useState('content.read');
  const [authorizeResourceType, setAuthorizeResourceType] = React.useState('content');
  const [authorizeResourceId, setAuthorizeResourceId] = React.useState('');
  const [authorizeOrganizationId, setAuthorizeOrganizationId] = React.useState('');
  const [authorizeDecision, setAuthorizeDecision] =
    React.useState<AuthorizeDecisionViewModel | null>(null);
  const [authorizeError, setAuthorizeError] = React.useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = React.useState(false);

  const handleAuthorizeSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!instanceId) {
      setAuthorizeError(t('admin.iam.rights.authorize.instanceRequired'));
      return;
    }

    setIsAuthorizing(true);
    setAuthorizeError(null);
    logBrowserOperationStart(iamViewerLogger, 'iam_authorize_started', {
      operation: 'authorize',
      instance_id: instanceId,
      resource_type: authorizeResourceType.trim(),
    });

    try {
      const response = await fetchWithRequestTimeout(
        '/iam/authorize',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceId,
            action: authorizeAction.trim(),
            resource: {
              type: authorizeResourceType.trim(),
              id: authorizeResourceId.trim() || undefined,
              organizationId: authorizeOrganizationId.trim() || organizationId.trim() || undefined,
            },
            context: {
              organizationId: authorizeOrganizationId.trim() || organizationId.trim() || undefined,
              actingAsUserId: actingAsUserId.trim() || undefined,
              requestId: `iam-viewer-${Date.now()}`,
            },
          }),
        },
        {
          timeoutMs: 10_000,
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          await refreshSession();
          iamViewerLogger.info('session_refreshed_after_401', {
            operation: 'authorize',
            status: response.status,
          });
        }
        const payload = (await response.json().catch(() => null)) as IamApiErrorPayload | null;
        setAuthorizeDecision(null);
        setAuthorizeError(payload?.error ?? `http_${response.status}`);
        logBrowserOperationFailure(
          iamViewerLogger,
          'iam_authorize_failed',
          new Error(payload?.error ?? `http_${response.status}`),
          {
            operation: 'authorize',
            instance_id: instanceId,
            status: response.status,
          }
        );
        return;
      }

      const payload = (await response.json()) as AuthorizeResponse;
      setAuthorizeDecision(mapAuthorizeDecision(payload));
      logBrowserOperationSuccess(iamViewerLogger, 'iam_authorize_succeeded', {
        operation: 'authorize',
        instance_id: instanceId,
        allowed: payload.allowed,
      });
    } catch (error) {
      setAuthorizeDecision(null);
      setAuthorizeError(error instanceof Error ? error.message : String(error));
      logBrowserOperationFailure(iamViewerLogger, 'iam_authorize_failed', error, {
        operation: 'authorize',
        instance_id: instanceId,
      });
    } finally {
      setIsAuthorizing(false);
    }
  };

  return {
    authorizeAction,
    authorizeDecision,
    authorizeError,
    authorizeOrganizationId,
    authorizeResourceId,
    authorizeResourceType,
    handleAuthorizeSubmit,
    isAuthorizing,
    setAuthorizeAction,
    setAuthorizeOrganizationId,
    setAuthorizeResourceId,
    setAuthorizeResourceType,
  };
};

export const useRightsTabState = ({
  activeTab,
  allowedTabs,
  canAccessCockpit,
  cockpitEnabled,
  instanceId,
  refreshSession,
}: Readonly<{
  activeTab: IamCockpitTabKey;
  allowedTabs: readonly IamCockpitTabKey[];
  canAccessCockpit: boolean;
  cockpitEnabled: boolean;
  instanceId: string;
  refreshSession: () => Promise<void>;
}>) => {
  const permissionsState = usePermissionsState({
    activeTab,
    allowedTabs,
    canAccessCockpit,
    cockpitEnabled,
    instanceId,
    refreshSession,
  });
  const authorizeState = useAuthorizeState({
    actingAsUserId: permissionsState.actingAsUserId,
    instanceId,
    organizationId: permissionsState.organizationId,
    refreshSession,
  });
  const { organizationId, organizationOptions } = permissionsState;
  const { authorizeOrganizationId } = authorizeState;
  const organizationSelectOptions = React.useMemo(
    () => buildSelectOptions([...organizationOptions, organizationId, authorizeOrganizationId]),
    [authorizeOrganizationId, organizationId, organizationOptions]
  );

  return { ...permissionsState, ...authorizeState, organizationSelectOptions };
};
