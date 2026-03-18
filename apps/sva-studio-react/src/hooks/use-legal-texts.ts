import type { IamLegalTextListItem } from '@sva/core';

import {
  createLegalText,
  IamHttpError,
  listLegalTexts,
  updateLegalText,
  type CreateLegalTextPayload,
  type UpdateLegalTextPayload,
} from '../lib/iam-api';
import { useAuth } from '../providers/auth-provider';
import { useIamAdminList } from './use-iam-admin-list';

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
  const adminList = useIamAdminList(listLegalTexts, invalidatePermissions);

  return {
    legalTexts: adminList.items,
    isLoading: adminList.isLoading,
    error: adminList.error,
    mutationError: adminList.mutationError,
    refetch: adminList.refetch,
    clearMutationError: adminList.clearMutationError,
    createLegalText: (payload) => adminList.runMutation(() => createLegalText(payload)),
    updateLegalText: (legalTextVersionId, payload) =>
      adminList.runMutation(() => updateLegalText(legalTextVersionId, payload)),
  };
};
