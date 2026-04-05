import { Link, useNavigate } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { asIamError, createRole, type IamHttpError } from '../../../lib/iam-api';
import { t } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/translate';

const ROLE_KEY_PATTERN = /^[a-z0-9_]+$/;

const roleErrorMessage = (error: IamHttpError | null, fallbackKey: TranslationKey): string => {
  if (!error) {
    return t(fallbackKey);
  }

  switch (error.code) {
    case 'invalid_request':
      return t('admin.roles.createDialog.errors.invalidRequest');
    case 'forbidden':
      return t('admin.roles.errors.forbidden');
    case 'csrf_validation_failed':
      return t('admin.roles.errors.csrfValidationFailed');
    case 'idempotency_key_reuse':
      return t('admin.roles.createDialog.errors.retry');
    case 'rate_limited':
      return t('admin.roles.errors.rateLimited');
    case 'conflict':
      return t('admin.roles.errors.conflict');
    case 'keycloak_unavailable':
      return t('admin.roles.errors.keycloakUnavailable');
    case 'database_unavailable':
      return t('admin.roles.errors.databaseUnavailable');
    default:
      return t(fallbackKey);
  }
};

export const RoleCreatePage = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [formValues, setFormValues] = React.useState({
    roleKey: '',
    displayName: '',
    description: '',
    roleLevel: '10',
  });

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMutationError(null);
    setValidationError(null);
    setIsSubmitting(true);

    try {
      const normalizedRoleKey = formValues.roleKey.trim().toLowerCase().replace(/\s+/g, '_');
      if (normalizedRoleKey.length < 3 || normalizedRoleKey.length > 64 || !ROLE_KEY_PATTERN.test(normalizedRoleKey)) {
        setValidationError(t('admin.roles.createDialog.errors.invalidRoleKey'));
        return;
      }
      const created = await createRole({
        roleName: normalizedRoleKey,
        displayName: formValues.displayName.trim() || undefined,
        description: formValues.description.trim() || undefined,
        roleLevel: Number(formValues.roleLevel),
        permissionIds: [],
      });

      await navigate({
        to: '/admin/roles/$roleId',
        params: { roleId: created.data.id },
      });
    } catch (error) {
      setMutationError(asIamError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-5" aria-busy={isSubmitting}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{t('admin.roles.createDialog.title')}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.roles.createDialog.description')}</p>
        </div>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/roles">{t('admin.roles.detail.backToList')}</Link>
        </Button>
      </header>

      <Card className="space-y-4 p-4">
        <form className="grid gap-4" onSubmit={onSubmit}>
          {validationError ? (
            <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-role-key">{t('admin.roles.createDialog.keyLabel')}</Label>
            <Input
              id="create-role-key"
              required
              value={formValues.roleKey}
              onChange={(event) => {
                setValidationError(null);
                setFormValues((current) => ({ ...current, roleKey: event.target.value }));
              }}
            />
            <p className="text-xs text-muted-foreground">{t('admin.roles.createDialog.keyHint')}</p>
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-role-name">{t('admin.roles.createDialog.nameLabel')}</Label>
            <Input
              id="create-role-name"
              value={formValues.displayName}
              onChange={(event) => setFormValues((current) => ({ ...current, displayName: event.target.value }))}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-role-description">{t('admin.roles.createDialog.descriptionLabel')}</Label>
            <Textarea
              id="create-role-description"
              value={formValues.description}
              onChange={(event) => setFormValues((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-role-level">{t('admin.roles.createDialog.levelLabel')}</Label>
            <Input
              id="create-role-level"
              required
              type="number"
              min={0}
              max={100}
              value={formValues.roleLevel}
              onChange={(event) => setFormValues((current) => ({ ...current, roleLevel: event.target.value }))}
            />
          </div>

          <div className="mt-2 flex justify-end gap-3">
            <Button asChild type="button" variant="outline">
              <Link to="/admin/roles">{t('account.actions.cancel')}</Link>
            </Button>
            <Button type="submit">{t('admin.roles.actions.create')}</Button>
          </div>
        </form>
      </Card>

      {mutationError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{roleErrorMessage(mutationError, 'admin.roles.createDialog.errors.submitFailed')}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
};
