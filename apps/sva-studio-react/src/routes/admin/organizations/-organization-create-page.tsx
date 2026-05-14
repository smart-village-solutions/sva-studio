import { Link, useNavigate } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { useOrganizations } from '../../../hooks/use-organizations';
import { t } from '../../../i18n';
import {
  createOrganizationFormValues,
  OrganizationForm,
  organizationErrorMessage,
  toOrganizationMutationPayload,
} from './-organization-shared';

export const OrganizationCreatePage = () => {
  const navigate = useNavigate();
  const organizationsApi = useOrganizations();
  const [formValues, setFormValues] = React.useState(createOrganizationFormValues);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = await organizationsApi.createOrganization(toOrganizationMutationPayload(formValues));

    if (!created) {
      return;
    }

    await navigate({
      to: '/admin/organizations/$organizationId',
      params: { organizationId: created.id },
    });
  };

  return (
    <section className="space-y-5" aria-busy={organizationsApi.isLoading}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{t('admin.organizations.createDialog.title')}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.organizations.createDialog.description')}</p>
        </div>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/organizations">{t('admin.organizations.detail.backToList')}</Link>
        </Button>
      </header>

      <Card className="space-y-4 p-4">
        <OrganizationForm
          organizations={organizationsApi.organizations}
          onSubmit={(event) => void onSubmit(event)}
          setFormValues={setFormValues}
          submitLabel={t('admin.organizations.actions.create')}
          formValues={formValues}
          actions={
            <Button asChild type="button" variant="outline">
              <Link to="/admin/organizations">{t('account.actions.cancel')}</Link>
            </Button>
          }
        />
      </Card>

      {organizationsApi.mutationError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{organizationErrorMessage(organizationsApi.mutationError)}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
};
