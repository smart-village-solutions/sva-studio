import type { IamOrganizationContext } from '@sva/core';
import React from 'react';

import {
  asIamError,
  getMyOrganizationContext,
  IamHttpError,
  updateMyOrganizationContext,
} from '../lib/iam-api';
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
  readonly switchOrganization: (organizationId: string | null) => Promise<boolean>;
};

const OrganizationContext = React.createContext<OrganizationContextValue | null>(null);

const organizationContextLogger = createOperationLogger('organization-context-hook', 'debug');
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;
const readBackAmbiguousOrganizationSwitch = async (
  cause: unknown
): Promise<IamOrganizationContext | null> => {
  if (cause instanceof IamHttpError && cause.status < 500) return null;
  try {
    return (await getMyOrganizationContext({ fresh: true })).data;
  } catch {
    return null;
  }
};
const logOrganizationSwitchFailure = (error: IamHttpError, organizationId: string | null): void => {
  logBrowserOperationFailure(
    organizationContextLogger,
    'organization_context_switch_failed',
    error,
    { operation: 'update_my_organization_context', organization_id: organizationId }
  );
};
type OrganizationSnapshot = {
  readonly identityKey: string;
  readonly value: IamOrganizationContext;
};

export const OrganizationContextProvider = ({
  children,
}: Readonly<{ children: React.ReactNode }>) => {
  const { isAuthenticated, user } = useAuth();
  const identityKey =
    isAuthenticated && user?.id && user.instanceId ? `${user.id}:${user.instanceId}` : null;
  const [contextSnapshot, setContextSnapshot] = React.useState<OrganizationSnapshot | null>(null);
  const [errorSnapshot, setErrorSnapshot] = React.useState<{
    readonly identityKey: string;
    readonly value: IamHttpError;
  } | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const operationQueue = React.useRef<Promise<void>>(Promise.resolve());
  const requestSequence = React.useRef(0);
  const currentIdentity = React.useRef(identityKey);

  const enqueue = React.useCallback(<T,>(work: () => Promise<T>): Promise<T> => {
    const pending = operationQueue.current.then(work, work);
    operationQueue.current = pending.then(
      () => undefined,
      () => undefined
    );
    return pending;
  }, []);

  const publishIfCurrent = React.useCallback(
    (capturedIdentity: string, sequence: number, publish: () => void): boolean => {
      if (
        currentIdentity.current !== capturedIdentity ||
        requestSequence.current !== sequence
      ) {
        return false;
      }
      publish();
      return true;
    },
    []
  );

  const loadContext = React.useCallback(async () => {
    if (!identityKey) {
      setIsLoading(false);
      setContextSnapshot(null);
      setErrorSnapshot(null);
      return;
    }

    if (currentIdentity.current !== identityKey) return;
    const sequence = ++requestSequence.current;
    logBrowserOperationStart(organizationContextLogger, 'organization_context_load_started', {
      operation: 'get_my_organization_context',
    });
    setIsLoading(true);
    setErrorSnapshot(null);
    try {
      const response = await getMyOrganizationContext();
      publishIfCurrent(identityKey, sequence, () => {
        setContextSnapshot({ identityKey, value: response.data });
        logBrowserOperationSuccess(
          organizationContextLogger,
          'organization_context_load_succeeded',
          {
            operation: 'get_my_organization_context',
            organization_id: response.data.activeOrganizationId,
          }
        );
      });
    } catch (cause) {
      const resolvedError = asIamError(cause);
      publishIfCurrent(identityKey, sequence, () => {
        setContextSnapshot(null);
        setErrorSnapshot({ identityKey, value: resolvedError });
        logBrowserOperationFailure(
          organizationContextLogger,
          'organization_context_load_failed',
          resolvedError,
          { operation: 'get_my_organization_context' }
        );
      });
    } finally {
      publishIfCurrent(identityKey, sequence, () => setIsLoading(false));
    }
  }, [identityKey, publishIfCurrent]);

  useIsomorphicLayoutEffect(() => {
    currentIdentity.current = identityKey;
    requestSequence.current += 1;
    setIsUpdating(false);
    setIsLoading(Boolean(identityKey));
  }, [identityKey]);

  React.useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const switchOrganization = React.useCallback(
    async (organizationId: string | null): Promise<boolean> => {
      if (!identityKey) {
        setContextSnapshot(null);
        setErrorSnapshot(null);
        setIsUpdating(false);
        return false;
      }

      return enqueue(async () => {
        if (currentIdentity.current !== identityKey) return false;
        const sequence = ++requestSequence.current;
        logBrowserOperationStart(
          organizationContextLogger,
          'organization_context_switch_started',
          {
            operation: 'update_my_organization_context',
            organization_id: organizationId,
          }
        );
        setIsUpdating(true);
        setErrorSnapshot(null);
        try {
          const response = await updateMyOrganizationContext(organizationId);
          return publishIfCurrent(identityKey, sequence, () => {
            setContextSnapshot({ identityKey, value: response.data });
            logBrowserOperationSuccess(
              organizationContextLogger,
              'organization_context_switch_succeeded',
              {
                operation: 'update_my_organization_context',
                organization_id: response.data.activeOrganizationId,
              }
            );
          });
        } catch (cause) {
          const resolvedError = asIamError(cause);
          const confirmedContext = await readBackAmbiguousOrganizationSwitch(cause);
          if (!publishIfCurrent(identityKey, sequence, () => {})) return false;
          if (confirmedContext) {
            setContextSnapshot({ identityKey, value: confirmedContext });
            if ((confirmedContext.activeOrganizationId ?? null) === organizationId) {
              logBrowserOperationSuccess(
                organizationContextLogger,
                'organization_context_switch_succeeded',
                {
                  operation: 'update_my_organization_context',
                  organization_id: confirmedContext.activeOrganizationId,
                }
              );
              return true;
            }
          }
          setErrorSnapshot({ identityKey, value: resolvedError });
          logOrganizationSwitchFailure(resolvedError, organizationId);
          return false;
        } finally {
          publishIfCurrent(identityKey, sequence, () => setIsUpdating(false));
        }
      });
    },
    [enqueue, identityKey, publishIfCurrent]
  );

  const context =
    contextSnapshot?.identityKey === identityKey ? contextSnapshot.value : null;
  const error = errorSnapshot?.identityKey === identityKey ? errorSnapshot.value : null;
  const value = React.useMemo<OrganizationContextValue>(
    () => ({
      context,
      isLoading,
      isUpdating,
      error,
      refetch: loadContext,
      switchOrganization,
    }),
    [context, error, isLoading, isUpdating, loadContext, switchOrganization]
  );

  return React.createElement(OrganizationContext.Provider, { value }, children);
};

export const useOrganizationContext = (): OrganizationContextValue => {
  const context = React.useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganizationContext must be used within OrganizationContextProvider');
  }
  return context;
};
