import type {
  ApiItemResponse,
  ApiListResponse,
  IamInstanceDetail,
  IamInstanceDraftReadiness,
  IamInstanceListItem,
  IamInstanceRealmCatalog,
  InstanceAuditRun,
  ServerAccountInvitationTemplateView,
  TenantAccountInvitationTemplateView,
} from '@sva/core';

import type {
  PluginTenantLifecycleOperation,
  PluginTenantReadinessReadModel,
} from '@sva/plugin-sdk';

import { patchJson, postJson, requestJson } from './iam-http-client';

import type {
  CreateInstancePayload,
  InstancesQuery,
  UpdateInstancePayload,
  UpdateServerAccountInvitationTemplatePayload,
  UpdateTenantAccountInvitationTemplatePayload,
} from './iam-api-instance-types';

export const listInstances = async (
  query: InstancesQuery = {}
): Promise<ApiListResponse<IamInstanceListItem>> => {
  const params = new URLSearchParams();
  if (query.search) {
    params.set('search', query.search);
  }
  if (query.status) {
    params.set('status', query.status);
  }
  const suffix = params.toString();
  return requestJson<ApiListResponse<IamInstanceListItem>>(
    `/api/v1/iam/instances${suffix ? `?${suffix}` : ''}`
  );
};

export const getInstance = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceDetail>> =>
  requestJson<ApiItemResponse<IamInstanceDetail>>(`/api/v1/iam/instances/${instanceId}`);

export const getInstancePluginReadiness = async (
  instanceId: string
): Promise<ApiItemResponse<readonly PluginTenantReadinessReadModel[]>> =>
  requestJson<ApiItemResponse<readonly PluginTenantReadinessReadModel[]>>(
    `/api/v1/iam/instances/${instanceId}/plugin-readiness`
  );

export const startInstancePluginLifecycle = async (
  instanceId: string,
  pluginId: string,
  operation: PluginTenantLifecycleOperation
): Promise<ApiItemResponse<unknown>> =>
  postJson<
    ApiItemResponse<unknown>,
    { readonly pluginId: string; readonly operation: PluginTenantLifecycleOperation }
  >(`/api/v1/iam/instances/${instanceId}/plugin-readiness`, { pluginId, operation }, true);

export const getInstanceAuditRun = async (
  query: {
    readonly instanceIds?: readonly string[];
    readonly includeOnlyActive?: boolean;
  } = {}
): Promise<ApiItemResponse<InstanceAuditRun>> => {
  const params = new URLSearchParams();
  for (const instanceId of query.instanceIds ?? []) {
    params.append('instanceId', instanceId);
  }
  if (typeof query.includeOnlyActive === 'boolean') {
    params.set('includeOnlyActive', String(query.includeOnlyActive));
  }

  const suffix = params.toString();
  return requestJson<ApiItemResponse<InstanceAuditRun>>(
    `/api/v1/iam/instances/audit${suffix ? `?${suffix}` : ''}`
  );
};

export const getSingleInstanceAuditRun = async (
  instanceId: string
): Promise<ApiItemResponse<InstanceAuditRun>> =>
  requestJson<ApiItemResponse<InstanceAuditRun>>(`/api/v1/iam/instances/${instanceId}/audit`);

export const createInstance = async (
  payload: CreateInstancePayload
): Promise<ApiItemResponse<IamInstanceListItem>> =>
  postJson<ApiItemResponse<IamInstanceListItem>, CreateInstancePayload>(
    '/api/v1/iam/instances',
    payload,
    true
  );

export const getInstanceDraftReadiness = async (
  payload: CreateInstancePayload
): Promise<ApiItemResponse<IamInstanceDraftReadiness>> =>
  postJson<ApiItemResponse<IamInstanceDraftReadiness>, CreateInstancePayload>(
    '/api/v1/iam/instances/draft-readiness',
    payload,
    true
  );

export const listInstanceRealmCatalog = async (
  input: {
    readonly search?: string;
    readonly page?: number;
    readonly pageSize?: number;
  } = {}
): Promise<IamInstanceRealmCatalog & { readonly requestId?: string }> => {
  const params = new URLSearchParams();
  if (input.search) params.set('search', input.search);
  if (input.page) params.set('page', String(input.page));
  if (input.pageSize) params.set('pageSize', String(input.pageSize));
  const query = params.toString();
  return requestJson<IamInstanceRealmCatalog & { readonly requestId?: string }>(
    `/api/v1/iam/instances/keycloak-realms${query ? `?${query}` : ''}`
  );
};

export const retryInstanceProvisioning = async (
  instanceId: string
): Promise<ApiItemResponse<IamInstanceListItem>> =>
  postJson<ApiItemResponse<IamInstanceListItem>, Record<string, never>>(
    `/api/v1/iam/instances/${instanceId}/provisioning/retry`,
    {},
    true
  );

export const updateInstance = async (
  instanceId: string,
  payload: UpdateInstancePayload
): Promise<ApiItemResponse<IamInstanceDetail>> =>
  patchJson<ApiItemResponse<IamInstanceDetail>, UpdateInstancePayload>(
    `/api/v1/iam/instances/${instanceId}`,
    payload
  );

export const getServerAccountInvitationTemplate = async (): Promise<
  ApiItemResponse<ServerAccountInvitationTemplateView>
> =>
  requestJson<ApiItemResponse<ServerAccountInvitationTemplateView>>(
    '/api/v1/iam/templates/account-invitation'
  );

export const updateServerAccountInvitationTemplate = async (
  payload: UpdateServerAccountInvitationTemplatePayload
): Promise<ApiItemResponse<ServerAccountInvitationTemplateView>> =>
  patchJson<
    ApiItemResponse<ServerAccountInvitationTemplateView>,
    UpdateServerAccountInvitationTemplatePayload
  >('/api/v1/iam/templates/account-invitation', payload);

export const getTenantAccountInvitationTemplate = async (): Promise<
  ApiItemResponse<TenantAccountInvitationTemplateView>
> =>
  requestJson<ApiItemResponse<TenantAccountInvitationTemplateView>>(
    '/api/v1/iam/users/me/invitation-template'
  );

export const updateTenantAccountInvitationTemplate = async (
  payload: UpdateTenantAccountInvitationTemplatePayload
): Promise<ApiItemResponse<TenantAccountInvitationTemplateView>> =>
  patchJson<
    ApiItemResponse<TenantAccountInvitationTemplateView>,
    UpdateTenantAccountInvitationTemplatePayload
  >('/api/v1/iam/users/me/invitation-template', payload);
