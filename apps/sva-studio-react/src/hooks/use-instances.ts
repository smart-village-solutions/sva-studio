import type { IamInstanceDetail, IamInstanceListItem } from '@sva/core';
import React from 'react';

import {
  activateInstance,
  archiveInstance,
  asIamError,
  createInstance,
  getInstanceKeycloakStatus,
  getInstance,
  IamHttpError,
  listInstances,
  reconcileInstanceKeycloak,
  suspendInstance,
  updateInstance,
  type CreateInstancePayload,
  type ReconcileInstanceKeycloakPayload,
  type UpdateInstancePayload,
} from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { useAuth } from '../providers/auth-provider';

type InstanceStatusFilter = IamInstanceListItem['status'] | 'all';

type InstanceFilters = {
  readonly search: string;
  readonly status: InstanceStatusFilter;
};

const instancesLogger = createOperationLogger('instances-hook', 'debug');

export const useInstances = () => {
  const { invalidatePermissions } = useAuth();
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
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

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
      if (resolvedError.status === 403) {
        await invalidatePermissions();
        instancesLogger.info('permission_invalidated_after_403', {
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
  }, [debouncedSearch, filters.status, invalidatePermissions]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const loadInstance = React.useCallback(
    async (instanceId: string) => {
      logBrowserOperationStart(instancesLogger, 'instance_detail_load_started', {
        operation: 'get_instance_detail',
        instance_id: instanceId,
      });
      setDetailLoading(true);
      setMutationError(null);
      try {
        const [detailResponse, statusResponse] = await Promise.all([
          getInstance(instanceId),
          getInstanceKeycloakStatus(instanceId).catch(async (cause) => {
            const resolvedError = asIamError(cause);
            if (resolvedError.status === 403) {
              await invalidatePermissions();
              instancesLogger.info('permission_invalidated_after_403', {
                operation: 'get_instance_keycloak_status',
                status: resolvedError.status,
                error_code: resolvedError.code,
                instance_id: instanceId,
              });
            }
            setMutationError(resolvedError);
            logBrowserOperationFailure(instancesLogger, 'instance_keycloak_status_refresh_failed', resolvedError, {
              operation: 'get_instance_keycloak_status',
              instance_id: instanceId,
            });
            return null;
          }),
        ]);
        const nextInstance = {
          ...detailResponse.data,
          keycloakStatus: statusResponse?.data ?? detailResponse.data.keycloakStatus,
        };
        setSelectedInstance(nextInstance);
        logBrowserOperationSuccess(instancesLogger, 'instance_detail_load_succeeded', {
          operation: 'get_instance_detail',
          instance_id: instanceId,
          keycloak_status_loaded: statusResponse !== null,
        });
        return nextInstance;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
          instancesLogger.info('permission_invalidated_after_403', {
            operation: 'get_instance_detail',
            status: resolvedError.status,
            error_code: resolvedError.code,
            instance_id: instanceId,
          });
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
    [invalidatePermissions]
  );

  const mutate = React.useCallback(
    async <T>(action: () => Promise<{ data: T }>, instanceId?: string, operation = 'instance_mutation') => {
      setMutationError(null);
      logBrowserOperationStart(instancesLogger, 'instance_mutation_started', {
        operation,
        instance_id: instanceId,
      });
      try {
        const result = await action();
        await refetch();
        if (instanceId) {
          await loadInstance(instanceId);
        }
        logBrowserOperationSuccess(instancesLogger, 'instance_mutation_succeeded', {
          operation,
          instance_id: instanceId,
        });
        return result.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
          instancesLogger.info('permission_invalidated_after_403', {
            operation,
            status: resolvedError.status,
            error_code: resolvedError.code,
            instance_id: instanceId,
          });
        }
        setMutationError(resolvedError);
        logBrowserOperationFailure(instancesLogger, 'instance_mutation_failed', resolvedError, {
          operation,
          instance_id: instanceId,
        });
        return null;
      }
    },
    [invalidatePermissions, loadInstance, refetch]
  );

  return {
    instances,
    selectedInstance,
    isLoading,
    detailLoading,
    statusLoading,
    error,
    mutationError,
    filters,
    setSearch: (value: string) => setFilters((current) => ({ ...current, search: value })),
    setStatus: (value: InstanceStatusFilter) => setFilters((current) => ({ ...current, status: value })),
    refetch,
    loadInstance,
    clearSelectedInstance: () => setSelectedInstance(null),
    clearMutationError: () => setMutationError(null),
    createInstance: async (payload: CreateInstancePayload) =>
      mutate(() => createInstance(payload), payload.instanceId, 'create_instance'),
    updateInstance: async (instanceId: string, payload: UpdateInstancePayload) =>
      mutate(() => updateInstance(instanceId, payload), instanceId, 'update_instance'),
    refreshKeycloakStatus: async (instanceId: string) => {
      logBrowserOperationStart(instancesLogger, 'instance_keycloak_status_refresh_started', {
        operation: 'get_instance_keycloak_status',
        instance_id: instanceId,
      });
      setStatusLoading(true);
      setMutationError(null);
      try {
        const response = await getInstanceKeycloakStatus(instanceId);
        setSelectedInstance((current) =>
          current && current.instanceId === instanceId
            ? {
                ...current,
                keycloakStatus: response.data,
              }
            : current
        );
        logBrowserOperationSuccess(instancesLogger, 'instance_keycloak_status_refresh_succeeded', {
          operation: 'get_instance_keycloak_status',
          instance_id: instanceId,
        });
        return response.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
          instancesLogger.info('permission_invalidated_after_403', {
            operation: 'get_instance_keycloak_status',
            status: resolvedError.status,
            error_code: resolvedError.code,
            instance_id: instanceId,
          });
        }
        setMutationError(resolvedError);
        logBrowserOperationFailure(instancesLogger, 'instance_keycloak_status_refresh_failed', resolvedError, {
          operation: 'get_instance_keycloak_status',
          instance_id: instanceId,
        });
        return null;
      } finally {
        setStatusLoading(false);
      }
    },
    reconcileKeycloak: async (instanceId: string, payload: ReconcileInstanceKeycloakPayload) =>
      mutate(
        async () => {
          const response = await reconcileInstanceKeycloak(instanceId, payload);
          setSelectedInstance((current) =>
            current && current.instanceId === instanceId
              ? {
                  ...current,
                  keycloakStatus: response.data,
                }
              : current
          );
          return response;
        },
        instanceId,
        'reconcile_instance_keycloak'
      ),
    activateInstance: async (instanceId: string) => mutate(() => activateInstance(instanceId), instanceId, 'activate_instance'),
    suspendInstance: async (instanceId: string) => mutate(() => suspendInstance(instanceId), instanceId, 'suspend_instance'),
    archiveInstance: async (instanceId: string) => mutate(() => archiveInstance(instanceId), instanceId, 'archive_instance'),
  };
};
