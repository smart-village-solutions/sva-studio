import type { IamDeletionContentStrategy, IamMyDeletionRulesOverview } from '@sva/core';
import React from 'react';

import {
  getMyDeletionRules,
  getMyDataSubjectRights,
  saveMyDeletionRulesContentPreference,
} from '../../lib/iam-api';
import { t } from '../../i18n';

type PrivacyOverview = Awaited<ReturnType<typeof getMyDataSubjectRights>>['data'];

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const useAccountPrivacyState = () => {
  const [overview, setOverview] = React.useState<PrivacyOverview | null>(null);
  const [deletionRules, setDeletionRules] = React.useState<IamMyDeletionRulesOverview | null>(null);
  const [hasDeletionRulesAccess, setHasDeletionRulesAccess] = React.useState(false);
  const [contentPreferenceDraft, setContentPreferenceDraft] = React.useState<IamDeletionContentStrategy>('retain');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingDeletionRules, setIsLoadingDeletionRules] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSavingDeletionRules, setIsSavingDeletionRules] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [deletionRulesError, setDeletionRulesError] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [deletionRulesStatusMessage, setDeletionRulesStatusMessage] = React.useState<string | null>(null);

  const loadOverview = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await getMyDataSubjectRights();
      setOverview(response.data);
    } catch (error) {
      setOverview(null);
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const loadDeletionRules = React.useCallback(async () => {
    setIsLoadingDeletionRules(true);
    setDeletionRulesError(null);
    setHasDeletionRulesAccess(false);
    try {
      const response = await getMyDeletionRules();
      setHasDeletionRulesAccess(true);
      setDeletionRules(response);
      setContentPreferenceDraft(response.contentPreference.effectiveStrategy);
    } catch (error) {
      setDeletionRules(null);
      const status = typeof error === 'object' && error && 'status' in error ? (error as { status?: unknown }).status : undefined;
      if (status === 403) {
        setHasDeletionRulesAccess(false);
        setDeletionRulesError(null);
      } else {
        setHasDeletionRulesAccess(false);
        setDeletionRulesError(toErrorMessage(error));
      }
    } finally {
      setIsLoadingDeletionRules(false);
    }
  }, []);

  React.useEffect(() => {
    void loadDeletionRules();
  }, [loadDeletionRules]);

  const runAction = React.useCallback(
    async (work: () => Promise<void>) => {
      setIsSubmitting(true);
      setErrorMessage(null);
      setStatusMessage(null);
      try {
        await work();
        await loadOverview();
      } catch (error) {
        setErrorMessage(toErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadOverview]
  );

  const saveDeletionRulesPreference = React.useCallback(async () => {
    setIsSavingDeletionRules(true);
    setDeletionRulesError(null);
    setDeletionRulesStatusMessage(null);
    try {
      const response = await saveMyDeletionRulesContentPreference({
        strategy:
          deletionRules && contentPreferenceDraft === deletionRules.rules.defaultContentStrategy
            ? undefined
            : contentPreferenceDraft,
      });
      setDeletionRules(response);
      setContentPreferenceDraft(response.contentPreference.effectiveStrategy);
      setDeletionRulesStatusMessage(t('account.privacy.deletionRules.messages.saveSuccess'));
    } catch (error) {
      setDeletionRulesError(toErrorMessage(error));
    } finally {
      setIsSavingDeletionRules(false);
    }
  }, [contentPreferenceDraft, deletionRules]);

  return {
    contentPreferenceDraft,
    deletionRules,
    deletionRulesError,
    deletionRulesStatusMessage,
    errorMessage,
    hasDeletionRulesAccess,
    isLoading,
    isLoadingDeletionRules,
    isSavingDeletionRules,
    isSubmitting,
    overview,
    runAction,
    saveDeletionRulesPreference,
    setContentPreferenceDraft,
    setErrorMessage,
    setStatusMessage,
    statusMessage,
  };
};
