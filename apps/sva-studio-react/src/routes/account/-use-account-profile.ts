import type { IamUserDetail } from '@sva/core';
import { useStudioSaveFeedback } from '@sva/studio-ui-react';
import React from 'react';

import { asIamError, getMyProfile, type IamHttpError, updateMyProfile } from '../../lib/iam-api';
import { notifyIamUsersUpdated } from '../../lib/iam-user-events';
import {
  buildProfileUpdatePayload,
  EMPTY_PROFILE_FORM,
  type ProfileErrors,
  type ProfileField,
  type ProfileFormValues,
  toProfileFormValues,
  validateProfileForm,
} from './-account-profile-model';

type UseAccountProfileOptions = Readonly<{
  hasResolvedSession: boolean;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isProfileReadOnly: boolean;
}>;

export const useAccountProfile = ({
  hasResolvedSession,
  isAuthenticated,
  isAuthLoading,
  isProfileReadOnly,
}: UseAccountProfileOptions) => {
  const [profile, setProfile] = React.useState<IamUserDetail | null>(null);
  const [formValues, setFormValues] = React.useState<ProfileFormValues>(EMPTY_PROFILE_FORM);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<IamHttpError | null>(null);
  const [saveError, setSaveError] = React.useState<IamHttpError | null>(null);
  const [validationErrors, setValidationErrors] = React.useState<ProfileErrors>({});
  const errorSummaryRef = React.useRef<HTMLDivElement>(null);
  const saveFeedback = useStudioSaveFeedback();

  const loadProfile = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await getMyProfile();
      setProfile(response.data);
      setFormValues(toProfileFormValues(response.data));
    } catch (cause) {
      setLoadError(asIamError(cause));
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isAuthLoading || !hasResolvedSession) {
      return;
    }

    if (!isAuthenticated) {
      setProfile(null);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    loadProfile().catch(() => undefined);
  }, [hasResolvedSession, isAuthenticated, isAuthLoading, loadProfile]);

  React.useEffect(() => {
    if (Object.keys(validationErrors).length > 0) {
      errorSummaryRef.current?.focus();
    }
  }, [validationErrors]);

  const onFieldChange = (field: ProfileField, value: string) => {
    setFormValues((current) => ({ ...current, [field]: value }));
    saveFeedback.markDirty();
    setSaveError(null);
  };

  const saveProfile = async () => {
    if (isProfileReadOnly) {
      return;
    }

    const nextErrors = validateProfileForm(formValues);
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const operationId = saveFeedback.beginSaving();
    setSaveError(null);

    try {
      const response = await updateMyProfile(buildProfileUpdatePayload(formValues));
      setProfile(response.data);
      setFormValues(toProfileFormValues(response.data));
      notifyIamUsersUpdated();
      setValidationErrors({});
      saveFeedback.markSaved(operationId);
    } catch (cause) {
      setSaveError(asIamError(cause));
      saveFeedback.markFailed(operationId);
    }
  };

  return {
    errorSummaryRef,
    formValues,
    isLoading,
    loadError,
    onFieldChange,
    profile,
    retryLoad: loadProfile,
    saveError,
    saveFeedback,
    saveProfile,
    validationErrors,
  };
};
