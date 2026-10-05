import type {
  ApiItemResponse,
  ApiListResponse,
  IamOrganizationContext,
  IamOrganizationDetail,
  IamOrganizationListItem,
} from '@sva/core';

import { IAM_HEADERS, patchJson, postJson, putJson, requestJson } from './iam-http-client';

import type {
  AssignOrganizationMembershipPayload,
  CreateOrganizationPayload,
  OrganizationsQuery,
  UpdateOrganizationMembershipPayload,
  UpdateOrganizationPayload,
} from './iam-api-admin-types';
import { requestSingleFlight } from './request-singleflight';

export const listOrganizations = async (
  query: OrganizationsQuery
): Promise<ApiListResponse<IamOrganizationListItem>> => {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  });

  if (query.search) {
    params.set('search', query.search);
  }
  if (query.organizationType) {
    params.set('organizationType', query.organizationType);
  }
  if (query.status) {
    params.set('status', query.status);
  }

  return requestJson<ApiListResponse<IamOrganizationListItem>>(
    `/api/v1/iam/organizations?${params.toString()}`
  );
};

export const getOrganization = async (
  organizationId: string
): Promise<ApiItemResponse<IamOrganizationDetail>> =>
  requestJson<ApiItemResponse<IamOrganizationDetail>>(
    `/api/v1/iam/organizations/${organizationId}`
  );

export const createOrganization = async (
  payload: CreateOrganizationPayload
): Promise<ApiItemResponse<IamOrganizationDetail>> =>
  postJson<ApiItemResponse<IamOrganizationDetail>, CreateOrganizationPayload>(
    '/api/v1/iam/organizations',
    payload,
    true
  );

export const updateOrganization = async (
  organizationId: string,
  payload: UpdateOrganizationPayload
): Promise<ApiItemResponse<IamOrganizationDetail>> =>
  patchJson<ApiItemResponse<IamOrganizationDetail>, UpdateOrganizationPayload>(
    `/api/v1/iam/organizations/${organizationId}`,
    payload
  );

export const provisionOrganizationMainserver = async (
  organizationId: string
): Promise<ApiItemResponse<IamOrganizationDetail>> =>
  postJson<ApiItemResponse<IamOrganizationDetail>, Record<string, never>>(
    `/api/v1/iam/organizations/${organizationId}/provision-mainserver`,
    {},
    true
  );

export const deleteOrganization = async (
  organizationId: string
): Promise<ApiItemResponse<{ id: string }>> =>
  requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/iam/organizations/${organizationId}`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
  });

export const assignOrganizationMembership = async (
  organizationId: string,
  payload: AssignOrganizationMembershipPayload
): Promise<ApiItemResponse<IamOrganizationDetail>> =>
  postJson<ApiItemResponse<IamOrganizationDetail>, AssignOrganizationMembershipPayload>(
    `/api/v1/iam/organizations/${organizationId}/memberships`,
    payload,
    true
  );

export const removeOrganizationMembership = async (
  organizationId: string,
  accountId: string
): Promise<ApiItemResponse<IamOrganizationDetail>> =>
  requestJson<ApiItemResponse<IamOrganizationDetail>>(
    `/api/v1/iam/organizations/${organizationId}/memberships/${accountId}`,
    {
      method: 'DELETE',
      headers: IAM_HEADERS,
    }
  );

export const updateOrganizationMembership = async (
  organizationId: string,
  accountId: string,
  payload: UpdateOrganizationMembershipPayload
): Promise<ApiItemResponse<IamOrganizationDetail>> =>
  patchJson<ApiItemResponse<IamOrganizationDetail>, UpdateOrganizationMembershipPayload>(
    `/api/v1/iam/organizations/${organizationId}/memberships/${accountId}`,
    payload
  );

export const getMyOrganizationContext = async (): Promise<
  ApiItemResponse<IamOrganizationContext>
> =>
  requestSingleFlight('iam:me-context', async () =>
    requestJson<ApiItemResponse<IamOrganizationContext>>('/api/v1/iam/me/context')
  );

export const updateMyOrganizationContext = async (
  organizationId: string | null
): Promise<ApiItemResponse<IamOrganizationContext>> =>
  putJson<ApiItemResponse<IamOrganizationContext>, { organizationId: string | null }>(
    '/api/v1/iam/me/context',
    {
      organizationId,
    }
  );
