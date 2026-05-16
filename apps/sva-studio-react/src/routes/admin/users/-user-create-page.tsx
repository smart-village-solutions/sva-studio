import { Link, useNavigate } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { IamRuntimeDiagnosticDetails } from '../../../components/iam-runtime-diagnostic-details';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
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
  readonly formValues: UserCreateFormValues;
  readonly roles: ReturnType<typeof useRoles>['roles'];
  readonly groups: ReturnType<typeof useGroups>['groups'];
  readonly setFormValues: React.Dispatch<React.SetStateAction<UserCreateFormValues>>;
};

const UserCreateGroupAssignments = ({
  formValues,
  groups,
  setFormValues,
}: Pick<UserCreateAssignmentsProps, 'formValues' | 'groups' | 'setFormValues'>) => (
  <fieldset className="grid gap-3 rounded-lg border border-border/60 p-4">
    <legend className="px-1 text-sm font-medium text-foreground">{t('admin.users.createDialog.groupsLabel')}</legend>
    <p className="text-sm text-muted-foreground">{t('admin.users.createDialog.groupsHint')}</p>
    {groups.length === 0 ? (
      <p className="text-sm text-muted-foreground">{t('admin.users.createDialog.groupsEmpty')}</p>
    ) : (
      <div className="grid gap-3 md:grid-cols-2">
        {groups.map((group) => {
          const selected = formValues.groupIds.includes(group.id);
          return (
            <label
              key={group.id}
              htmlFor={`create-user-group-${group.id}`}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 p-3 text-sm text-foreground"
            >
              <Checkbox
                id={`create-user-group-${group.id}`}
                checked={selected}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    groupIds: event.target.checked
                      ? appendUnique(current.groupIds, group.id)
                      : current.groupIds.filter((entry) => entry !== group.id),
                  }))
                }
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
  formValues,
  roles,
  setFormValues,
}: Pick<UserCreateAssignmentsProps, 'formValues' | 'roles' | 'setFormValues'>) => (
  <details className="rounded-lg border border-border/60">
    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground">
      {t('admin.users.createDialog.advancedRolesTitle')}
    </summary>
    <div className="grid gap-3 border-t border-border/60 px-4 py-4">
      <p className="text-sm text-muted-foreground">{t('admin.users.createDialog.advancedRolesHint')}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {roles.map((role) => {
          const selected = formValues.roleIds.includes(role.id);
          return (
            <label
              key={role.id}
              htmlFor={`create-user-role-${role.id}`}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 p-3 text-sm text-foreground"
            >
              <Checkbox
                id={`create-user-role-${role.id}`}
                checked={selected}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    roleIds: event.target.checked
                      ? appendUnique(current.roleIds, role.id)
                      : current.roleIds.filter((entry) => entry !== role.id),
                  }))
                }
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
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formValues, setFormValues] = React.useState<UserCreateFormValues>({
    email: '',
    firstName: '',
    lastName: '',
    roleIds: [] as string[],
    groupIds: [] as string[],
    sendPasswordSetupEmail: true,
  });

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await usersApi.createUser({
        email: formValues.email.trim(),
        firstName: formValues.firstName.trim() || undefined,
        lastName: formValues.lastName.trim() || undefined,
        displayName: `${formValues.firstName} ${formValues.lastName}`.trim() || undefined,
        roleIds: formValues.roleIds,
        groupIds: formValues.groupIds,
        sendPasswordSetupEmail: formValues.sendPasswordSetupEmail,
      });

      if (!created) {
        return;
      }

      await navigate({
        to: '/admin/users/$userId',
        params: { userId: created.user.id },
        search: created.invitation.status === 'failed' ? ({ invite: 'failed' } as const) : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-user-email">{t('account.fields.email')}</Label>
            <Input
              id="create-user-email"
              required
              type="email"
              value={formValues.email}
              onChange={(event) => setFormValues((current) => ({ ...current, email: event.target.value }))}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="create-user-first-name">{t('account.fields.firstName')}</Label>
              <Input
                id="create-user-first-name"
                required
                value={formValues.firstName}
                onChange={(event) => setFormValues((current) => ({ ...current, firstName: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-user-last-name">{t('account.fields.lastName')}</Label>
              <Input
                id="create-user-last-name"
                required
                value={formValues.lastName}
                onChange={(event) => setFormValues((current) => ({ ...current, lastName: event.target.value }))}
              />
            </div>
          </div>
          <UserCreateGroupAssignments
            formValues={formValues}
            groups={selectableGroups}
            setFormValues={setFormValues}
          />
          <UserCreateRoleAssignments
            formValues={formValues}
            roles={rolesApi.roles}
            setFormValues={setFormValues}
          />
          <div className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-3 text-sm text-foreground">
            <Checkbox
              id="create-user-send-password-setup-email"
              checked={formValues.sendPasswordSetupEmail}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, sendPasswordSetupEmail: event.target.checked }))
              }
            />
            <Label htmlFor="create-user-send-password-setup-email" className="cursor-pointer">
              {t('admin.users.createDialog.sendPasswordSetupEmail')}
            </Label>
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
