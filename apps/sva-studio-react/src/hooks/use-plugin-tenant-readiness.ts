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

export const usePluginTenantReadiness = (instanceId: string) => {
  const [items, setItems] = React.useState<readonly PluginTenantReadinessReadModel[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeAction, setActiveAction] = React.useState<string | null>(null);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const requestSequence = React.useRef(0);

  const refresh = React.useCallback(async () => {
    const sequence = ++requestSequence.current;
    setIsLoading(true);
    setError(null);
    try {
      const response = await getInstancePluginReadiness(instanceId);
      if (sequence === requestSequence.current) {
        setItems(response.data);
      }
    } catch (cause) {
      if (sequence === requestSequence.current) {
        setError(asIamError(cause));
      }
    } finally {
      if (sequence === requestSequence.current) {
        setIsLoading(false);
      }
    }
  }, [instanceId]);

  React.useEffect(() => {
    setItems([]);
    void refresh();
    return () => {
      requestSequence.current += 1;
    };
  }, [refresh]);

  const startRepair = React.useCallback(
    async (pluginId: string, operation: PluginTenantLifecycleOperation) => {
      const action = `${pluginId}:${operation}`;
      setActiveAction(action);
      setError(null);
      try {
        await startInstancePluginLifecycle(instanceId, pluginId, operation);
        await refresh();
      } catch (cause) {
        setError(asIamError(cause));
      } finally {
        setActiveAction(null);
      }
    },
    [instanceId, refresh]
  );

  return { items, isLoading, activeAction, error, refresh, startRepair } as const;
};
