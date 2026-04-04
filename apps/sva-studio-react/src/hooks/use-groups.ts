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
import {
  createOperationLogger,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
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

const groupsLogger = createOperationLogger('groups-hook', 'debug');

export const useGroups = (): UseGroupsResult => {
  const { invalidatePermissions } = useAuth();
  const adminList = useIamAdminList(listGroups, invalidatePermissions);

  const loadGroupDetail = React.useCallback(
    async (groupId: string) => {
      adminList.setError(null);
      logBrowserOperationStart(groupsLogger, 'group_detail_load_started', {
        operation: 'get_group',
      });

      try {
        const response = await getGroup(groupId);
        logBrowserOperationSuccess(groupsLogger, 'group_detail_load_succeeded', {
          operation: 'get_group',
          group_id: groupId,
        });
        return response.data;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
          groupsLogger.info('permission_invalidated_after_403', {
            operation: 'get_group',
            status: resolvedError.status,
            error_code: resolvedError.code,
            group_id: groupId,
          });
        }
        adminList.setError(resolvedError);
        logBrowserOperationFailure(groupsLogger, 'group_detail_load_failed', resolvedError, {
          operation: 'get_group',
          group_id: groupId,
        });
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
    createGroup: (payload) => adminList.runMutation(() => createGroup(payload), { operation: 'create_group' }),
    updateGroup: (groupId, payload) => adminList.runMutation(() => updateGroup(groupId, payload), { operation: 'update_group' }),
    deleteGroup: (groupId) => adminList.runMutation(() => deleteGroup(groupId), { operation: 'delete_group' }),
    loadGroupDetail,
    assignRole: (groupId, roleId) => adminList.runMutation(() => assignGroupRole(groupId, { roleId }), { operation: 'assign_group_role' }),
    removeRole: (groupId, roleId) => adminList.runMutation(() => removeGroupRole(groupId, roleId), { operation: 'remove_group_role' }),
    assignMembership: (groupId, payload) =>
      adminList.runMutation(() => assignGroupMembership(groupId, payload), { operation: 'assign_group_membership' }),
    removeMembership: (groupId, keycloakSubject) =>
      adminList.runMutation(() => removeGroupMembership(groupId, keycloakSubject), { operation: 'remove_group_membership' }),
  };
};
