import { Link, useNavigate } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  addStudioCreatedSaveFeedback,
  Button,
  getStudioFormFieldProps,
  StudioField,
  StudioFieldGroup,
  type StudioFormFieldError,
  StudioFormSummaryErrors,
  StudioPersistentFormError,
  StudioSaveButton,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Card } from '../../../components/ui/card';
import { IamRuntimeDiagnosticDetails } from '../../../components/iam-runtime-diagnostic-details';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { useGroups } from '../../../hooks/use-groups';
import { useRoles } from '../../../hooks/use-roles';
import { useUsers } from '../../../hooks/use-users';
import { t } from '../../../i18n';
import { userErrorMessage } from './-user-error-message';
import { selectAssignableGroups, selectAssignableRoles } from './user-assignment-options';
import { UserCreateAccountOptions } from './user-create-account-options';

const appendUnique = (values: readonly string[], nextValue: string): string[] =>
  values.includes(nextValue) ? [...values] : [...values, nextValue];

type UserCreateFormValues = {
  email: string;
  firstName: string;
  lastName: string;
  roleIds: string[];
  groupIds: string[];
  sendPasswordSetupEmail: boolean;
  isTechnicalAccount: boolean;
};

type UserCreateAssignmentsProps = {
  readonly selectedRoleIds: readonly string[];
  readonly selectedGroupIds: readonly string[];
  readonly roles: ReturnType<typeof useRoles>['roles'];
  readonly groups: ReturnType<typeof useGroups>['groups'];
  readonly onToggleRole: (roleId: string, checked: boolean) => void;
  readonly onToggleGroup: (groupId: string, checked: boolean) => void;
};

const createUserCreateSchema = () =>
  z.object({
    email: z.string().trim().email(t('account.validation.emailInvalid')),
    firstName: z.string().trim().min(1, t('account.validation.firstNameRequired')),
    lastName: z.string().trim().min(1, t('account.validation.lastNameRequired')),
    roleIds: z.array(z.string()),
    groupIds: z.array(z.string()),
    sendPasswordSetupEmail: z.boolean(),
    isTechnicalAccount: z.boolean(),
  });

const collectSummaryErrors = (
  fields: readonly ReturnType<typeof getStudioFormFieldProps>[]
): readonly StudioFormFieldError[] =>
  fields.flatMap((field) => (field.summaryError ? [field.summaryError] : []));

