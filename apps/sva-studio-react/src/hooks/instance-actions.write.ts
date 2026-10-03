import type { IamInstanceDetail } from '@sva/core';

import {
  activateInstance,
  assignInstanceModule,
  archiveInstance,
  bootstrapInstanceAdminStructure,
  createInstance,
  executeInstanceKeycloakProvisioning,
  reconcileInstanceKeycloak,
  reconcileTenantIamRoles,
  retryInstanceProvisioning,
  rotateInstanceSecret,
  revokeInstanceModule,
  seedInstanceIamBaseline,
  suspendInstance,
  updateInstance,
  type CreateInstancePayload,
  type ExecuteInstanceKeycloakProvisioningPayload,
  type IamHttpError,
  type ReconcileInstanceKeycloakPayload,
  type ReconcileTenantIamRolesPayload,
  type UpdateInstancePayload,
} from '../lib/iam-api';

export type InstanceActionContext = {
  mutate: <T>(
    action: () => Promise<{ data: T }>,
    instanceId?: string,
    operation?: string,
    options?: { refreshSessionAfterSuccess?: boolean; onError?: (error: IamHttpError) => void }
  ) => Promise<T | null>;
  updateSelectedForInstance: (
    instanceId: string,
    updater: (current: IamInstanceDetail) => IamInstanceDetail
  ) => void;
  mergeProvisioningRuns: (
    currentRuns: IamInstanceDetail['keycloakProvisioningRuns'],
    nextRun: IamInstanceDetail['latestKeycloakProvisioningRun']
  ) => IamInstanceDetail['keycloakProvisioningRuns'];
};

export const createInstanceWriteActions = ({
  mutate,
  updateSelectedForInstance,
  mergeProvisioningRuns,
}: InstanceActionContext) => ({
  createInstance: async (payload: CreateInstancePayload) =>
    mutate(() => createInstance(payload), payload.instanceId, 'create_instance'),
  retryTenantProvisioning: async (instanceId: string) =>
    mutate(() => retryInstanceProvisioning(instanceId), instanceId, 'retry_instance_provisioning'),
  updateInstance: async (
    instanceId: string,
    payload: UpdateInstancePayload,
    onError?: (error: IamHttpError) => void
  ) =>
    mutate(() => updateInstance(instanceId, payload), instanceId, 'update_instance', { onError }),
  executeKeycloakProvisioning: async (
    instanceId: string,
    payload: ExecuteInstanceKeycloakProvisioningPayload
  ) =>
    mutate(
      async () => {
        const response =
          payload.intent === 'rotate_client_secret'
            ? await rotateInstanceSecret(instanceId, payload.planFingerprint)
            : await executeInstanceKeycloakProvisioning(instanceId, payload);
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
  reconcileTenantIamRoles: async (instanceId: string, payload: ReconcileTenantIamRolesPayload) =>
    mutate(
      async () => reconcileTenantIamRoles(instanceId, payload),
      instanceId,
      'reconcile_tenant_iam_roles'
    ),
  assignModule: async (instanceId: string, moduleId: string) =>
    mutate(
      async () => assignInstanceModule(instanceId, moduleId),
      instanceId,
      'assign_instance_module',
      { refreshSessionAfterSuccess: true }
    ),
  bootstrapAdminStructure: async (instanceId: string, moduleIds: readonly string[]) =>
    mutate(
      async () => bootstrapInstanceAdminStructure(instanceId, moduleIds),
      instanceId,
      'bootstrap_instance_admin_structure',
      { refreshSessionAfterSuccess: true }
    ),
  revokeModule: async (instanceId: string, moduleId: string) =>
    mutate(
      async () => revokeInstanceModule(instanceId, moduleId),
      instanceId,
      'revoke_instance_module',
      { refreshSessionAfterSuccess: true }
    ),
  seedIamBaseline: async (instanceId: string) =>
    mutate(
      async () => seedInstanceIamBaseline(instanceId),
      instanceId,
      'seed_instance_iam_baseline',
      { refreshSessionAfterSuccess: true }
    ),
  activateInstance: async (instanceId: string) =>
    mutate(() => activateInstance(instanceId), instanceId, 'activate_instance'),
  suspendInstance: async (instanceId: string) =>
    mutate(() => suspendInstance(instanceId), instanceId, 'suspend_instance'),
  archiveInstance: async (instanceId: string) =>
    mutate(() => archiveInstance(instanceId), instanceId, 'archive_instance'),
});
