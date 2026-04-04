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
import { useAuth } from '../providers/auth-provider';

type InstanceStatusFilter = IamInstanceListItem['status'] | 'all';

type InstanceFilters = {
  readonly search: string;
  readonly status: InstanceStatusFilter;
};

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
    setIsLoading(true);
    setError(null);
    try {
      const response = await listInstances({
        search: debouncedSearch || undefined,
        status: filters.status === 'all' ? undefined : filters.status,
      });
      setInstances(response.data);
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 403) {
        await invalidatePermissions();
      }
      setInstances([]);
      setError(resolvedError);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, filters.status, invalidatePermissions]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const loadInstance = React.useCallback(
    async (instanceId: string) => {
      setDetailLoading(true);
      setMutationError(null);
      try {
        const [detailResponse, statusResponse] = await Promise.all([
          getInstance(instanceId),
          getInstanceKeycloakStatus(instanceId).catch(async (cause) => {
            const resolvedError = asIamError(cause);
            if (resolvedError.status === 403) {
              await invalidatePermissions();
            }
            setMutationError(resolvedError);
            return null;
          }),
        ]);
        const nextInstance = {
          ...detailResponse.data,
          keycloakStatus: statusResponse?.data ?? detailResponse.data.keycloakStatus,
        };
        setSelectedInstance(nextInstance);
        return nextInstance;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        setMutationError(resolvedError);
        return null;
      } finally {
        setDetailLoading(false);
      }
    },
    [invalidatePermissions]
  );

  const mutate = React.useCallback(
    async <T>(action: () => Promise<{ data: T }>, instanceId?: string) => {
      setMutationError(null);
      try {
        const result = await action();
        await refetch();
        if (instanceId) {
          await loadInstance(instanceId);
        }
        return result.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        setMutationError(resolvedError);
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
    createInstance: async (payload: CreateInstancePayload) => mutate(() => createInstance(payload), payload.instanceId),
    updateInstance: async (instanceId: string, payload: UpdateInstancePayload) =>
      mutate(() => updateInstance(instanceId, payload), instanceId),
    refreshKeycloakStatus: async (instanceId: string) => {
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
        return response.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        setMutationError(resolvedError);
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
        instanceId
      ),
    activateInstance: async (instanceId: string) => mutate(() => activateInstance(instanceId), instanceId),
    suspendInstance: async (instanceId: string) => mutate(() => suspendInstance(instanceId), instanceId),
    archiveInstance: async (instanceId: string) => mutate(() => archiveInstance(instanceId), instanceId),
  };
};
