import type {
  ApiItemResponse,
  ApiListResponse,
  IamCreateUserResult,
  IamKeycloakRoleAssignmentMutationResult,
  IamUserDetail,
  IamUserImportSyncReport,
  IamUserKeycloakRoleAssignments,
  IamUserListItem,
  IamUserTimelineEvent,
} from '@sva/core';

import {
  createJsonMutationRequestInit,
  fetchWithRequestTimeout,
  HEAVY_IAM_REQUEST_TIMEOUT_MS,
  IAM_HEADERS,
  patchJson,
  postJson,
  readIamErrorResponse,
  requestJson,
} from './iam-http-client';

import type { BulkReprovisionMainserverUsersResult } from './iam-api-admin-types';

export * from './iam-api-admin-types';
export * from './iam-api-content';
export * from './iam-api-content-types';
export * from './iam-api-governance';
export * from './iam-api-instance-operations';
export * from './iam-api-instance-types';
export * from './iam-api-instances';
export * from './iam-api-media';
export * from './iam-api-media-types';
export * from './iam-api-organizations';
export * from './iam-api-roles-groups';
export * from './iam-api-runtime';
export {
  asIamError,
  EFFECTIVE_ACCESS_INVALIDATION_REQUIRED_EVENT,
  fetchWithRequestTimeout,
  IamHttpError,
  LEGAL_ACCEPTANCE_REQUIRED_EVENT,
  readIamErrorResponse,
} from './iam-http-client';

export type UserStatusFilter = 'active' | 'inactive' | 'pending' | 'all';

export type UsersQuery = {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly status?: Exclude<UserStatusFilter, 'all'>;
  readonly role?: string;
  readonly includeTechnicalAccounts?: boolean;
};

export type CreateUserPayload = {
  readonly email: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly displayName?: string;
  readonly phone?: string;
  readonly position?: string;
  readonly department?: string;
  readonly preferredLanguage?: string;
  readonly timezone?: string;
  readonly roleIds?: readonly string[];
  readonly groupIds?: readonly string[];
  readonly sendPasswordSetupEmail?: boolean;
  readonly invitationPurpose?: 'studio' | 'ssf';
  readonly isTechnicalAccount?: boolean;
};

export type UpdateUserPayload = Partial<
  Omit<CreateUserPayload, 'roleIds' | 'invitationPurpose'>
> & {
  readonly roleIds?: readonly string[];
  readonly groupIds?: readonly string[];
  readonly status?: 'active' | 'inactive' | 'pending';
  readonly notes?: string;
  readonly mainserverUserApplicationId?: string;
  readonly mainserverUserApplicationSecret?: string;
};

export type UpdateMyProfilePayload = {
  readonly username?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly displayName?: string;
  readonly phone?: string;
  readonly position?: string;
  readonly department?: string;
  readonly preferredLanguage?: string;
  readonly timezone?: string;
};

export const listUsers = async (query: UsersQuery): Promise<ApiListResponse<IamUserListItem>> => {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });

  if (query.search) {
    params.set('search', query.search);
  }
  if (query.status) {
    params.set('status', query.status);
  }
  if (query.role) {
    params.set('role', query.role);
  }
  if (query.includeTechnicalAccounts) {
    params.set('includeTechnicalAccounts', 'true');
  }

  return requestJson<ApiListResponse<IamUserListItem>>(`/api/v1/iam/users?${params.toString()}`);
};

export const getUser = async (userId: string): Promise<ApiItemResponse<IamUserDetail>> =>
  requestJson<ApiItemResponse<IamUserDetail>>(`/api/v1/iam/users/${userId}`);

export const getUserTimeline = async (
  userId: string
): Promise<ApiListResponse<IamUserTimelineEvent>> =>
  requestJson<ApiListResponse<IamUserTimelineEvent>>(`/api/v1/iam/users/${userId}/timeline`);

export const getUserKeycloakRoles = async (
  userRef: string
): Promise<ApiItemResponse<IamUserKeycloakRoleAssignments>> =>
  requestJson<ApiItemResponse<IamUserKeycloakRoleAssignments>>(
    `/api/v1/iam/users/${encodeURIComponent(userRef)}/keycloak-roles`
  );

