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
  readonly createGroup: (payload: CreateGroupPayload) => Promise<string | null>;
  readonly updateGroup: (groupId: string, payload: UpdateGroupPayload) => Promise<boolean>;
  readonly deleteGroup: (groupId: string) => Promise<boolean>;
  readonly loadGroupDetail: (groupId: string) => Promise<IamAdminGroupDetail | null>;
  readonly assignRole: (groupId: string, roleId: string) => Promise<boolean>;
  readonly removeRole: (groupId: string, roleId: string) => Promise<boolean>;
  readonly assignMembership: (groupId: string, payload: AssignGroupMembershipPayload) => Promise<boolean>;
  readonly removeMembership: (groupId: string, keycloakSubject: string) => Promise<boolean>;
};

const groupsLogger = createOperationLogger('groups-hook', 'debug');

const normalizeGroupDetail = (detail: IamAdminGroupDetail): IamAdminGroupDetail => {
  const detailRecord = detail as IamAdminGroupDetail & {
    roles?: readonly { roleId: string }[];
    members?: readonly {
      accountId: string;
      groupId: string;
      displayName?: string;
      validFrom?: string;
      validTo?: string;
    }[];
  };

  const assignedRoleIds =
    Array.isArray(detailRecord.assignedRoleIds)
      ? detailRecord.assignedRoleIds
      : (detailRecord.roles ?? []).map((role) => role.roleId);

  const memberships =
    Array.isArray(detailRecord.memberships)
      ? detailRecord.memberships
      : (detailRecord.members ?? []).map((member) => ({
          instanceId: detail.instanceId,
          accountId: member.accountId,
          groupId: member.groupId,
          keycloakSubject: member.accountId,
          displayName: member.displayName,
          validFrom: member.validFrom,
          validUntil: member.validTo,
          assignedAt: member.validFrom ?? detail.updatedAt,
        }));

  return {
    ...detail,
    assignedRoleIds,
    memberships,
  };
};

export const useGroups = (): UseGroupsResult => {
  const { invalidatePermissions } = useAuth();
  const adminList = useIamAdminList(listGroups, invalidatePermissions);
  const {
    items,
    isLoading,
    error,
    mutationError,
    refetch,
    clearMutationError,
    setError,
    runMutationWithResult,
    runMutation,
  } = adminList;

  const loadGroupDetail = React.useCallback(
    async (groupId: string) => {
      setError(null);
      logBrowserOperationStart(groupsLogger, 'group_detail_load_started', {
        operation: 'get_group',
      });

      try {
        const response = await getGroup(groupId);
        logBrowserOperationSuccess(groupsLogger, 'group_detail_load_succeeded', {
          operation: 'get_group',
          group_id: groupId,
        });
        return normalizeGroupDetail(response.data);
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
        setError(resolvedError);
        logBrowserOperationFailure(groupsLogger, 'group_detail_load_failed', resolvedError, {
          operation: 'get_group',
          group_id: groupId,
        });
        return null;
      }
    },
    [invalidatePermissions, setError]
  );

  const createGroupWithResult = React.useCallback(
    (payload: CreateGroupPayload) =>
      runMutationWithResult(() => createGroup(payload), { operation: 'create_group' }).then((response) => response?.data.id ?? null),
    [runMutationWithResult]
  );

  const updateGroupById = React.useCallback(
    (groupId: string, payload: UpdateGroupPayload) => runMutation(() => updateGroup(groupId, payload), { operation: 'update_group' }),
    [runMutation]
  );

  const deleteGroupById = React.useCallback(
    (groupId: string) => runMutation(() => deleteGroup(groupId), { operation: 'delete_group' }),
    [runMutation]
  );

  const assignRoleToGroup = React.useCallback(
    (groupId: string, roleId: string) => runMutation(() => assignGroupRole(groupId, { roleId }), { operation: 'assign_group_role' }),
    [runMutation]
  );

  const removeRoleFromGroup = React.useCallback(
    (groupId: string, roleId: string) => runMutation(() => removeGroupRole(groupId, roleId), { operation: 'remove_group_role' }),
    [runMutation]
  );

  const assignGroupMembershipToGroup = React.useCallback(
    (groupId: string, payload: AssignGroupMembershipPayload) =>
      runMutation(() => assignGroupMembership(groupId, payload), { operation: 'assign_group_membership' }),
    [runMutation]
  );

  const removeGroupMembershipFromGroup = React.useCallback(
    (groupId: string, keycloakSubject: string) =>
      runMutation(() => removeGroupMembership(groupId, keycloakSubject), { operation: 'remove_group_membership' }),
    [runMutation]
  );

  return React.useMemo(
    () => ({
      groups: items,
      isLoading,
      error,
      mutationError,
      refetch,
      clearMutationError,
      createGroup: createGroupWithResult,
      updateGroup: updateGroupById,
      deleteGroup: deleteGroupById,
      loadGroupDetail,
      assignRole: assignRoleToGroup,
      removeRole: removeRoleFromGroup,
      assignMembership: assignGroupMembershipToGroup,
      removeMembership: removeGroupMembershipFromGroup,
    }),
    [
      assignGroupMembershipToGroup,
      assignRoleToGroup,
      clearMutationError,
      createGroupWithResult,
      deleteGroupById,
      error,
      isLoading,
      items,
      loadGroupDetail,
      mutationError,
      refetch,
      removeGroupMembershipFromGroup,
      removeRoleFromGroup,
      updateGroupById,
    ]
  );
};
