import type { IamOrganizationContext } from '@sva/core';
import React from 'react';

import { asIamError, getMyOrganizationContext, IamHttpError, updateMyOrganizationContext } from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { useAuth } from '../providers/auth-provider';

export type OrganizationContextValue = {
  readonly context: IamOrganizationContext | null;
  readonly isLoading: boolean;
  readonly isUpdating: boolean;
  readonly error: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly switchOrganization: (organizationId: string) => Promise<boolean>;
};

const OrganizationContext = React.createContext<OrganizationContextValue | null>(null);

const organizationContextLogger = createOperationLogger('organization-context-hook', 'debug');
export const OrganizationContextProvider = ({ children }: Readonly<{ children: React.ReactNode }>) => {
  const { isAuthenticated, user } = useAuth();
  const [context, setContext] = React.useState<IamOrganizationContext | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [error, setError] = React.useState<IamHttpError | null>(null);

  const loadContext = React.useCallback(async () => {
    if (!isAuthenticated || !user?.instanceId) {
      setContext(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    logBrowserOperationStart(organizationContextLogger, 'organization_context_load_started', {
      operation: 'get_my_organization_context',
    });
    setIsLoading(true);
    setError(null);
    try {
      const response = await getMyOrganizationContext();
      setContext(response.data);
      logBrowserOperationSuccess(organizationContextLogger, 'organization_context_load_succeeded', {
        operation: 'get_my_organization_context',
        organization_id: response.data.activeOrganizationId,
      });
    } catch (cause) {
      const resolvedError = asIamError(cause);
      setContext(null);
      setError(resolvedError);
      logBrowserOperationFailure(organizationContextLogger, 'organization_context_load_failed', resolvedError, {
        operation: 'get_my_organization_context',
      });
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.instanceId]);

  React.useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const value = React.useMemo<OrganizationContextValue>(() => ({
    context,
    isLoading,
    isUpdating,
    error,
    refetch: loadContext,
    switchOrganization: async (organizationId) => {
      if (!user?.instanceId) {
        setContext(null);
        setError(null);
        setIsUpdating(false);
        return false;
      }

      logBrowserOperationStart(organizationContextLogger, 'organization_context_switch_started', {
        operation: 'update_my_organization_context',
        organization_id: organizationId,
      });
      setIsUpdating(true);
      setError(null);
      try {
        const response = await updateMyOrganizationContext(organizationId);
        setContext(response.data);
        logBrowserOperationSuccess(organizationContextLogger, 'organization_context_switch_succeeded', {
          operation: 'update_my_organization_context',
          organization_id: organizationId,
        });
        return true;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        setError(resolvedError);
        logBrowserOperationFailure(organizationContextLogger, 'organization_context_switch_failed', resolvedError, {
          operation: 'update_my_organization_context',
          organization_id: organizationId,
        });
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
  }), [context, error, isLoading, isUpdating, loadContext, user?.instanceId]);

  return React.createElement(OrganizationContext.Provider, { value }, children);
};

export const useOrganizationContext = (): OrganizationContextValue => {
  const context = React.useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganizationContext must be used within OrganizationContextProvider');
  }
  return context;
};
