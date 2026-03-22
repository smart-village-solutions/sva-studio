import type { IamAdminGroupDetail, IamAdminGroupListItem } from '@sva/core';

import React from 'react';

import {
  asIamError,
  assignGroupMembership,
  assignGroupRole,
  createGroup,
  deleteGroup,
  getGroup,
  IamHttpError,
  listGroups,
  removeGroupMembership,
  removeGroupRole,
  updateGroup,
  type AssignGroupMembershipPayload,
  type CreateGroupPayload,
  type UpdateGroupPayload,
} from '../lib/iam-api';
import { useAuth } from '../providers/auth-provider';
import { useIamAdminList } from './use-iam-admin-list';

type UseGroupsResult = {
  readonly groups: readonly IamAdminGroupListItem[];
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly mutationError: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly clearMutationError: () => void;
  readonly createGroup: (payload: CreateGroupPayload) => Promise<boolean>;
  readonly updateGroup: (groupId: string, payload: UpdateGroupPayload) => Promise<boolean>;
  readonly deleteGroup: (groupId: string) => Promise<boolean>;
  readonly loadGroupDetail: (groupId: string) => Promise<IamAdminGroupDetail | null>;
  readonly assignRole: (groupId: string, roleId: string) => Promise<boolean>;
  readonly removeRole: (groupId: string, roleId: string) => Promise<boolean>;
  readonly assignMembership: (groupId: string, payload: AssignGroupMembershipPayload) => Promise<boolean>;
  readonly removeMembership: (groupId: string, keycloakSubject: string) => Promise<boolean>;
};

export const useGroups = (): UseGroupsResult => {
  const { invalidatePermissions } = useAuth();
  const adminList = useIamAdminList(listGroups, invalidatePermissions);

  const loadGroupDetail = React.useCallback(
    async (groupId: string) => {
      adminList.setError(null);

      try {
        const response = await getGroup(groupId);
        return response.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        adminList.setError(resolvedError);
        return null;
      }
    },
    [adminList, invalidatePermissions]
  );

  return {
    groups: adminList.items,
    isLoading: adminList.isLoading,
    error: adminList.error,
    mutationError: adminList.mutationError,
    refetch: adminList.refetch,
    clearMutationError: adminList.clearMutationError,
    createGroup: (payload) => adminList.runMutation(() => createGroup(payload)),
    updateGroup: (groupId, payload) => adminList.runMutation(() => updateGroup(groupId, payload)),
    deleteGroup: (groupId) => adminList.runMutation(() => deleteGroup(groupId)),
    loadGroupDetail,
    assignRole: (groupId, roleId) => adminList.runMutation(() => assignGroupRole(groupId, { roleId })),
    removeRole: (groupId, roleId) => adminList.runMutation(() => removeGroupRole(groupId, roleId)),
    assignMembership: (groupId, payload) => adminList.runMutation(() => assignGroupMembership(groupId, payload)),
    removeMembership: (groupId, keycloakSubject) =>
      adminList.runMutation(() => removeGroupMembership(groupId, keycloakSubject)),
  };
};
