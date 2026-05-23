import { Link, useNavigate } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  StudioField,
  StudioFieldGroup,
  StudioFormSummaryErrors,
  getStudioFormFieldProps,
  type StudioFormFieldError,
} from '@sva/studio-ui-react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { IamRuntimeDiagnosticDetails } from '../../../components/iam-runtime-diagnostic-details';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { useGroups } from '../../../hooks/use-groups';
import { useRoles } from '../../../hooks/use-roles';
import { useUsers } from '../../../hooks/use-users';
import { t } from '../../../i18n';
import { userErrorMessage } from './-user-error-message';

const appendUnique = (values: readonly string[], nextValue: string): string[] =>
  values.includes(nextValue) ? [...values] : [...values, nextValue];

type UserCreateFormValues = {
  email: string;
  firstName: string;
  lastName: string;
  roleIds: string[];
  groupIds: string[];
  sendPasswordSetupEmail: boolean;
};

type UserCreateAssignmentsProps = {
  readonly selectedRoleIds: readonly string[];
  readonly selectedGroupIds: readonly string[];
  readonly roles: ReturnType<typeof useRoles>['roles'];
  readonly groups: ReturnType<typeof useGroups>['groups'];
  readonly onToggleRole: (roleId: string, checked: boolean) => void;
  readonly onToggleGroup: (groupId: string, checked: boolean) => void;
};

const userCreateSchema = z.object({
  email: z.string().trim().email(t('account.validation.emailInvalid')),
  firstName: z.string().trim().min(1, t('account.validation.firstNameRequired')),
  lastName: z.string().trim().min(1, t('account.validation.lastNameRequired')),
  roleIds: z.array(z.string()),
  groupIds: z.array(z.string()),
  sendPasswordSetupEmail: z.boolean(),
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
    <legend className="px-1 text-sm font-medium text-foreground">{t('admin.users.createDialog.groupsLabel')}</legend>
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
      <p className="text-sm text-muted-foreground">{t('admin.users.createDialog.advancedRolesHint')}</p>
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
        <p className="text-sm text-muted-foreground">{t('admin.users.createDialog.rolePlaceholder')}</p>
      ) : null}
    </div>
  </details>
);

export const UserCreatePage = () => {
  const navigate = useNavigate();
  const usersApi = useUsers();
  const rolesApi = useRoles();
  const groupsApi = useGroups();
  const selectableGroups = React.useMemo(
    () => groupsApi.groups.filter((group) => group.isActive !== false),
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
    },
    reValidateMode: 'onChange',
  });
  const {
    formState: { errors, isSubmitting },
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

  const onSubmit = handleSubmit(async (values) => {
    const created = await usersApi.createUser({
      email: values.email.trim(),
      firstName: values.firstName.trim() || undefined,
      lastName: values.lastName.trim() || undefined,
      displayName: `${values.firstName} ${values.lastName}`.trim() || undefined,
      roleIds: values.roleIds,
      groupIds: values.groupIds,
      sendPasswordSetupEmail: values.sendPasswordSetupEmail,
    });

    if (!created) {
      return;
    }

    await navigate({
      to: '/admin/users/$userId',
      params: { userId: created.user.id },
      search: created.invitation.status === 'failed' ? ({ invite: 'failed' } as const) : undefined,
    });
  });

  return (
    <section className="space-y-5" aria-busy={isSubmitting}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{t('admin.users.createDialog.title')}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.users.createDialog.description')}</p>
        </div>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/users">{t('admin.users.detail.backToList')}</Link>
        </Button>
      </header>

      <Card className="space-y-4 p-4">
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <StudioFormSummaryErrors errors={summaryErrors} title={t('account.messages.validationSummary')} />
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
            roles={rolesApi.roles}
            onToggleRole={toggleRole}
          />
          <div className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-3 text-sm text-foreground">
            <Checkbox
              id="create-user-send-password-setup-email"
              checked={sendPasswordSetupEmail}
              onChange={(event) =>
                setValue('sendPasswordSetupEmail', event.target.checked, {
                  shouldDirty: true,
                })
              }
            />
            <label htmlFor="create-user-send-password-setup-email" className="cursor-pointer text-sm font-medium">
              {t('admin.users.createDialog.sendPasswordSetupEmail')}
            </label>
          </div>

          <div className="mt-2 flex justify-end gap-3">
            <Button asChild type="button" variant="outline">
              <Link to="/admin/users">{t('account.actions.cancel')}</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('admin.users.actions.creating') : t('admin.users.actions.create')}
            </Button>
          </div>
        </form>
      </Card>

      {usersApi.mutationError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>{userErrorMessage(usersApi.mutationError, 'mutation')}</span>
            <IamRuntimeDiagnosticDetails error={usersApi.mutationError} />
          </AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
};
