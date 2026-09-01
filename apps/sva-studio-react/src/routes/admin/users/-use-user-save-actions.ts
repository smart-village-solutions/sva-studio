import { useStudioSaveFeedback } from '@sva/studio-ui-react';
import React from 'react';
import type { SubmitErrorHandler, UseFormReturn } from 'react-hook-form';

import { useUser } from '../../../hooks/use-user';
import { toUserFormValues, toUserUpdatePayload, type UserFormValues } from './user-edit-model';

export const useUserSaveActions = (
  userApi: ReturnType<typeof useUser>,
  form: UseFormReturn<UserFormValues>,
  hasUnsavedChanges: boolean,
  onInvalid?: SubmitErrorHandler<UserFormValues>
) => {
  const saveFeedback = useStudioSaveFeedback();
  const [isSendingPasswordSetupEmail, setIsSendingPasswordSetupEmail] = React.useState(false);
  const [isReprovisioningMainserverData, setIsReprovisioningMainserverData] = React.useState(false);
  const [passwordSetupEmailSuccess, setPasswordSetupEmailSuccess] = React.useState(false);
  const [mainserverReprovisionSuccess, setMainserverReprovisionSuccess] = React.useState(false);

  React.useEffect(() => {
    if (hasUnsavedChanges) {
      saveFeedback.markDirty();
    }
  }, [hasUnsavedChanges, saveFeedback.markDirty]);

  const saveUser = React.useCallback(
    async (formValues: UserFormValues) => {
      const operationId = saveFeedback.beginSaving();
      setPasswordSetupEmailSuccess(false);
      setMainserverReprovisionSuccess(false);

      const result = await userApi.save(toUserUpdatePayload(formValues));
      if (result) {
        form.reset(toUserFormValues(result));
        saveFeedback.markSaved(operationId);
      } else {
        saveFeedback.markFailed(operationId);
      }
    },
    [form, saveFeedback, userApi]
  );
  const onSave = React.useMemo(
    () =>
      form.handleSubmit(saveUser, (errors, event) => {
        saveFeedback.reset();
        onInvalid?.(errors, event);
      }),
    [form, onInvalid, saveFeedback, saveUser]
  );

  const onSendPasswordSetupEmail = React.useCallback(async () => {
    if (!userApi.resendPasswordSetupEmail || isSendingPasswordSetupEmail) {
      return;
    }

    setIsSendingPasswordSetupEmail(true);
    setPasswordSetupEmailSuccess(false);
    setMainserverReprovisionSuccess(false);
    const sent = await userApi.resendPasswordSetupEmail();
    if (sent) setPasswordSetupEmailSuccess(true);
    setIsSendingPasswordSetupEmail(false);
  }, [isSendingPasswordSetupEmail, userApi]);

  const onReprovisionMainserverData = React.useCallback(async () => {
    if (!userApi.reprovisionMainserverData || isReprovisioningMainserverData) {
      return;
    }

    setIsReprovisioningMainserverData(true);
    setPasswordSetupEmailSuccess(false);
    setMainserverReprovisionSuccess(false);
    const updated = await userApi.reprovisionMainserverData();
    if (updated) setMainserverReprovisionSuccess(true);
    setIsReprovisioningMainserverData(false);
  }, [isReprovisioningMainserverData, userApi]);

  return {
    isReprovisioningMainserverData,
    isSaving: saveFeedback.status === 'saving',
    isSendingPasswordSetupEmail,
    mainserverReprovisionSuccess,
    onReprovisionMainserverData,
    onSave,
    onSendPasswordSetupEmail,
    passwordSetupEmailSuccess,
    saveStatus: saveFeedback.status,
    showSaved: saveFeedback.showSaved,
  };
};
