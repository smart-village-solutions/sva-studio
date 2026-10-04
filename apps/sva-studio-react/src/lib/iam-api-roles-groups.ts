import type {
  ApiItemResponse,
  ApiListResponse,
  IamKeycloakRealmRole,
  IamLegalTextListItem,
  IamPermission,
  IamRoleListItem,
} from '@sva/core';

import type {
  IamGroupDetail as IamAdminGroupDetail,
  IamGroupListItem as IamAdminGroupListItem,
} from '@sva/iam-core';

import { IAM_HEADERS, patchJson, postJson, requestJson } from './iam-http-client';

import type {
  AssignGroupMembershipPayload,
  AssignGroupRolePayload,
  CreateGroupPayload,
  CreateLegalTextPayload,
  CreateRolePayload,
  RoleReconcileReport,
  UpdateGroupPayload,
  UpdateLegalTextPayload,
  UpdateRolePayload,
} from './iam-api-admin-types';

export const listRoles = async (): Promise<ApiListResponse<IamRoleListItem>> =>
  requestJson<ApiListResponse<IamRoleListItem>>('/api/v1/iam/roles');

export const listKeycloakRoles = async (): Promise<ApiListResponse<IamKeycloakRealmRole>> =>
  requestJson<ApiListResponse<IamKeycloakRealmRole>>('/api/v1/iam/keycloak-roles');

export const listGroups = async (): Promise<ApiListResponse<IamAdminGroupListItem>> =>
  requestJson<ApiListResponse<IamAdminGroupListItem>>('/api/v1/iam/groups');

export const getGroup = async (groupId: string): Promise<ApiItemResponse<IamAdminGroupDetail>> =>
  requestJson<ApiItemResponse<IamAdminGroupDetail>>(`/api/v1/iam/groups/${groupId}`);

export const listLegalTexts = async (): Promise<ApiListResponse<IamLegalTextListItem>> =>
  requestJson<ApiListResponse<IamLegalTextListItem>>('/api/v1/iam/legal-texts');

export const listPermissions = async (): Promise<ApiListResponse<IamPermission>> =>
  requestJson<ApiListResponse<IamPermission>>('/api/v1/iam/permissions');

export const createRole = async (
  payload: CreateRolePayload
): Promise<ApiItemResponse<IamRoleListItem>> =>
  postJson<ApiItemResponse<IamRoleListItem>, CreateRolePayload>('/api/v1/iam/roles', payload, true);

export const createGroup = async (
  payload: CreateGroupPayload
): Promise<ApiItemResponse<{ id: string }>> =>
  postJson<ApiItemResponse<{ id: string }>, CreateGroupPayload>(
    '/api/v1/iam/groups',
    payload,
    true
  );

export const createLegalText = async (
  payload: CreateLegalTextPayload
): Promise<ApiItemResponse<IamLegalTextListItem>> =>
  postJson<ApiItemResponse<IamLegalTextListItem>, CreateLegalTextPayload>(
    '/api/v1/iam/legal-texts',
    payload,
    true
  );

export const updateRole = async (
  roleId: string,
  payload: UpdateRolePayload
): Promise<ApiItemResponse<IamRoleListItem>> =>
  patchJson<ApiItemResponse<IamRoleListItem>, UpdateRolePayload>(
    `/api/v1/iam/roles/${roleId}`,
    payload
  );

export const updateGroup = async (
  groupId: string,
  payload: UpdateGroupPayload
): Promise<ApiItemResponse<{ id: string }>> =>
  patchJson<ApiItemResponse<{ id: string }>, UpdateGroupPayload>(
    `/api/v1/iam/groups/${groupId}`,
    payload
  );

export const updateLegalText = async (
  legalTextVersionId: string,
  payload: UpdateLegalTextPayload
): Promise<ApiItemResponse<IamLegalTextListItem>> =>
  patchJson<ApiItemResponse<IamLegalTextListItem>, UpdateLegalTextPayload>(
    `/api/v1/iam/legal-texts/${legalTextVersionId}`,
    payload
  );

export const deleteRole = async (roleId: string): Promise<ApiItemResponse<{ id: string }>> =>
  requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/iam/roles/${roleId}`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
  });

export const deleteGroup = async (groupId: string): Promise<ApiItemResponse<{ id: string }>> =>
  requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/iam/groups/${groupId}`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
  });

export const deleteLegalText = async (
  legalTextVersionId: string
): Promise<ApiItemResponse<{ id: string }>> =>
  requestJson<ApiItemResponse<{ id: string }>>(`/api/v1/iam/legal-texts/${legalTextVersionId}`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
  });

export const assignGroupRole = async (
  groupId: string,
  payload: AssignGroupRolePayload
): Promise<ApiItemResponse<{ groupId: string; roleId: string }>> =>
  postJson<ApiItemResponse<{ groupId: string; roleId: string }>, AssignGroupRolePayload>(
    `/api/v1/iam/groups/${groupId}/roles`,
    payload,
    true
  );

export const removeGroupRole = async (
  groupId: string,
  roleId: string
): Promise<ApiItemResponse<{ groupId: string; roleId: string }>> =>
  requestJson<ApiItemResponse<{ groupId: string; roleId: string }>>(
    `/api/v1/iam/groups/${groupId}/roles/${roleId}`,
    {
      method: 'DELETE',
      headers: IAM_HEADERS,
    }
  );

export const assignGroupMembership = async (
  groupId: string,
  payload: AssignGroupMembershipPayload
): Promise<ApiItemResponse<{ groupId: string }>> =>
  postJson<ApiItemResponse<{ groupId: string }>, AssignGroupMembershipPayload>(
    `/api/v1/iam/groups/${groupId}/memberships`,
    payload,
    true
  );

export const removeGroupMembership = async (
  groupId: string,
  keycloakSubject: string
): Promise<ApiItemResponse<{ groupId: string }>> =>
  requestJson<ApiItemResponse<{ groupId: string }>>(`/api/v1/iam/groups/${groupId}/memberships`, {
    method: 'DELETE',
    headers: IAM_HEADERS,
    body: JSON.stringify({ keycloakSubject }),
  });

export const reconcileRoles = async (): Promise<ApiItemResponse<RoleReconcileReport>> =>
  requestJson<ApiItemResponse<RoleReconcileReport>>('/api/v1/iam/admin/reconcile', {
    method: 'POST',
    headers: IAM_HEADERS,
    body: JSON.stringify({}),
  });
