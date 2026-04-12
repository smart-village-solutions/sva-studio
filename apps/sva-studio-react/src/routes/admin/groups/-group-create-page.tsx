import { Link, useNavigate } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { useGroups } from '../../../hooks/use-groups';
import { t } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/translate';
import type { IamHttpError } from '../../../lib/iam-api';

const groupErrorMessage = (error: IamHttpError | null, fallbackKey: TranslationKey): string => {
  if (!error) {
    return t(fallbackKey);
  }

  switch (error.code) {
    case 'forbidden':
      return t('admin.groups.errors.forbidden');
    case 'csrf_validation_failed':
      return t('admin.groups.errors.csrfValidationFailed');
    case 'rate_limited':
      return t('admin.groups.errors.rateLimited');
    case 'conflict':
      return t('admin.groups.errors.conflict');
    case 'database_unavailable':
      return t('admin.groups.errors.databaseUnavailable');
    default:
      return t(fallbackKey);
  }
};

export const GroupCreatePage = () => {
  const navigate = useNavigate();
  const groupsApi = useGroups();
  const [formValues, setFormValues] = React.useState({
    groupKey: '',
    displayName: '',
    description: '',
  });

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const createdGroupId = await groupsApi.createGroup({
      groupKey: formValues.groupKey.trim().toLowerCase().replace(/\s+/g, '_'),
      displayName: formValues.displayName.trim(),
      description: formValues.description.trim() || undefined,
    });
    if (!createdGroupId) {
      return;
    }

    await navigate({
      to: '/admin/groups/$groupId',
      params: { groupId: createdGroupId },
    });
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{t('admin.groups.dialogs.createTitle')}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.groups.dialogs.createDescription')}</p>
        </div>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/groups">{t('admin.groups.detail.backToList')}</Link>
        </Button>
      </header>

      <Card className="space-y-4 p-4">
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-group-key">{t('admin.groups.dialogs.keyLabel')}</Label>
            <Input
              id="create-group-key"
              required
              value={formValues.groupKey}
              onChange={(event) => setFormValues((current) => ({ ...current, groupKey: event.target.value }))}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-group-name">{t('admin.groups.dialogs.displayNameLabel')}</Label>
            <Input
              id="create-group-name"
              required
              value={formValues.displayName}
              onChange={(event) => setFormValues((current) => ({ ...current, displayName: event.target.value }))}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-group-description">{t('admin.groups.dialogs.descriptionLabel')}</Label>
            <Textarea
              id="create-group-description"
              value={formValues.description}
              onChange={(event) => setFormValues((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
          <div className="mt-2 flex justify-end gap-3">
            <Button asChild type="button" variant="outline">
              <Link to="/admin/groups">{t('account.actions.cancel')}</Link>
            </Button>
            <Button type="submit">{t('admin.groups.actions.create')}</Button>
          </div>
        </form>
      </Card>

      {groupsApi.mutationError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{groupErrorMessage(groupsApi.mutationError, 'admin.groups.messages.error')}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
};
