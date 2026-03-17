import type { IamGroupListItem } from '@sva/core';

import {
  createGroup,
  deleteGroup,
  IamHttpError,
  listGroups,
  updateGroup,
  type CreateGroupPayload,
  type UpdateGroupPayload,
} from '../lib/iam-api';
import { useAuth } from '../providers/auth-provider';
import { useIamAdminList } from './use-iam-admin-list';

type UseGroupsResult = {
  readonly groups: readonly IamGroupListItem[];
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly mutationError: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly clearMutationError: () => void;
  readonly createGroup: (payload: CreateGroupPayload) => Promise<boolean>;
  readonly updateGroup: (groupId: string, payload: UpdateGroupPayload) => Promise<boolean>;
  readonly deleteGroup: (groupId: string) => Promise<boolean>;
};

export const useGroups = (): UseGroupsResult => {
  const { invalidatePermissions } = useAuth();
  const adminList = useIamAdminList(listGroups, invalidatePermissions);

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
  };
};
