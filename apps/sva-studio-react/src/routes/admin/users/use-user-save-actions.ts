import { useStudioSaveFeedback } from '@sva/studio-ui-react';
import React from 'react';

import { useUser } from '../../../hooks/use-user';
import { toUserFormValues, toUserUpdatePayload, type UserFormValues } from './user-edit-model';

export const useUserSaveActions = (
  userApi: ReturnType<typeof useUser>,
  formValues: UserFormValues,
  setFormValues: React.Dispatch<React.SetStateAction<UserFormValues>>,
  hasUnsavedChanges: boolean
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
  }, [hasUnsavedChanges, saveFeedback]);

  const onSave = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const operationId = saveFeedback.beginSaving();
      setPasswordSetupEmailSuccess(false);
      setMainserverReprovisionSuccess(false);

      const result = await userApi.save(toUserUpdatePayload(formValues));
      if (result) {
        setFormValues(toUserFormValues(result));
        saveFeedback.markSaved(operationId);
      } else {
        saveFeedback.markFailed(operationId);
      }
    },
    [formValues, saveFeedback, setFormValues, userApi]
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
