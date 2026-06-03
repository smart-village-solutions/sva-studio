import type { IamDeletionContentStrategy, IamMyDeletionRulesOverview } from '@sva/core';
import React from 'react';

import { getMyDeletionRules, saveMyDeletionRulesContentPreference } from '../../lib/iam-api';
import { t } from '../../i18n';

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const useAccountRulesState = () => {
  const [deletionRules, setDeletionRules] = React.useState<IamMyDeletionRulesOverview | null>(null);
  const [contentPreferenceDraft, setContentPreferenceDraft] = React.useState<IamDeletionContentStrategy>('retain');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

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

    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const response = await saveMyDeletionRulesContentPreference({
        strategy:
          contentPreferenceDraft === deletionRules.rules.defaultContentStrategy ? undefined : contentPreferenceDraft,
      });
      setDeletionRules(response);
      setContentPreferenceDraft(response.contentPreference.effectiveStrategy);
      setStatusMessage(t('account.rules.messages.saveSuccess'));
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [contentPreferenceDraft, deletionRules]);

  return {
    contentPreferenceDraft,
    deletionRules,
    errorMessage,
    isLoading,
    isSaving,
    saveContentPreference,
    setContentPreferenceDraft,
    statusMessage,
  };
};
