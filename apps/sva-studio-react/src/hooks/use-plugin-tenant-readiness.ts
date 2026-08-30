import type {
  PluginTenantLifecycleOperation,
  PluginTenantReadinessReadModel,
} from '@sva/plugin-sdk';
import React from 'react';

import {
  asIamError,
  getInstancePluginReadiness,
  IamHttpError,
  startInstancePluginLifecycle,
} from '../lib/iam-api';

const activeJobPollingIntervalMs = 10_000;

export const usePluginTenantReadiness = (instanceId: string) => {
  const [items, setItems] = React.useState<readonly PluginTenantReadinessReadModel[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeAction, setActiveAction] = React.useState<string | null>(null);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const requestSequence = React.useRef(0);
  const currentInstanceId = React.useRef(instanceId);
  currentInstanceId.current = instanceId;

  const refresh = React.useCallback(async () => {
    const sequence = ++requestSequence.current;
    setIsLoading(true);
    setError(null);
    try {
      const response = await getInstancePluginReadiness(instanceId);
      if (sequence === requestSequence.current && currentInstanceId.current === instanceId) {
        setItems(response.data);
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
    void refresh();
    return () => {
      requestSequence.current += 1;
    };
  }, [refresh]);

  const hasActiveJob = items.some((item) => Boolean(item.activeJobId));

  React.useEffect(() => {
    if (!hasActiveJob) {
      return;
    }

    const interval = window.setInterval(() => {
      void refresh();
    }, activeJobPollingIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [hasActiveJob, refresh]);

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
