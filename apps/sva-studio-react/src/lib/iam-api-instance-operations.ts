import type { ApiItemResponse, IamInstanceDetail, IamInstanceListItem } from '@sva/core';

import { postJson, requestJson } from './iam-http-client';

import type {
  ExecuteInstanceKeycloakProvisioningPayload,
  ReconcileInstanceKeycloakPayload,
  ReconcileTenantIamRolesPayload,
} from './iam-api-instance-types';

export const getInstanceKeycloakStatus = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceDetail['keycloakStatus']>> =>
  requestJson<ApiItemResponse<IamInstanceDetail['keycloakStatus']>>(
    `/api/v1/iam/instances/${instanceId}/keycloak/status`
  );

export const getInstanceKeycloakPreflight = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceDetail['keycloakPreflight']>> =>
  requestJson<ApiItemResponse<IamInstanceDetail['keycloakPreflight']>>(
    `/api/v1/iam/instances/${instanceId}/keycloak/preflight`
  );

export const planInstanceKeycloakProvisioning = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceDetail['keycloakPlan']>> =>
  postJson<ApiItemResponse<IamInstanceDetail['keycloakPlan']>, Record<string, never>>(
    `/api/v1/iam/instances/${instanceId}/keycloak/plan`,
    {},
    true
  );

export const executeInstanceKeycloakProvisioning = async (
  instanceId: string,
  payload: ExecuteInstanceKeycloakProvisioningPayload
): Promise<ApiItemResponse<IamInstanceDetail['latestKeycloakProvisioningRun']>> =>
  postJson<
    ApiItemResponse<IamInstanceDetail['latestKeycloakProvisioningRun']>,
    ExecuteInstanceKeycloakProvisioningPayload
  >(`/api/v1/iam/instances/${instanceId}/keycloak/execute`, payload, true);

export const rotateInstanceSecret = async (
  instanceId: string,
  planFingerprint: string
): Promise<ApiItemResponse<IamInstanceDetail['latestKeycloakProvisioningRun']>> =>
  postJson<
    ApiItemResponse<IamInstanceDetail['latestKeycloakProvisioningRun']>,
    Pick<ExecuteInstanceKeycloakProvisioningPayload, 'intent' | 'planFingerprint'>
  >(
    `/api/v1/iam/instances/${instanceId}/keycloak/rotate-secret`,
    { intent: 'rotate_client_secret', planFingerprint },
    true
  );

export const getInstanceKeycloakProvisioningRun = async (
  instanceId: string,
  runId: string
): Promise<ApiItemResponse<IamInstanceDetail['latestKeycloakProvisioningRun']>> =>
  requestJson<ApiItemResponse<IamInstanceDetail['latestKeycloakProvisioningRun']>>(
    `/api/v1/iam/instances/${instanceId}/keycloak/runs/${runId}`
  );

export const reconcileInstanceKeycloak = async (
  instanceId: string,
  payload: ReconcileInstanceKeycloakPayload
): Promise<ApiItemResponse<IamInstanceDetail['keycloakStatus']>> =>
  postJson<ApiItemResponse<IamInstanceDetail['keycloakStatus']>, ReconcileInstanceKeycloakPayload>(
    `/api/v1/iam/instances/${instanceId}/keycloak/reconcile`,
    payload,
    true
  );

export const reconcileTenantIamRoles = async (
  instanceId: string,
  payload: ReconcileTenantIamRolesPayload
): Promise<ApiItemResponse<unknown>> =>
  postJson<ApiItemResponse<unknown>, ReconcileTenantIamRolesPayload>(
    `/api/v1/iam/instances/${instanceId}/tenant-iam/roles/reconcile`,
    payload,
    true
  );

export const probeTenantIamAccess = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceDetail['tenantIamStatus']>> =>
  postJson<ApiItemResponse<IamInstanceDetail['tenantIamStatus']>, Record<string, never>>(
    `/api/v1/iam/instances/${instanceId}/tenant-iam/access-probe`,
    {},
    true
  );

export const assignInstanceModule = async (
  instanceId: string,
  moduleId: string
): Promise<ApiItemResponse<IamInstanceDetail>> =>
  postJson<ApiItemResponse<IamInstanceDetail>, { moduleId: string }>(
    `/api/v1/iam/instances/${instanceId}/modules/assign`,
    { moduleId },
    true
  );

export const bootstrapInstanceAdminStructure = async (
  instanceId: string,
  moduleIds: readonly string[]
): Promise<ApiItemResponse<IamInstanceDetail>> =>
  postJson<ApiItemResponse<IamInstanceDetail>, { moduleIds: readonly string[] }>(
    `/api/v1/iam/instances/${instanceId}/modules/bootstrap-admin-structure`,
    { moduleIds },
    true
  );

export const revokeInstanceModule = async (
  instanceId: string,
  moduleId: string
): Promise<ApiItemResponse<IamInstanceDetail>> =>
  postJson<ApiItemResponse<IamInstanceDetail>, { moduleId: string; confirmation: 'REVOKE' }>(
    `/api/v1/iam/instances/${instanceId}/modules/revoke`,
    { moduleId, confirmation: 'REVOKE' },
    true
  );

export const seedInstanceIamBaseline = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceDetail>> =>
  postJson<ApiItemResponse<IamInstanceDetail>, Record<string, never>>(
    `/api/v1/iam/instances/${instanceId}/modules/seed-iam-baseline`,
    {},
    true
  );

export const activateInstance = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceListItem>> =>
  postJson<ApiItemResponse<IamInstanceListItem>, { status: 'active' }>(
    `/api/v1/iam/instances/${instanceId}/activate`,
    { status: 'active' },
    true
  );

export const suspendInstance = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceListItem>> =>
  postJson<ApiItemResponse<IamInstanceListItem>, { status: 'suspended' }>(
    `/api/v1/iam/instances/${instanceId}/suspend`,
    { status: 'suspended' },
    true
  );

export const archiveInstance = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceListItem>> =>
  postJson<ApiItemResponse<IamInstanceListItem>, { status: 'archived' }>(
    `/api/v1/iam/instances/${instanceId}/archive`,
    { status: 'archived' },
    true
  );
