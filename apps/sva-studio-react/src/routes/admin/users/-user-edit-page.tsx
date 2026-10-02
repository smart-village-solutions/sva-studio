import {
  Button,
  getStudioFormFieldProps,
  hasStudioCreatedSaveFeedback,
  removeStudioSaveFeedback,
  StudioFormActionBar,
  StudioFormSummaryErrors,
  StudioPageTitle,
  StudioPersistentFormError,
  StudioSaveButton,
} from '@sva/studio-ui-react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import * as React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { IamRuntimeDiagnosticDetails } from '../../../components/iam-runtime-diagnostic-details';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { isIamAccessAllowed, useIamResourceAccess } from '../../../hooks/use-iam-resource-access';
import { t } from '../../../i18n';
import { UserManagementPanel } from './-user-edit-management';
import { UserOrganizationsPanel } from './-user-edit-organizations';
import {
  UserEditHeader,
  UserEditTabs,
  UserHistoryPanel,
  UserPersonalPanel,
} from './-user-edit-overview';
import { UserPermissionsPanel } from './-user-edit-permissions';
import { userErrorMessage } from './-user-error-message';
import { useUserEditController } from './use-user-edit-controller';

type UserEditPageProps = {
  readonly userId: string;
  readonly invitationStatus?: 'failed';
  readonly invitationErrorMessage?: string;
};

export const UserEditPage = ({
  userId,
  invitationStatus,
  invitationErrorMessage,
}: UserEditPageProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const access = useIamResourceAccess('user');
  const roleAccess = useIamResourceAccess('role');
  const canUpdateUser = isIamAccessAllowed(access.update);
  const canManageKeycloakRoles = isIamAccessAllowed(roleAccess.update);
  const controller = useUserEditController({ userId });
  const {
    activateFormFieldTab,
    closeUnsavedDialog,
    confirmPendingTab,
    form,
    organizationMutationError,
    isSaving,
    mainserverReprovisionSuccess,
    onSave,
    passwordSetupEmailSuccess,
    resetFormValues,
    saveStatus,
    showSaved,
    unsavedDialogOpen,
    userApi,
  } = controller;
  const {
    formState: { errors },
  } = form;
  const emailField = getStudioFormFieldProps({ id: 'user-email', error: errors.email });
  const notesField = getStudioFormFieldProps({
    id: 'user-notes',
    error: errors.notes,
    hasDescription: true,
  });
  const summaryErrors = [emailField.summaryError, notesField.summaryError].filter(
    (error): error is NonNullable<typeof error> => error !== undefined
  );
  const initialSaveFeedbackShownRef = React.useRef(false);
  React.useEffect(() => {
    if (
      userApi.isLoading ||
      !userApi.user ||
      initialSaveFeedbackShownRef.current ||
      !hasStudioCreatedSaveFeedback(location.state, 'users', userId)
    ) {
      return;
    }

    initialSaveFeedbackShownRef.current = true;
    showSaved();
    void navigate({
      to: '/admin/users/$userId',
      params: { userId },
      search: true,
      replace: true,
      state: (previous) => removeStudioSaveFeedback(previous),
    });
  }, [location.state, navigate, showSaved, userApi.isLoading, userApi.user, userId]);

  const mutationError = userApi.mutationError ?? organizationMutationError;

  if (userApi.isLoading) {
    return (
      <section className="space-y-3" aria-busy="true">
        <StudioPageTitle withAccessory>{t('admin.users.edit.title')}</StudioPageTitle>
        <p role="status" className="text-sm text-muted-foreground">
          {t('admin.users.messages.loading')}
        </p>
      </section>
    );
  }

  if (!userApi.user) {
    return (
      <section className="space-y-3">
        <StudioPageTitle withAccessory>{t('admin.users.edit.title')}</StudioPageTitle>
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>{userErrorMessage(userApi.error)}</span>
            {userApi.error ? <IamRuntimeDiagnosticDetails error={userApi.error} /> : null}
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  return (
    <section className="space-y-5" aria-busy={isSaving}>
      <UserEditHeader controller={controller} user={userApi.user} canUpdateUser={canUpdateUser} />

      {canUpdateUser ? (
        <StudioFormActionBar position="start">
          <StudioSaveButton
            type="submit"
            form="user-edit-form"
            status={saveStatus}
            labels={{
              idle: t('admin.users.edit.save'),
              saving: t('account.actions.saving'),
              saved: t('account.actions.saved'),
            }}
          />
        </StudioFormActionBar>
      ) : null}

      <UserEditTabs controller={controller} />

      <form
        id="user-edit-form"
        className="space-y-4"
        aria-readonly={!canUpdateUser}
        onSubmit={canUpdateUser ? onSave : (event) => event.preventDefault()}
        noValidate
      >
        <fieldset className="contents" disabled={!canUpdateUser}>
          <StudioFormSummaryErrors
            errors={summaryErrors}
            title={t('account.messages.validationSummary')}
            onSelectError={({ field }) => activateFormFieldTab(field)}
          />
          <UserPersonalPanel controller={controller} user={userApi.user} emailField={emailField} />

          <UserManagementPanel
            controller={controller}
            user={userApi.user}
            userId={userId}
            canManageKeycloakRoles={canManageKeycloakRoles}
            notesField={notesField}
          />

          <UserPermissionsPanel controller={controller} user={userApi.user} />

          <UserOrganizationsPanel controller={controller} user={userApi.user} />

          <UserHistoryPanel controller={controller} />

          {mutationError ? (
            <StudioPersistentFormError
              message={userErrorMessage(mutationError, 'mutation')}
              details={<IamRuntimeDiagnosticDetails error={mutationError} />}
            />
          ) : null}
          {invitationStatus === 'failed' ? (
            <Alert className="border-secondary/40 bg-secondary/10 text-secondary" role="status">
              <AlertDescription>
                {invitationErrorMessage ?? t('admin.users.edit.invitationWarning')}
              </AlertDescription>
            </Alert>
          ) : null}
          {passwordSetupEmailSuccess ? (
            <Alert className="border-primary/40 bg-primary/10 text-primary" role="status">
              <AlertDescription>{t('admin.users.edit.passwordSetupEmailSuccess')}</AlertDescription>
            </Alert>
          ) : null}
          {mainserverReprovisionSuccess ? (
            <Alert className="border-primary/40 bg-primary/10 text-primary" role="status">
              <AlertDescription>
                {t('admin.users.edit.mainserverReprovisionSuccess')}
              </AlertDescription>
            </Alert>
          ) : null}

          <StudioFormActionBar>
            <Button type="button" variant="secondary" onClick={resetFormValues}>
              {t('account.actions.cancel')}
            </Button>
            <StudioSaveButton
              type="submit"
              status={saveStatus}
              labels={{
                idle: t('admin.users.edit.save'),
                saving: t('account.actions.saving'),
                saved: t('account.actions.saved'),
              }}
            />
          </StudioFormActionBar>
        </fieldset>
      </form>

      <ConfirmDialog
        open={unsavedDialogOpen}
        title={t('admin.users.edit.unsavedDialog.title')}
        description={t('admin.users.edit.unsavedDialog.description')}
        confirmLabel={t('admin.users.edit.unsavedDialog.confirm')}
        cancelLabel={t('admin.users.edit.unsavedDialog.cancel')}
        onCancel={closeUnsavedDialog}
        onConfirm={confirmPendingTab}
      />
    </section>
  );
};
