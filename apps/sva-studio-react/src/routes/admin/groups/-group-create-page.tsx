import { Link, useNavigate } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { useGroups } from '../../../hooks/use-groups';
import { t } from '../../../i18n';
import {
  createGroupFormValues,
  groupErrorMessage,
  GroupTextFields,
  toCreateGroupPayload,
} from './-group-shared';

export const GroupCreatePage = () => {
  const navigate = useNavigate();
  const groupsApi = useGroups();
  const [formValues, setFormValues] = React.useState(createGroupFormValues);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const createdGroupId = await groupsApi.createGroup(toCreateGroupPayload(formValues));
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
          <GroupTextFields
            descriptionId="create-group-description"
            displayNameId="create-group-name"
            formValues={formValues}
            setFormValues={setFormValues}
          />
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
