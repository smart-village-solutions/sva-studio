import { Link, useNavigate } from '@tanstack/react-router';
import type { IamOrganizationType } from '@sva/core';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { useOrganizations } from '../../../hooks/use-organizations';
import { t, type TranslationKey } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

const ORGANIZATION_TYPE_KEYS = {
  county: 'admin.organizations.types.county',
  municipality: 'admin.organizations.types.municipality',
  district: 'admin.organizations.types.district',
  company: 'admin.organizations.types.company',
  agency: 'admin.organizations.types.agency',
  other: 'admin.organizations.types.other',
} satisfies Record<IamOrganizationType, TranslationKey>;

const typeOptions = Object.keys(ORGANIZATION_TYPE_KEYS) as IamOrganizationType[];

const organizationErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('admin.organizations.messages.error');
  }

  switch (error.code) {
    case 'forbidden':
      return t('admin.organizations.errors.forbidden');
    case 'csrf_validation_failed':
      return t('admin.organizations.errors.csrfValidationFailed');
    case 'rate_limited':
      return t('admin.organizations.errors.rateLimited');
    case 'conflict':
      return t('admin.organizations.errors.conflict');
    case 'invalid_organization_id':
      return t('admin.organizations.errors.invalidOrganization');
    case 'organization_inactive':
      return t('admin.organizations.errors.organizationInactive');
    case 'database_unavailable':
      return t('admin.organizations.errors.databaseUnavailable');
    default:
      return t('admin.organizations.messages.error');
  }
};

export const OrganizationCreatePage = () => {
  const navigate = useNavigate();
  const organizationsApi = useOrganizations();
  const [formValues, setFormValues] = React.useState({
    organizationKey: '',
    displayName: '',
    organizationType: 'other' as IamOrganizationType,
    parentOrganizationId: '',
    contentAuthorPolicy: 'org_only' as 'org_only' | 'org_or_personal',
  });

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = await organizationsApi.createOrganization({
      organizationKey: formValues.organizationKey.trim(),
      displayName: formValues.displayName.trim(),
      organizationType: formValues.organizationType,
      parentOrganizationId: formValues.parentOrganizationId || undefined,
      contentAuthorPolicy: formValues.contentAuthorPolicy,
    });

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
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="grid gap-1 text-sm text-foreground">
            <Label htmlFor="organization-key">{t('admin.organizations.form.keyLabel')}</Label>
            <Input
              id="organization-key"
              value={formValues.organizationKey}
              onChange={(event) => setFormValues((current) => ({ ...current, organizationKey: event.target.value }))}
            />
          </div>
          <div className="grid gap-1 text-sm text-foreground">
            <Label htmlFor="organization-name">{t('admin.organizations.form.nameLabel')}</Label>
            <Input
              id="organization-name"
              value={formValues.displayName}
              onChange={(event) => setFormValues((current) => ({ ...current, displayName: event.target.value }))}
            />
          </div>
          <div className="grid gap-1 text-sm text-foreground md:grid-cols-2 md:gap-4">
            <div className="grid gap-1">
              <Label htmlFor="organization-type">{t('admin.organizations.form.typeLabel')}</Label>
              <Select
                id="organization-type"
                value={formValues.organizationType}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, organizationType: event.target.value as IamOrganizationType }))
                }
              >
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {t(ORGANIZATION_TYPE_KEYS[type])}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="organization-policy">{t('admin.organizations.form.policyLabel')}</Label>
              <Select
                id="organization-policy"
                value={formValues.contentAuthorPolicy}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    contentAuthorPolicy: event.target.value as 'org_only' | 'org_or_personal',
                  }))
                }
              >
                <option value="org_only">{t('admin.organizations.policies.orgOnly')}</option>
                <option value="org_or_personal">{t('admin.organizations.policies.orgOrPersonal')}</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-1 text-sm text-foreground">
            <Label htmlFor="organization-parent">{t('admin.organizations.form.parentLabel')}</Label>
            <Select
              id="organization-parent"
              value={formValues.parentOrganizationId}
              onChange={(event) => setFormValues((current) => ({ ...current, parentOrganizationId: event.target.value }))}
            >
              <option value="">{t('admin.organizations.form.parentNone')}</option>
              {organizationsApi.organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.displayName}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button asChild type="button" variant="outline">
              <Link to="/admin/organizations">{t('account.actions.cancel')}</Link>
            </Button>
            <Button type="submit">{t('admin.organizations.actions.create')}</Button>
          </div>
        </form>
      </Card>

      {organizationsApi.mutationError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{organizationErrorMessage(organizationsApi.mutationError)}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
};
