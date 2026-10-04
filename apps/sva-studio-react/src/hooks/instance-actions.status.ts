import type React from 'react';

import {
  asIamError,
  getInstanceKeycloakPreflight,
  getInstanceKeycloakProvisioningRun,
  getInstanceKeycloakStatus,
  planInstanceKeycloakProvisioning,
  probeTenantIamAccess,
  type IamHttpError,
} from '../lib/iam-api';
import {
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
  type createOperationLogger,
} from '../lib/browser-operation-logging';

import type { InstanceActionContext } from './instance-actions.write';

export const createInstanceStatusActions = ({
  instancesLogger,
  updateSelectedForInstance,
  mergeProvisioningRuns,
  setStatusLoading,
  setMutationError,
  refreshSession,
}: Pick<InstanceActionContext, 'updateSelectedForInstance' | 'mergeProvisioningRuns'> & {
  instancesLogger: ReturnType<typeof createOperationLogger>;
  setStatusLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setMutationError: React.Dispatch<React.SetStateAction<IamHttpError | null>>;
  refreshSession: () => Promise<unknown>;
}) => ({
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
      if (resolvedError.status === 401) {
        await refreshSession();
        instancesLogger.info('session_refreshed_after_401', {
          operation: 'get_instance_keycloak_status',
          status: resolvedError.status,
          error_code: resolvedError.code,
          instance_id: instanceId,
        });
      }
      setMutationError(resolvedError);
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
      const resolvedError = asIamError(cause);
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
      const resolvedError = asIamError(cause);
      setMutationError(resolvedError);
      return null;
    } finally {
      setStatusLoading(false);
    }
  },
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
      if (resolvedError.status === 401) {
        await refreshSession();
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
          keycloakProvisioningRuns: mergeProvisioningRuns(
            current.keycloakProvisioningRuns,
            response.data
          ),
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
});
