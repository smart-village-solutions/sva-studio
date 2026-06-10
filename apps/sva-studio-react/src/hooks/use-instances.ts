import type { IamInstanceDetail, IamInstanceListItem, InstanceAuditRun } from '@sva/core';
import React from 'react';

import {
  activateInstance,
  assignInstanceModule,
  archiveInstance,
  asIamError,
  bootstrapInstanceAdminStructure,
  createInstance,
  executeInstanceKeycloakProvisioning,
  getInstanceKeycloakStatus,
  getInstanceKeycloakPreflight,
  getInstanceKeycloakProvisioningRun,
  getInstanceAuditRun,
  getSingleInstanceAuditRun,
  getInstance,
  IamHttpError,
  listInstances,
  planInstanceKeycloakProvisioning,
  probeTenantIamAccess,
  reconcileInstanceKeycloak,
  revokeInstanceModule,
  seedInstanceIamBaseline,
  suspendInstance,
  updateInstance,
  type CreateInstancePayload,
  type ExecuteInstanceKeycloakProvisioningPayload,
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
const passthroughWorkflowErrorCodes = new Set([
  'unauthorized',
  'forbidden',
  'tenant_admin_client_not_configured',
  'tenant_admin_client_secret_missing',
  'tenant_auth_client_secret_missing',
  'encryption_not_configured',
  'csrf_validation_failed',
  'reauth_required',
  'conflict',
  'invalid_request',
  'not_found',
]);

const normalizeKeycloakWorkflowError = (error: IamHttpError): IamHttpError => {
  if (passthroughWorkflowErrorCodes.has(error.code)) {
    return error;
  }

  if (error.code === 'keycloak_unavailable') {
    return error;
  }

  return new IamHttpError({
    status: 502,
    code: 'keycloak_unavailable',
    message: error.message,
    requestId: error.requestId,
  });
};

export const useInstances = () => {
  const { invalidatePermissions } = useAuth();
  const [filters, setFilters] = React.useState<InstanceFilters>({ search: '', status: 'all' });
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [instances, setInstances] = React.useState<readonly IamInstanceListItem[]>([]);
  const [selectedInstance, setSelectedInstance] = React.useState<IamInstanceDetail | null>(null);
  const [instancesAuditRun, setInstancesAuditRun] = React.useState<InstanceAuditRun | null>(null);
  const [instanceAuditRun, setInstanceAuditRun] = React.useState<InstanceAuditRun | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [statusLoading, setStatusLoading] = React.useState(false);
  const [auditLoading, setAuditLoading] = React.useState(false);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);
  const pendingAuditRequestsRef = React.useRef(0);
  const currentDetailInstanceIdRef = React.useRef<string | null>(null);
  const latestInstanceAuditRequestRef = React.useRef(0);

  React.useEffect(() => {
    const timer = globalThis.setTimeout(() => setDebouncedSearch(filters.search.trim()), 250);
    return () => globalThis.clearTimeout(timer);
  }, [filters.search]);

  const beginAuditRequest = React.useCallback(() => {
    pendingAuditRequestsRef.current += 1;
    setAuditLoading(true);
  }, []);

  const endAuditRequest = React.useCallback(() => {
    pendingAuditRequestsRef.current = Math.max(0, pendingAuditRequestsRef.current - 1);
    setAuditLoading(pendingAuditRequestsRef.current > 0);
  }, []);

  const updateSelectedForInstance = React.useCallback(
    (instanceId: string, updater: (current: IamInstanceDetail) => IamInstanceDetail) => {
      setSelectedInstance((current) => (current?.instanceId === instanceId ? updater(current) : current));
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

  const invalidatePermissionsAfter403 = React.useCallback(
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
      await invalidatePermissions();
      instancesLogger.info('permission_invalidated_after_403', {
        operation: input.operation,
        status: input.status,
        error_code: input.errorCode,
        instance_id: input.instanceId,
      });
    },
    [invalidatePermissions]
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
      const permissionInvalidationState = { invalidated: false };
      try {
        let statusError: IamHttpError | undefined;
        const [detailResponse, statusResponse] = await Promise.all([
          getInstance(instanceId),
          getInstanceKeycloakStatus(instanceId).catch(async (cause) => {
            const resolvedError = asIamError(cause);
            if (resolvedError.status === 403) {
              await invalidatePermissionsAfter403(
                {
                  operation: 'get_instance_keycloak_status',
                  status: resolvedError.status,
                  errorCode: resolvedError.code,
                  instanceId,
                },
                permissionInvalidationState
              );
            }
            statusError = resolvedError;
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
        const nextMutationError = statusError ? normalizeKeycloakWorkflowError(statusError) : null;
        setMutationError(nextMutationError);
        logBrowserOperationSuccess(instancesLogger, 'instance_detail_load_succeeded', {
          operation: 'get_instance_detail',
          instance_id: instanceId,
          keycloak_status_loaded: statusResponse !== null,
        });
        return nextInstance;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissionsAfter403(
            {
              operation: 'get_instance_detail',
              status: resolvedError.status,
              errorCode: resolvedError.code,
              instanceId,
            },
            permissionInvalidationState
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
    [invalidatePermissionsAfter403]
  );

  const refreshInstanceAudit = React.useCallback(
    async (instanceId: string) => {
      beginAuditRequest();
      if (currentDetailInstanceIdRef.current === null) {
        currentDetailInstanceIdRef.current = instanceId;
      }
      const requestToken = latestInstanceAuditRequestRef.current + 1;
      latestInstanceAuditRequestRef.current = requestToken;
      try {
        const response = await getSingleInstanceAuditRun(instanceId);
        const targetInstanceIds = response.data.targetInstanceIds ?? [instanceId];
        const isLatestRequest = latestInstanceAuditRequestRef.current === requestToken;
        const targetsRequestedInstance =
          targetInstanceIds.length === 0 || targetInstanceIds.includes(instanceId);
        const matchesCurrentDetail =
          currentDetailInstanceIdRef.current === null || currentDetailInstanceIdRef.current === instanceId;
        if (isLatestRequest && matchesCurrentDetail && targetsRequestedInstance) {
          setInstanceAuditRun(response.data);
        }
        return response.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        setMutationError((current) => current ?? resolvedError);
        return null;
      } finally {
        endAuditRequest();
      }
    },
    [beginAuditRequest, endAuditRequest, invalidatePermissions]
  );

  const refreshInstancesAudit = React.useCallback(
    async (input?: { includeOnlyActive?: boolean; instanceIds?: readonly string[] }) => {
      beginAuditRequest();
      try {
        const response = await getInstanceAuditRun({
          includeOnlyActive: input?.includeOnlyActive ?? true,
          instanceIds: input?.instanceIds,
        });
        setInstancesAuditRun(response.data);
        return response.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        setMutationError((current) => current ?? resolvedError);
        return null;
      } finally {
        endAuditRequest();
      }
    },
    [beginAuditRequest, endAuditRequest, invalidatePermissions]
  );

  const mutate = React.useCallback(
    async <T>(
      action: () => Promise<{ data: T }>,
      instanceId?: string,
      operation = 'instance_mutation',
      options?: { invalidateAuthAfterSuccess?: boolean }
    ) => {
      setMutationError(null);
      logBrowserOperationStart(instancesLogger, 'instance_mutation_started', {
        operation,
        instance_id: instanceId,
      });
      try {
        const result = await action();
        if (options?.invalidateAuthAfterSuccess) {
          await invalidatePermissions();
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
    [invalidatePermissions, loadInstance, refetch, refreshInstanceAudit]
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
    setStatus: (value: InstanceStatusFilter) => setFilters((current) => ({ ...current, status: value })),
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
        updateSelectedForInstance(instanceId, (current) => ({
          ...current,
          keycloakStatus: response.data,
        }));
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
    refreshKeycloakPreflight: async (instanceId: string) => {
      setStatusLoading(true);
      setMutationError(null);
      try {
        const response = await getInstanceKeycloakPreflight(instanceId);
        updateSelectedForInstance(instanceId, (current) => ({
          ...current,
          keycloakPreflight: response.data,
        }));
        return response.data;
      } catch (cause) {
        const resolvedError = normalizeKeycloakWorkflowError(asIamError(cause));
        setMutationError(resolvedError);
        return null;
      } finally {
        setStatusLoading(false);
      }
    },
    planKeycloakProvisioning: async (instanceId: string) => {
      setStatusLoading(true);
      setMutationError(null);
      try {
        const response = await planInstanceKeycloakProvisioning(instanceId);
        updateSelectedForInstance(instanceId, (current) => ({
          ...current,
          keycloakPlan: response.data,
        }));
        return response.data;
      } catch (cause) {
        const resolvedError = normalizeKeycloakWorkflowError(asIamError(cause));
        setMutationError(resolvedError);
        return null;
      } finally {
        setStatusLoading(false);
      }
    },
    executeKeycloakProvisioning: async (instanceId: string, payload: ExecuteInstanceKeycloakProvisioningPayload) =>
      mutate(
        async () => {
          const response = await executeInstanceKeycloakProvisioning(instanceId, payload);
          updateSelectedForInstance(instanceId, (current) => {
            const keycloakProvisioningRuns = mergeProvisioningRuns(
              current.keycloakProvisioningRuns,
              response.data ?? undefined
            );

            return {
              ...current,
              latestKeycloakProvisioningRun: response.data ?? undefined,
              keycloakProvisioningRuns,
            };
          });
          return response;
        },
        instanceId,
        'execute_instance_keycloak_provisioning'
      ),
    probeTenantIamAccess: async (instanceId: string) => {
      setStatusLoading(true);
      setMutationError(null);
      logBrowserOperationStart(instancesLogger, 'tenant_iam_access_probe_started', {
        operation: 'probe_tenant_iam_access',
        instance_id: instanceId,
      });
      try {
        const response = await probeTenantIamAccess(instanceId);
        updateSelectedForInstance(instanceId, (current) => ({
          ...current,
          tenantIamStatus: response.data,
        }));
        logBrowserOperationSuccess(instancesLogger, 'tenant_iam_access_probe_succeeded', {
          operation: 'probe_tenant_iam_access',
          instance_id: instanceId,
        });
        return response.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        setMutationError(resolvedError);
        logBrowserOperationFailure(instancesLogger, 'tenant_iam_access_probe_failed', resolvedError, {
          operation: 'probe_tenant_iam_access',
          instance_id: instanceId,
        });
        return null;
      } finally {
        setStatusLoading(false);
      }
    },
    loadKeycloakProvisioningRun: async (instanceId: string, runId: string) => {
      setStatusLoading(true);
      setMutationError(null);
      try {
        const response = await getInstanceKeycloakProvisioningRun(instanceId, runId);
        if (response.data) {
          updateSelectedForInstance(instanceId, (current) => ({
            ...current,
            latestKeycloakProvisioningRun: response.data,
            keycloakProvisioningRuns: mergeProvisioningRuns(current.keycloakProvisioningRuns, response.data),
          }));
        }
        return response.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
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
          updateSelectedForInstance(instanceId, (current) => ({
            ...current,
            keycloakStatus: response.data,
          }));
          return response;
        },
        instanceId,
        'reconcile_instance_keycloak'
      ),
    assignModule: async (instanceId: string, moduleId: string) =>
      mutate(
        async () => assignInstanceModule(instanceId, moduleId),
        instanceId,
        'assign_instance_module',
        { invalidateAuthAfterSuccess: true }
      ),
    bootstrapAdminStructure: async (instanceId: string, moduleIds: readonly string[]) =>
      mutate(
        async () => bootstrapInstanceAdminStructure(instanceId, moduleIds),
        instanceId,
        'bootstrap_instance_admin_structure',
        { invalidateAuthAfterSuccess: true }
      ),
    revokeModule: async (instanceId: string, moduleId: string) =>
      mutate(
        async () => revokeInstanceModule(instanceId, moduleId),
        instanceId,
        'revoke_instance_module',
        { invalidateAuthAfterSuccess: true }
      ),
    seedIamBaseline: async (instanceId: string) =>
      mutate(
        async () => seedInstanceIamBaseline(instanceId),
        instanceId,
        'seed_instance_iam_baseline',
        { invalidateAuthAfterSuccess: true }
      ),
    activateInstance: async (instanceId: string) => mutate(() => activateInstance(instanceId), instanceId, 'activate_instance'),
    suspendInstance: async (instanceId: string) => mutate(() => suspendInstance(instanceId), instanceId, 'suspend_instance'),
    archiveInstance: async (instanceId: string) => mutate(() => archiveInstance(instanceId), instanceId, 'archive_instance'),
  };
};
