import type { IamGroupListItem } from '@sva/core';
import React from 'react';

import {
  asIamError,
  createGroup,
  deleteGroup,
  IamHttpError,
  listGroups,
  updateGroup,
  type CreateGroupPayload,
  type UpdateGroupPayload,
} from '../lib/iam-api';
import { useAuth } from '../providers/auth-provider';

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

  const [groups, setGroups] = React.useState<readonly IamGroupListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);

  const refetch = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listGroups();
      setGroups(response.data);
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 403) {
        await invalidatePermissions();
      }
      setGroups([]);
      setError(resolvedError);
    } finally {
      setIsLoading(false);
    }
  }, [invalidatePermissions]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const mutate = React.useCallback(
    async (action: () => Promise<unknown>) => {
      setMutationError(null);
      try {
        await action();
        await refetch();
        return true;
      } catch (cause) {
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 403) {
          await invalidatePermissions();
        }
        setMutationError(resolvedError);
        return false;
      }
    },
    [invalidatePermissions, refetch]
  );

  return {
    groups,
    isLoading,
    error,
    mutationError,
    refetch,
    clearMutationError: () => setMutationError(null),
    createGroup: (payload) => mutate(() => createGroup(payload)),
    updateGroup: (groupId, payload) => mutate(() => updateGroup(groupId, payload)),
    deleteGroup: (groupId) => mutate(() => deleteGroup(groupId)),
  };
};
