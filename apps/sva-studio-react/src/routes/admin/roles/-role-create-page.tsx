import { Link, useNavigate } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  addStudioCreatedSaveFeedback,
  Button,
  getStudioFormFieldProps,
  StudioField,
  StudioFormSummaryErrors,
  StudioPageTitle,
  StudioPersistentFormError,
  StudioSaveButton,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { asIamError, createRole, type IamHttpError } from '../../../lib/iam-api';
import { t } from '../../../i18n';
import { roleErrorMessage } from './-roles-shared';

const CREATE_ROLE_ERROR_LABEL_KEYS = {
  invalid_request: 'admin.roles.createDialog.errors.invalidRequest',
  idempotency_key_reuse: 'admin.roles.createDialog.errors.retry',
} as const;

type RoleCreateFormValues = {
  displayName: string;
  description: string;
};

const createRoleCreateSchema = () =>
  z.object({
    displayName: z.string().trim().min(1, t('admin.roles.createDialog.errors.displayNameRequired')),
    description: z.string().trim(),
  });

export const RoleCreatePage = () => {
  const navigate = useNavigate();
  const saveFeedback = useStudioSaveFeedback();
  const [mutationError, setMutationError] = React.useState<IamHttpError | null>(null);
  const roleCreateSchema = React.useMemo(() => createRoleCreateSchema(), []);
  const form = useForm<RoleCreateFormValues>({
    resolver: zodResolver(roleCreateSchema as never),
    defaultValues: {
      displayName: '',
      description: '',
    },
    reValidateMode: 'onChange',
  });
  const {
    formState: { errors, isDirty },
    handleSubmit,
    register,
  } = form;
  const displayNameField = getStudioFormFieldProps({
    id: 'create-role-name',
    error: errors.displayName,
  });
  const summaryErrors = displayNameField.summaryError ? [displayNameField.summaryError] : [];

  React.useEffect(() => {
    if (isDirty) {
      saveFeedback.markDirty();
    }
  }, [isDirty, saveFeedback.markDirty]);

  const saveRole = async (values: RoleCreateFormValues) => {
    setMutationError(null);
    const operationId = saveFeedback.beginSaving();
    try {
      const created = await createRole({
        displayName: values.displayName,
        description: values.description || undefined,
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

  const onSubmit = handleSubmit(saveRole, () => saveFeedback.reset());

  return (
    <section className="space-y-5" aria-busy={saveFeedback.status === 'saving'}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <StudioPageTitle withAccessory>{t('admin.roles.createDialog.title')}</StudioPageTitle>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {t('admin.roles.createDialog.description')}
          </p>
        </div>
        <Button asChild type="button" variant="secondary">
          <Link to="/admin/roles">{t('admin.roles.detail.backToList')}</Link>
        </Button>
      </header>

      <Card className="space-y-4 p-4">
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <StudioFormSummaryErrors
            errors={summaryErrors}
            title={t('account.messages.validationSummary')}
          />
          <StudioField
            {...displayNameField}
            label={t('admin.roles.createDialog.nameLabel')}
            required
          >
            <Input
              {...register('displayName', {
                onChange: () => setMutationError(null),
              })}
            />
          </StudioField>
          <StudioField
            id="create-role-description"
            label={t('admin.roles.createDialog.descriptionLabel')}
          >
            <Textarea
              {...register('description', {
                onChange: () => setMutationError(null),
              })}
              id="create-role-description"
            />
          </StudioField>
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
          onRetry={() => void onSubmit()}
        />
      ) : null}
    </section>
  );
};
