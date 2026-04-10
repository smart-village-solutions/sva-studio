import { Link } from '@tanstack/react-router';
import type { IamOrganizationType } from '@sva/core';
import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { useOrganizations } from '../../../hooks/use-organizations';
import { useUsers } from '../../../hooks/use-users';
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

type OrganizationDetailPageProps = {
  readonly organizationId: string;
};

export const OrganizationDetailPage = ({ organizationId }: OrganizationDetailPageProps) => {
  const organizationsApi = useOrganizations();
  const usersApi = useUsers({ pageSize: 100 });
  const [membershipForm, setMembershipForm] = React.useState({
    accountId: '',
    visibility: 'internal' as 'internal' | 'external',
    isDefaultContext: false,
  });
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = React.useState(false);
  const [formValues, setFormValues] = React.useState({
    organizationKey: '',
    displayName: '',
    organizationType: 'other' as IamOrganizationType,
    parentOrganizationId: '',
    contentAuthorPolicy: 'org_only' as 'org_only' | 'org_or_personal',
  });

  React.useEffect(() => {
    void organizationsApi.loadOrganization(organizationId);
  }, [organizationId, organizationsApi]);

  React.useEffect(() => {
    const detail = organizationsApi.selectedOrganization;
    if (!detail || detail.id !== organizationId) {
      return;
    }

    setFormValues({
      organizationKey: detail.organizationKey,
      displayName: detail.displayName,
      organizationType: detail.organizationType,
      parentOrganizationId: detail.parentOrganizationId ?? '',
      contentAuthorPolicy: detail.contentAuthorPolicy,
    });
  }, [organizationId, organizationsApi.selectedOrganization]);

  const selectedOrganization =
    organizationsApi.selectedOrganization?.id === organizationId ? organizationsApi.selectedOrganization : null;

  const onSubmitOrganization = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await organizationsApi.updateOrganization(organizationId, {
      organizationKey: formValues.organizationKey.trim(),
      displayName: formValues.displayName.trim(),
      organizationType: formValues.organizationType,
      parentOrganizationId: formValues.parentOrganizationId || undefined,
      contentAuthorPolicy: formValues.contentAuthorPolicy,
    });
  };

  const onAssignMembership = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!membershipForm.accountId) {
      return;
    }

    const success = await organizationsApi.assignMembership(organizationId, {
      accountId: membershipForm.accountId,
      visibility: membershipForm.visibility,
      isDefaultContext: membershipForm.isDefaultContext,
    });
    if (!success) {
      return;
    }

    setMembershipForm({ accountId: '', visibility: 'internal', isDefaultContext: false });
  };

  const onConfirmDeactivate = async () => {
    const success = await organizationsApi.deactivateOrganization(organizationId);
    if (success) {
      setDeactivateConfirmOpen(false);
    }
  };

  if (organizationsApi.error) {
    return (
      <section className="space-y-4">
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{organizationErrorMessage(organizationsApi.error)}</AlertDescription>
        </Alert>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/organizations">{t('admin.organizations.detail.backToList')}</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-5" aria-busy={organizationsApi.detailLoading}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            {selectedOrganization?.displayName ?? t('admin.organizations.editDialog.title')}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.organizations.editDialog.description')}</p>
        </div>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/organizations">{t('admin.organizations.detail.backToList')}</Link>
        </Button>
      </header>

      {!selectedOrganization && !organizationsApi.detailLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">{t('admin.organizations.detail.notFound')}</Card>
      ) : null}

      {selectedOrganization ? (
        <>
          <Card className="space-y-4 p-4">
            <form className="space-y-4" onSubmit={(event) => void onSubmitOrganization(event)}>
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1 text-sm text-foreground">
                  <Label htmlFor="organization-type">{t('admin.organizations.form.typeLabel')}</Label>
                  <Select
                    id="organization-type"
                    value={formValues.organizationType}
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        organizationType: event.target.value as IamOrganizationType,
                      }))
                    }
                  >
                    {typeOptions.map((type) => (
                      <option key={type} value={type}>
                        {t(ORGANIZATION_TYPE_KEYS[type])}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-1 text-sm text-foreground">
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
                  {organizationsApi.organizations
                    .filter((organization) => organization.id !== organizationId)
                    .map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.displayName}
                      </option>
                    ))}
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="destructive" onClick={() => setDeactivateConfirmOpen(true)} disabled={!selectedOrganization.isActive}>
                  {t('admin.organizations.actions.deactivate')}
                </Button>
                <Button type="submit">{t('admin.organizations.actions.save')}</Button>
              </div>
            </form>
          </Card>

          <Card className="space-y-4 p-4">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">{t('admin.organizations.membershipsDialog.title')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('admin.organizations.membershipsDialog.description', { name: selectedOrganization.displayName })}
              </p>
            </div>
            <Card className="bg-background p-3 text-sm text-foreground shadow-none">
              <p className="font-semibold">{selectedOrganization.displayName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('admin.organizations.messages.hierarchyPath', {
                  value: (selectedOrganization.hierarchyPath ?? []).join(' > '),
                })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('admin.organizations.messages.metadataCount', {
                  value: Object.keys(selectedOrganization.metadata ?? {}).length,
                })}
              </p>
            </Card>
            <form className="grid gap-3" onSubmit={(event) => void onAssignMembership(event)}>
              <div className="grid gap-1 text-sm text-foreground">
                <Label htmlFor="membership-account">{t('admin.organizations.membershipsDialog.accountLabel')}</Label>
                <Select
                  id="membership-account"
                  value={membershipForm.accountId}
                  onChange={(event) => setMembershipForm((current) => ({ ...current, accountId: event.target.value }))}
                >
                  <option value="">{t('admin.organizations.membershipsDialog.accountPlaceholder')}</option>
                  {usersApi.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1 text-sm text-foreground">
                  <Label htmlFor="membership-visibility">{t('admin.organizations.membershipsDialog.visibilityLabel')}</Label>
                  <Select
                    id="membership-visibility"
                    value={membershipForm.visibility}
                    onChange={(event) =>
                      setMembershipForm((current) => ({
                        ...current,
                        visibility: event.target.value as 'internal' | 'external',
                      }))
                    }
                  >
                    <option value="internal">{t('admin.organizations.membershipsDialog.visibilityInternal')}</option>
                    <option value="external">{t('admin.organizations.membershipsDialog.visibilityExternal')}</option>
                  </Select>
                </div>
                <Label htmlFor="membership-default" className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    id="membership-default"
                    checked={membershipForm.isDefaultContext}
                    onChange={(event) =>
                      setMembershipForm((current) => ({ ...current, isDefaultContext: event.target.checked }))
                    }
                  />
                  <span>{t('admin.organizations.membershipsDialog.defaultLabel')}</span>
                </Label>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={!membershipForm.accountId}>
                  {t('admin.organizations.actions.assignMembership')}
                </Button>
              </div>
            </form>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">{t('admin.organizations.membershipsDialog.membersTitle')}</h2>
              {selectedOrganization.memberships.length ? (
                <ul className="space-y-2">
                  {selectedOrganization.memberships.map((membership) => (
                    <li
                      key={membership.accountId}
                      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-sm text-foreground shadow-shell md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium">{membership.displayName}</p>
                        <p className="text-xs text-muted-foreground">{membership.email ?? membership.keycloakSubject}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('admin.organizations.membershipsDialog.createdAt', { value: membership.createdAt })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="rounded-full" variant="outline">
                          {membership.visibility === 'internal'
                            ? t('admin.organizations.membershipsDialog.visibilityInternal')
                            : t('admin.organizations.membershipsDialog.visibilityExternal')}
                        </Badge>
                        {membership.isDefaultContext ? (
                          <Badge className="rounded-full border-primary/40 bg-primary/10 text-primary" variant="outline">
                            {t('admin.organizations.membershipsDialog.defaultBadge')}
                          </Badge>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => void organizationsApi.removeMembership(organizationId, membership.accountId)}
                        >
                          {t('admin.organizations.actions.removeMembership')}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t('admin.organizations.membershipsDialog.empty')}</p>
              )}
            </div>
          </Card>
        </>
      ) : null}

      {(organizationsApi.mutationError && selectedOrganization) ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{organizationErrorMessage(organizationsApi.mutationError)}</AlertDescription>
        </Alert>
      ) : null}

      <ConfirmDialog
        open={deactivateConfirmOpen}
        title={t('admin.organizations.confirm.deactivateTitle')}
        description={t('admin.organizations.confirm.deactivateDescription')}
        confirmLabel={t('admin.organizations.actions.deactivate')}
        cancelLabel={t('account.actions.cancel')}
        onConfirm={() => void onConfirmDeactivate()}
        onCancel={() => setDeactivateConfirmOpen(false)}
      />
    </section>
  );
};
