import type { IamInstanceDetail, IamInstanceListItem } from '@sva/core';
import React from 'react';

import {
  asIamError,
  getInstanceKeycloakStatus,
  getInstance,
  type IamHttpError,
  listInstances,
} from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { useAuth } from '../providers/auth-provider';
import { requestEffectiveAccessInvalidation } from '../providers/effective-access-invalidation';

import { createInstanceWriteActions } from './instance-actions.write';
import { createInstanceStatusActions } from './instance-actions.status';
import { useInstanceAudit } from './use-instance-audit';

type InstanceStatusFilter = IamInstanceListItem['status'] | 'all';

type InstanceFilters = {
  readonly search: string;
  readonly status: InstanceStatusFilter;
};

const instancesLogger = createOperationLogger('instances-hook', 'debug');
export const useInstances = () => {
  const { refreshSession } = useAuth();
  const [filters, setFilters] = React.useState<InstanceFilters>({ search: '', status: 'all' });
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [instances, setInstances] = React.useState<readonly IamInstanceListItem[]>([]);
  const [selectedInstance, setSelectedInstance] = React.useState<IamInstanceDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [statusLoading, setStatusLoading] = React.useState(false);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);

  React.useEffect(() => {
    const timer = globalThis.setTimeout(() => setDebouncedSearch(filters.search.trim()), 250);
    return () => globalThis.clearTimeout(timer);
  }, [filters.search]);

  const updateSelectedForInstance = React.useCallback(
    (instanceId: string, updater: (current: IamInstanceDetail) => IamInstanceDetail) => {
      setSelectedInstance((current) =>
        current?.instanceId === instanceId ? updater(current) : current
      );
    },
    []
  );

  const mergeProvisioningRuns = React.useCallback(
    (
      currentRuns: IamInstanceDetail['keycloakProvisioningRuns'],
      nextRun: IamInstanceDetail['latestKeycloakProvisioningRun']
    ) => {
      if (!nextRun) {
        return currentRuns;
      }

      return [nextRun, ...(currentRuns ?? []).filter((run) => run.id !== nextRun.id)];
    },
    []
  );

  const refreshSessionAfter401 = React.useCallback(
    async (
      input: {
        operation: string;
        status: number;
        errorCode: string;
        instanceId?: string;
      },
      state?: { invalidated: boolean }
    ) => {
      if (state?.invalidated) {
        return;
      }
      if (state) {
        state.invalidated = true;
      }
      await refreshSession();
      instancesLogger.info('session_refreshed_after_401', {
        operation: input.operation,
        status: input.status,
        error_code: input.errorCode,
        instance_id: input.instanceId,
      });
    },
    [refreshSession]
  );

  const refetch = React.useCallback(async () => {
    logBrowserOperationStart(instancesLogger, 'instance_list_refetch_started', {
      operation: 'list_instances',
      search: debouncedSearch || undefined,
      status: filters.status,
    });
    setIsLoading(true);
    setError(null);
    try {
      const response = await listInstances({
        search: debouncedSearch || undefined,
        status: filters.status === 'all' ? undefined : filters.status,
      });
      setInstances(response.data);
      logBrowserOperationSuccess(
        instancesLogger,
        'instance_list_refetch_succeeded',
        {
          operation: 'list_instances',
          item_count: response.data.length,
        },
        'debug'
      );
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 401) {
        await refreshSession();
        instancesLogger.info('session_refreshed_after_401', {
          operation: 'list_instances',
          status: resolvedError.status,
          error_code: resolvedError.code,
        });
      }
      setInstances([]);
      setError(resolvedError);
      logBrowserOperationFailure(instancesLogger, 'instance_list_refetch_failed', resolvedError, {
        operation: 'list_instances',
      });
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, filters.status, refreshSession]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const {
    instancesAuditRun,
    instanceAuditRun,
    auditLoading,
    currentDetailInstanceIdRef,
    setInstanceAuditRun,
    refreshInstanceAudit,
    refreshInstancesAudit,
  } = useInstanceAudit(refreshSession, setMutationError);

  const loadInstance = React.useCallback(
    async (instanceId: string) => {
      if (currentDetailInstanceIdRef.current !== instanceId) {
        setInstanceAuditRun(null);
      }
      currentDetailInstanceIdRef.current = instanceId;
      logBrowserOperationStart(instancesLogger, 'instance_detail_load_started', {
        operation: 'get_instance_detail',
        instance_id: instanceId,
      });
      setDetailLoading(true);
      setMutationError(null);
      const sessionRefreshState = { invalidated: false };
      try {
        let statusError: IamHttpError | undefined;
        const [detailResponse, statusResponse] = await Promise.all([
          getInstance(instanceId),
          getInstanceKeycloakStatus(instanceId).catch(async (cause) => {
            const resolvedError = asIamError(cause);
            if (resolvedError.status === 401) {
              await refreshSessionAfter401(
                {
                  operation: 'get_instance_keycloak_status',
                  status: resolvedError.status,
                  errorCode: resolvedError.code,
                  instanceId,
                },
                sessionRefreshState
              );
            }
            statusError = resolvedError;
            logBrowserOperationFailure(
              instancesLogger,
              'instance_keycloak_status_refresh_failed',
              resolvedError,
              {
                operation: 'get_instance_keycloak_status',
                instance_id: instanceId,
              }
            );
            return null;
          }),
        ]);
        const nextInstance = {
          ...detailResponse.data,
          keycloakStatus: statusResponse?.data ?? detailResponse.data.keycloakStatus,
        };
        setSelectedInstance(nextInstance);
        const nextMutationError = statusError ? statusError : null;
        setMutationError(nextMutationError);
        logBrowserOperationSuccess(instancesLogger, 'instance_detail_load_succeeded', {
          operation: 'get_instance_detail',
          instance_id: instanceId,
          keycloak_status_loaded: statusResponse !== null,
        });
        return nextInstance;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401) {
          await refreshSessionAfter401(
            {
              operation: 'get_instance_detail',
              status: resolvedError.status,
              errorCode: resolvedError.code,
              instanceId,
            },
            sessionRefreshState
          );
        }
        setMutationError(resolvedError);
        logBrowserOperationFailure(instancesLogger, 'instance_detail_load_failed', resolvedError, {
          operation: 'get_instance_detail',
          instance_id: instanceId,
        });
        return null;
      } finally {
        setDetailLoading(false);
      }
    },
    [refreshSessionAfter401]
  );

  const mutate = React.useCallback(
    async <T>(
      action: () => Promise<{ data: T }>,
      instanceId?: string,
      operation = 'instance_mutation',
      options?: { refreshSessionAfterSuccess?: boolean; onError?: (error: IamHttpError) => void }
    ) => {
      setMutationError(null);
      logBrowserOperationStart(instancesLogger, 'instance_mutation_started', {
        operation,
        instance_id: instanceId,
      });
      try {
        const result = await action();
        requestEffectiveAccessInvalidation();
        if (options?.refreshSessionAfterSuccess) {
          await refreshSession();
        }
        await refetch();
        if (instanceId) {
          await loadInstance(instanceId);
          await refreshInstanceAudit(instanceId);
        }
        logBrowserOperationSuccess(instancesLogger, 'instance_mutation_succeeded', {
          operation,
          instance_id: instanceId,
        });
        return result.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401) {
          await refreshSession();
          instancesLogger.info('session_refreshed_after_401', {
            operation,
            status: resolvedError.status,
            error_code: resolvedError.code,
            instance_id: instanceId,
          });
        }
        if (
          operation === 'seed_instance_iam_baseline' &&
          resolvedError.code === 'unknown_module_contract'
        ) {
          requestEffectiveAccessInvalidation();
          await refreshSession();
          await Promise.all([
            refetch(),
            ...(instanceId ? [loadInstance(instanceId), refreshInstanceAudit(instanceId)] : []),
          ]);
        }
        options?.onError?.(resolvedError);
        setMutationError(resolvedError);
        logBrowserOperationFailure(instancesLogger, 'instance_mutation_failed', resolvedError, {
          operation,
          instance_id: instanceId,
        });
        return null;
      }
    },
    [refreshSession, loadInstance, refetch, refreshInstanceAudit]
  );

  return {
    instances,
    selectedInstance,
    instancesAuditRun,
    instanceAuditRun,
    isLoading,
    detailLoading,
    statusLoading,
    auditLoading,
    error,
    mutationError,
    filters,
    setSearch: (value: string) => setFilters((current) => ({ ...current, search: value })),
    setStatus: (value: InstanceStatusFilter) =>
      setFilters((current) => ({ ...current, status: value })),
    refetch,
    loadInstance,
    refreshInstancesAudit,
    refreshInstanceAudit,
    clearSelectedInstance: () => {
      currentDetailInstanceIdRef.current = null;
      setSelectedInstance(null);
      setInstanceAuditRun(null);
    },
    clearMutationError: () => setMutationError(null),
    ...createInstanceWriteActions({ mutate, updateSelectedForInstance, mergeProvisioningRuns }),
    ...createInstanceStatusActions({
      instancesLogger,
      updateSelectedForInstance,
      mergeProvisioningRuns,
      setStatusLoading,
      setMutationError,
      refreshSession,
    }),
  };
};
