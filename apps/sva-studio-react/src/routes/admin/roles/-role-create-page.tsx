import { Link, useNavigate } from '@tanstack/react-router';
import {
  addStudioCreatedSaveFeedback,
  Button,
  StudioPersistentFormError,
  StudioSaveButton,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { asIamError, createRole, type IamHttpError } from '../../../lib/iam-api';
import { t } from '../../../i18n';
import { roleErrorMessage } from './-roles-shared';

const ROLE_KEY_PATTERN = /^[a-z0-9_]+$/;

const CREATE_ROLE_ERROR_LABEL_KEYS = {
  invalid_request: 'admin.roles.createDialog.errors.invalidRequest',
  idempotency_key_reuse: 'admin.roles.createDialog.errors.retry',
} as const;

export const RoleCreatePage = () => {
  const navigate = useNavigate();
  const saveFeedback = useStudioSaveFeedback();
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [formValues, setFormValues] = React.useState({
    roleKey: '',
    displayName: '',
    description: '',
    roleLevel: '10',
  });

  const saveRole = async () => {
    setMutationError(null);
    setValidationError(null);

    const normalizedRoleKey = formValues.roleKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (
      normalizedRoleKey.length < 3 ||
      normalizedRoleKey.length > 64 ||
      !ROLE_KEY_PATTERN.test(normalizedRoleKey)
    ) {
      setValidationError(t('admin.roles.createDialog.errors.invalidRoleKey'));
      return;
    }

    const operationId = saveFeedback.beginSaving();
    try {
      const created = await createRole({
        roleName: normalizedRoleKey,
        displayName: formValues.displayName.trim() || undefined,
        description: formValues.description.trim() || undefined,
        roleLevel: Number(formValues.roleLevel),
        permissionIds: [],
      });

      saveFeedback.markSaved(operationId);
      await navigate({
        to: '/admin/roles/$roleId',
        params: { roleId: created.data.id },
        state: (previous) => addStudioCreatedSaveFeedback(previous, 'roles', created.data.id),
      });
    } catch (error) {
      setMutationError(asIamError(error));
      saveFeedback.markFailed(operationId);
    }
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void saveRole();
  };

  const updateFormValues: typeof setFormValues = (value) => {
    saveFeedback.markDirty();
    setMutationError(null);
    setFormValues(value);
  };

  return (
    <section className="space-y-5" aria-busy={saveFeedback.status === 'saving'}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            {t('admin.roles.createDialog.title')}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {t('admin.roles.createDialog.description')}
          </p>
        </div>
        <Button asChild type="button" variant="secondary">
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
                updateFormValues((current) => ({ ...current, roleKey: event.target.value }));
              }}
            />
            <p className="text-xs text-muted-foreground">{t('admin.roles.createDialog.keyHint')}</p>
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-role-name">{t('admin.roles.createDialog.nameLabel')}</Label>
            <Input
              id="create-role-name"
              value={formValues.displayName}
              onChange={(event) =>
                updateFormValues((current) => ({ ...current, displayName: event.target.value }))
              }
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-role-description">
              {t('admin.roles.createDialog.descriptionLabel')}
            </Label>
            <Textarea
              id="create-role-description"
              value={formValues.description}
              onChange={(event) =>
                updateFormValues((current) => ({ ...current, description: event.target.value }))
              }
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
              onChange={(event) =>
                updateFormValues((current) => ({ ...current, roleLevel: event.target.value }))
              }
            />
          </div>

          <div className="mt-2 flex justify-end gap-3">
            <Button asChild type="button" variant="secondary">
              <Link to="/admin/roles">{t('account.actions.cancel')}</Link>
            </Button>
            <StudioSaveButton
              type="submit"
              status={saveFeedback.status}
              labels={{
                idle: t('admin.roles.actions.create'),
                saving: t('account.actions.saving'),
                saved: t('account.actions.saved'),
              }}
            />
          </div>
        </form>
      </Card>

      {mutationError ? (
        <StudioPersistentFormError
          message={roleErrorMessage(mutationError, 'admin.roles.createDialog.errors.submitFailed', {
            codeLabelKeys: CREATE_ROLE_ERROR_LABEL_KEYS,
          })}
          retryLabel={t('account.actions.retry')}
          retryDisabled={saveFeedback.status === 'saving'}
          onRetry={() => void saveRole()}
        />
      ) : null}
    </section>
  );
};
