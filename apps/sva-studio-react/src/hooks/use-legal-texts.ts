import type { IamLegalTextListItem } from '@sva/core';
import React from 'react';

import {
  asIamError,
  createLegalText,
  IamHttpError,
  listLegalTexts,
  updateLegalText,
  type CreateLegalTextPayload,
  type UpdateLegalTextPayload,
} from '../lib/iam-api';
import { useAuth } from '../providers/auth-provider';

type UseLegalTextsResult = {
  readonly legalTexts: readonly IamLegalTextListItem[];
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly mutationError: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly clearMutationError: () => void;
  readonly createLegalText: (payload: CreateLegalTextPayload) => Promise<boolean>;
  readonly updateLegalText: (legalTextVersionId: string, payload: UpdateLegalTextPayload) => Promise<boolean>;
};

export const useLegalTexts = (): UseLegalTextsResult => {
  const { invalidatePermissions } = useAuth();

  const [legalTexts, setLegalTexts] = React.useState<readonly IamLegalTextListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);

  const refetch = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listLegalTexts();
      setLegalTexts(response.data);
    } catch (cause) {
      const resolvedError = asIamError(cause);
      if (resolvedError.status === 403) {
        await invalidatePermissions();
      }
      setLegalTexts([]);
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
    legalTexts,
    isLoading,
    error,
    mutationError,
    refetch,
    clearMutationError: () => setMutationError(null),
    createLegalText: (payload) => mutate(() => createLegalText(payload)),
    updateLegalText: (legalTextVersionId, payload) => mutate(() => updateLegalText(legalTextVersionId, payload)),
  };
};
