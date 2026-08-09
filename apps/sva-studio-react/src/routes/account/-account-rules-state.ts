import type { IamDeletionContentStrategy, IamMyDeletionRulesOverview } from '@sva/core';
import { useStudioSaveFeedback } from '@sva/studio-ui-react';
import React from 'react';

import { getMyDeletionRules, saveMyDeletionRulesContentPreference } from '../../lib/iam-api';

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const useAccountRulesState = () => {
  const [deletionRules, setDeletionRules] = React.useState<IamMyDeletionRulesOverview | null>(null);
  const [contentPreferenceDraft, setContentPreferenceDraft] =
    React.useState<IamDeletionContentStrategy>('retain');
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const saveFeedback = useStudioSaveFeedback();

  const loadDeletionRules = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await getMyDeletionRules();
      setDeletionRules(response);
      setContentPreferenceDraft(response.contentPreference.effectiveStrategy);
    } catch (error) {
      setDeletionRules(null);
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadDeletionRules();
  }, [loadDeletionRules]);

  const saveContentPreference = React.useCallback(async () => {
    if (!deletionRules) {
      return;
    }

    const operationId = saveFeedback.beginSaving();
    setErrorMessage(null);
    try {
      const response = await saveMyDeletionRulesContentPreference({
        strategy:
          contentPreferenceDraft === deletionRules.rules.defaultContentStrategy
            ? undefined
            : contentPreferenceDraft,
      });
      setDeletionRules(response);
      setContentPreferenceDraft(response.contentPreference.effectiveStrategy);
      saveFeedback.markSaved(operationId);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
      saveFeedback.markFailed(operationId);
    }
  }, [contentPreferenceDraft, deletionRules, saveFeedback]);

  const updateContentPreferenceDraft = React.useCallback(
    (value: IamDeletionContentStrategy) => {
      saveFeedback.markDirty();
      setErrorMessage(null);
      setContentPreferenceDraft(value);
    },
    [saveFeedback]
  );

  return {
    contentPreferenceDraft,
    deletionRules,
    errorMessage,
    isLoading,
    isSaving: saveFeedback.status === 'saving',
    saveStatus: saveFeedback.status,
    saveContentPreference,
    setContentPreferenceDraft: updateContentPreferenceDraft,
  };
};
