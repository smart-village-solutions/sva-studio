import { Link, useNavigate } from '@tanstack/react-router';
import {
  addStudioCreatedSaveFeedback,
  Button,
  StudioPersistentFormError,
  StudioSaveButton,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import React from 'react';

import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { asIamError, createRole, type IamHttpError } from '../../../lib/iam-api';
import { t } from '../../../i18n';
import { roleErrorMessage } from './-roles-shared';

const CREATE_ROLE_ERROR_LABEL_KEYS = {
  invalid_request: 'admin.roles.createDialog.errors.invalidRequest',
  idempotency_key_reuse: 'admin.roles.createDialog.errors.retry',
} as const;

export const RoleCreatePage = () => {
  const navigate = useNavigate();
  const saveFeedback = useStudioSaveFeedback();
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);
  const [formValues, setFormValues] = React.useState({
    displayName: '',
    description: '',
  });

  const saveRole = async () => {
    setMutationError(null);
    const operationId = saveFeedback.beginSaving();
    try {
      const created = await createRole({
        displayName: formValues.displayName.trim(),
        description: formValues.description.trim() || undefined,
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
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-role-name">{t('admin.roles.createDialog.nameLabel')}</Label>
            <Input
              id="create-role-name"
              required
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
