import type {
  PluginTenantLifecycleOperation,
  PluginTenantReadinessReadModel,
} from '@sva/plugin-sdk';
import { evaluatePluginTenantAccess } from '@sva/plugin-sdk';
import React from 'react';

import {
  asIamError,
  getInstancePluginReadiness,
  IamHttpError,
  startInstancePluginLifecycle,
} from '../lib/iam-api';
import { useAuth } from '../providers/auth-provider';

const readinessPollingIntervalMs = 10_000;

export const usePluginTenantReadiness = (instanceId: string) => {
  const { refreshSession, user } = useAuth();
  const [items, setItems] = React.useState<readonly PluginTenantReadinessReadModel[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeAction, setActiveAction] = React.useState<string | null>(null);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const requestSequence = React.useRef(0);
  const currentInstanceId = React.useRef(instanceId);
  const accessFingerprint = React.useRef<string | null>(null);
  const authenticatedInstanceId = React.useRef(user?.instanceId);
  const refreshAuthSession = React.useRef(refreshSession);
  currentInstanceId.current = instanceId;
  authenticatedInstanceId.current = user?.instanceId;
  refreshAuthSession.current = refreshSession;

  const refresh = React.useCallback(async () => {
    const sequence = ++requestSequence.current;
    setIsLoading(true);
    setError(null);
    try {
      const response = await getInstancePluginReadiness(instanceId);
      if (sequence === requestSequence.current && currentInstanceId.current === instanceId) {
        const nextAccessFingerprint = response.data
          .map(
            (item) =>
              `${item.pluginId}:${evaluatePluginTenantAccess(item).allowed ? 'allowed' : 'denied'}`
          )
          .sort()
          .join('\u0000');
        const shouldRefreshAuthSnapshot =
          authenticatedInstanceId.current === instanceId &&
          accessFingerprint.current !== nextAccessFingerprint;
        accessFingerprint.current = nextAccessFingerprint;
        setItems(response.data);
        if (shouldRefreshAuthSnapshot) {
          await refreshAuthSession.current();
        }
      }
    } catch (cause) {
      if (sequence === requestSequence.current && currentInstanceId.current === instanceId) {
        setError(asIamError(cause));
      }
    } finally {
      if (sequence === requestSequence.current && currentInstanceId.current === instanceId) {
        setIsLoading(false);
      }
    }
  }, [instanceId]);

  React.useEffect(() => {
    setItems([]);
    setActiveAction(null);
    accessFingerprint.current = null;
    void refresh();
    return () => {
      requestSequence.current += 1;
    };
  }, [refresh]);

  const hasPendingLifecycleWork = items.some(
    (item) =>
      item.status === 'pending' ||
      Boolean(item.activeJobId) ||
      (item.error?.retryKind === 'retryable' &&
        Boolean(item.error.retryAfter) &&
        Number.isFinite(Date.parse(item.error.retryAfter ?? '')))
  );

  React.useEffect(() => {
    if (!hasPendingLifecycleWork) {
      return;
    }

    const interval = window.setInterval(() => {
      void refresh();
    }, readinessPollingIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [hasPendingLifecycleWork, refresh]);

  const startRepair = React.useCallback(
    async (pluginId: string, operation: PluginTenantLifecycleOperation) => {
      const action = `${pluginId}:${operation}`;
      setActiveAction(action);
      setError(null);
      try {
        await startInstancePluginLifecycle(instanceId, pluginId, operation);
        if (currentInstanceId.current === instanceId) {
          await refresh();
        }
      } catch (cause) {
        if (currentInstanceId.current === instanceId) {
          setError(asIamError(cause));
        }
      } finally {
        if (currentInstanceId.current === instanceId) {
          setActiveAction(null);
        }
      }
    },
    [instanceId, refresh]
  );

  return { items, isLoading, activeAction, error, refresh, startRepair } as const;
};