export const mutateUserKeycloakRole = async (
  userRef: string,
  payload: { readonly roleName: string; readonly operation: 'assign' | 'remove' }
): Promise<ApiItemResponse<IamKeycloakRoleAssignmentMutationResult>> =>
  patchJson<
    ApiItemResponse<IamKeycloakRoleAssignmentMutationResult>,
    { readonly roleName: string; readonly operation: 'assign' | 'remove' }
  >(`/api/v1/iam/users/${encodeURIComponent(userRef)}/keycloak-roles`, payload);

export const createUser = async (
  payload: CreateUserPayload
): Promise<ApiItemResponse<IamCreateUserResult>> =>
  requestJson<ApiItemResponse<IamCreateUserResult>>(
    '/api/v1/iam/users',
    createJsonMutationRequestInit('POST', payload, { idempotent: true }),
    { timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS }
  );

export const updateUser = async (
  userId: string,
  payload: UpdateUserPayload
): Promise<ApiItemResponse<IamUserDetail>> =>
  patchJson<ApiItemResponse<IamUserDetail>, UpdateUserPayload>(
    `/api/v1/iam/users/${userId}`,
    payload
  );

export const sendPasswordSetupEmail = async (
  userId: string
): Promise<ApiItemResponse<{ status: 'sent' }>> =>
  postJson<ApiItemResponse<{ status: 'sent' }>, Record<string, never>>(
    `/api/v1/iam/users/${userId}/send-password-setup-email`,
    {},
    true
  );

export const reprovisionMainserverUser = async (
  userId: string
): Promise<ApiItemResponse<{ status: 'updated' }>> =>
  postJson<ApiItemResponse<{ status: 'updated' }>, Record<string, never>>(
    `/api/v1/iam/users/${userId}/reprovision-mainserver`,
    {},
    true
  );

export const deactivateUser = async (userId: string): Promise<ApiItemResponse<{ id: string }>> =>
  postJson<ApiItemResponse<{ id: string }>, Record<string, never>>(
    `/api/v1/iam/users/${userId}/deactivate`,
    {},
    true
  );

export const deleteUser = async (userId: string): Promise<void> => {
  const response = await fetchWithRequestTimeout(`/api/v1/iam/users/${userId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      ...IAM_HEADERS,
    },
  });

  if (!response.ok) {
    throw await readIamErrorResponse(response);
  }
};

export const bulkDeactivateUsers = async (
  userIds: readonly string[]
): Promise<ApiItemResponse<{ deactivatedUserIds: readonly string[]; count: number }>> =>
  postJson<
    ApiItemResponse<{ deactivatedUserIds: readonly string[]; count: number }>,
    { userIds: readonly string[] }
  >('/api/v1/iam/users/bulk-deactivate', { userIds }, true);

export const bulkReprovisionMainserverUsers = async (
  userIds: readonly string[]
): Promise<ApiItemResponse<BulkReprovisionMainserverUsersResult>> =>
  requestJson<ApiItemResponse<BulkReprovisionMainserverUsersResult>>(
    '/api/v1/iam/users/bulk-reprovision-mainserver',
    createJsonMutationRequestInit('POST', { userIds }, { idempotent: true }),
    { timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS }
  );

export const syncUsersFromKeycloak = async (): Promise<ApiItemResponse<IamUserImportSyncReport>> =>
  requestJson<ApiItemResponse<IamUserImportSyncReport>>(
    '/api/v1/iam/users/sync-keycloak',
    {
      method: 'POST',
      headers: IAM_HEADERS,
      body: JSON.stringify({}),
    },
    {
      timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS,
    }
  );

export const getMyProfile = async (): Promise<ApiItemResponse<IamUserDetail>> =>
  requestJson<ApiItemResponse<IamUserDetail>>('/api/v1/iam/users/me/profile');

export const updateMyProfile = async (
  payload: UpdateMyProfilePayload
): Promise<ApiItemResponse<IamUserDetail>> =>
  patchJson<ApiItemResponse<IamUserDetail>, UpdateMyProfilePayload>(
    '/api/v1/iam/users/me/profile',
    payload
  );
