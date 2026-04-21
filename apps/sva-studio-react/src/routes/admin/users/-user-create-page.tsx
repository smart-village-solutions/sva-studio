import { Link, useNavigate } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { IamRuntimeDiagnosticDetails } from '../../../components/iam-runtime-diagnostic-details';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { useRoles } from '../../../hooks/use-roles';
import { useUsers } from '../../../hooks/use-users';
import { t } from '../../../i18n';
import { userErrorMessage } from './-user-error-message';

export const UserCreatePage = () => {
  const navigate = useNavigate();
  const usersApi = useUsers();
  const rolesApi = useRoles();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formValues, setFormValues] = React.useState({
    email: '',
    firstName: '',
    lastName: '',
    roleId: '',
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
        roleIds: formValues.roleId ? [formValues.roleId] : [],
      });

      if (!created) {
        return;
      }

      await navigate({
        to: '/admin/users/$userId',
        params: { userId: created.id },
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
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-user-role">{t('admin.users.createDialog.roleLabel')}</Label>
            <Select
              id="create-user-role"
              value={formValues.roleId}
              onChange={(event) => setFormValues((current) => ({ ...current, roleId: event.target.value }))}
            >
              <option value="">{t('admin.users.createDialog.rolePlaceholder')}</option>
              {rolesApi.roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.roleName}
                </option>
              ))}
            </Select>
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

      {usersApi.error ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>{userErrorMessage(usersApi.error)}</span>
            <IamRuntimeDiagnosticDetails error={usersApi.error} />
          </AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
};
