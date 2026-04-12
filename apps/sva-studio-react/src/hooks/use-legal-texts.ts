import type { IamLegalTextListItem } from '@sva/core';

import {
  createLegalText,
  deleteLegalText,
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
  readonly createLegalText: (payload: CreateLegalTextPayload) => Promise<IamLegalTextListItem | null>;
  readonly updateLegalText: (legalTextVersionId: string, payload: UpdateLegalTextPayload) => Promise<boolean>;
  readonly deleteLegalText: (legalTextVersionId: string) => Promise<boolean>;
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
    createLegalText: (payload) =>
      adminList
        .runMutationWithResult(() => createLegalText(payload), {
          operation: 'create_legal_text',
          event: 'legal_text_mutation',
        })
        .then((response) => response?.data ?? null),
    updateLegalText: (legalTextVersionId, payload) =>
      adminList.runMutation(() => updateLegalText(legalTextVersionId, payload), {
        operation: 'update_legal_text',
        event: 'legal_text_mutation',
        legal_text_version_id: legalTextVersionId,
      }),
    deleteLegalText: (legalTextVersionId) =>
      adminList.runMutation(() => deleteLegalText(legalTextVersionId), {
        operation: 'delete_legal_text',
        event: 'legal_text_mutation',
        legal_text_version_id: legalTextVersionId,
      }),
  };
};