const UserCreateGroupAssignments = ({
  selectedGroupIds,
  groups,
  onToggleGroup,
}: Pick<UserCreateAssignmentsProps, 'selectedGroupIds' | 'groups' | 'onToggleGroup'>) => (
  <fieldset className="grid gap-3 rounded-lg border border-border/60 p-4">
    <legend className="px-1 text-sm font-medium text-foreground">
      {t('admin.users.createDialog.groupsLabel')}
    </legend>
    <p className="text-sm text-muted-foreground">{t('admin.users.createDialog.groupsHint')}</p>
    {groups.length === 0 ? (
      <p className="text-sm text-muted-foreground">{t('admin.users.createDialog.groupsEmpty')}</p>
    ) : (
      <div className="grid gap-3 md:grid-cols-2">
        {groups.map((group) => {
          const selected = selectedGroupIds.includes(group.id);
          return (
            <label
              key={group.id}
              htmlFor={`create-user-group-${group.id}`}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 p-3 text-sm text-foreground"
            >
              <Checkbox
                id={`create-user-group-${group.id}`}
                checked={selected}
                onChange={(event) => onToggleGroup(group.id, event.target.checked)}
              />
              <span className="space-y-1">
                <span className="block font-medium">{group.displayName}</span>
                {group.description ? (
                  <span className="block text-xs text-muted-foreground">{group.description}</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    )}
  </fieldset>
);

const UserCreateRoleAssignments = ({
  selectedRoleIds,
  roles,
  onToggleRole,
}: Pick<UserCreateAssignmentsProps, 'selectedRoleIds' | 'roles' | 'onToggleRole'>) => (
  <details className="rounded-lg border border-border/60">
    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground">
      {t('admin.users.createDialog.advancedRolesTitle')}
    </summary>
    <div className="grid gap-3 border-t border-border/60 px-4 py-4">
      <p className="text-sm text-muted-foreground">
        {t('admin.users.createDialog.advancedRolesHint')}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {roles.map((role) => {
          const selected = selectedRoleIds.includes(role.id);
          return (
            <label
              key={role.id}
              htmlFor={`create-user-role-${role.id}`}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 p-3 text-sm text-foreground"
            >
              <Checkbox
                id={`create-user-role-${role.id}`}
                checked={selected}
                onChange={(event) => onToggleRole(role.id, event.target.checked)}
              />
              <span className="block font-medium">{role.roleName}</span>
            </label>
          );
        })}
      </div>
      {roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('admin.users.createDialog.rolePlaceholder')}
        </p>
      ) : null}
    </div>
  </details>
);

const useCreateUserSave = (
  usersApi: ReturnType<typeof useUsers>,
  navigate: ReturnType<typeof useNavigate>,
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>
) =>
  React.useCallback(
    async (values: UserCreateFormValues) => {
      const operationId = saveFeedback.beginSaving();
      const created = await usersApi.createUser({
        email: values.email.trim(),
        firstName: values.firstName.trim() || undefined,
        lastName: values.lastName.trim() || undefined,
        displayName: `${values.firstName} ${values.lastName}`.trim() || undefined,
        roleIds: values.roleIds,
        groupIds: values.groupIds,
        sendPasswordSetupEmail: values.sendPasswordSetupEmail,
        isTechnicalAccount: values.isTechnicalAccount,
      });

      if (!created) {
        saveFeedback.markFailed(operationId);
        return;
      }

      const invitationSearch =
        created.invitation.status === 'failed'
          ? ({
              invite: 'failed',
              ...(created.invitation.error?.code
                ? { inviteCode: created.invitation.error.code }
                : {}),
              ...(created.invitation.error?.message
                ? { inviteMessage: created.invitation.error.message }
                : {}),
            } as const)
          : undefined;

      saveFeedback.markSaved(operationId);
      await navigate({
        to: '/admin/users/$userId',
        params: { userId: created.user.id },
        search: invitationSearch,
        state: (previous) => addStudioCreatedSaveFeedback(previous, 'users', created.user.id),
      });
    },
    [navigate, saveFeedback, usersApi]
  );

export const UserCreatePage = () => {
  const navigate = useNavigate();
  const usersApi = useUsers();
  const rolesApi = useRoles();
  const groupsApi = useGroups();
  const saveFeedback = useStudioSaveFeedback();
  const selectableRoles = React.useMemo(
    () => selectAssignableRoles(rolesApi.roles),
    [rolesApi.roles]
  );
  const userCreateSchema = React.useMemo(() => createUserCreateSchema(), []);
  const selectableGroups = React.useMemo(
    () => selectAssignableGroups(groupsApi.groups),
    [groupsApi.groups]
  );
  const form = useForm<UserCreateFormValues>({
    resolver: zodResolver(userCreateSchema as never),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      roleIds: [],
      groupIds: [],
      sendPasswordSetupEmail: true,
      isTechnicalAccount: false,
    },
    reValidateMode: 'onChange',
  });
  const {
    formState: { errors, isDirty },
    handleSubmit,
    register,
    setValue,
    watch,
  } = form;

  const emailField = getStudioFormFieldProps({
    id: 'create-user-email',
    error: errors.email,
  });
  const firstNameField = getStudioFormFieldProps({
    id: 'create-user-first-name',
    error: errors.firstName,
  });
  const lastNameField = getStudioFormFieldProps({
    id: 'create-user-last-name',
    error: errors.lastName,
  });
  const summaryErrors = collectSummaryErrors([emailField, firstNameField, lastNameField]);
  const selectedGroupIds = watch('groupIds');
  const selectedRoleIds = watch('roleIds');
  const sendPasswordSetupEmail = watch('sendPasswordSetupEmail');
  const isTechnicalAccount = watch('isTechnicalAccount');
  const saveUser = useCreateUserSave(usersApi, navigate, saveFeedback);

  React.useEffect(() => {
    if (isDirty) {
      saveFeedback.markDirty();
    }
  }, [isDirty, saveFeedback.markDirty]);

  const toggleGroup = React.useCallback(
    (groupId: string, checked: boolean) => {
      const nextValue = checked
        ? appendUnique(selectedGroupIds, groupId)
        : selectedGroupIds.filter((entry) => entry !== groupId);
      setValue('groupIds', nextValue, { shouldDirty: true });
    },
    [selectedGroupIds, setValue]
  );

  const toggleRole = React.useCallback(
    (roleId: string, checked: boolean) => {
      const nextValue = checked
        ? appendUnique(selectedRoleIds, roleId)
        : selectedRoleIds.filter((entry) => entry !== roleId);
      setValue('roleIds', nextValue, { shouldDirty: true });
    },
    [selectedRoleIds, setValue]
  );

  const onSubmit = handleSubmit(saveUser, () => saveFeedback.reset());

  return (
    <section className="space-y-5" aria-busy={saveFeedback.status === 'saving'}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            {t('admin.users.createDialog.title')}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {t('admin.users.createDialog.description')}
          </p>
        </div>
        <Button asChild type="button" variant="secondary">
          <Link to="/admin/users">{t('admin.users.detail.backToList')}</Link>
        </Button>
      </header>

      <Card className="space-y-4 p-4">
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <StudioFormSummaryErrors
            errors={summaryErrors}
            title={t('account.messages.validationSummary')}
          />
          <StudioField {...emailField} label={t('account.fields.email')} required>
            <Input {...register('email')} type="email" />
          </StudioField>
          <StudioFieldGroup columns={2}>
            <StudioField {...firstNameField} label={t('account.fields.firstName')} required>
              <Input {...register('firstName')} />
            </StudioField>
            <StudioField {...lastNameField} label={t('account.fields.lastName')} required>
              <Input {...register('lastName')} />
            </StudioField>
          </StudioFieldGroup>
          <UserCreateGroupAssignments
            selectedGroupIds={selectedGroupIds}
            groups={selectableGroups}
            onToggleGroup={toggleGroup}
          />
          <UserCreateRoleAssignments
            selectedRoleIds={selectedRoleIds}
            roles={selectableRoles}
            onToggleRole={toggleRole}
          />
          <UserCreateAccountOptions
            sendPasswordSetupEmail={sendPasswordSetupEmail}
            isTechnicalAccount={isTechnicalAccount}
            onSendPasswordSetupEmailChange={(checked) =>
              setValue('sendPasswordSetupEmail', checked, { shouldDirty: true })
            }
            onTechnicalAccountChange={(checked) =>
              setValue('isTechnicalAccount', checked, { shouldDirty: true })
            }
          />

          <div className="mt-2 flex justify-end gap-3">
            <Button asChild type="button" variant="secondary">
              <Link to="/admin/users">{t('account.actions.cancel')}</Link>
            </Button>
            <StudioSaveButton
              type="submit"
              status={saveFeedback.status}
              labels={{
                idle: t('admin.users.actions.create'),
                saving: t('account.actions.saving'),
                saved: t('account.actions.saved'),
              }}
            />
          </div>
        </form>
      </Card>

      {usersApi.mutationError ? (
        <StudioPersistentFormError
          message={userErrorMessage(usersApi.mutationError, 'mutation')}
          details={<IamRuntimeDiagnosticDetails error={usersApi.mutationError} />}
          retryLabel={t('account.actions.retry')}
          retryDisabled={saveFeedback.status === 'saving'}
          onRetry={() => void onSubmit()}
        />
      ) : null}
    </section>
  );
};
