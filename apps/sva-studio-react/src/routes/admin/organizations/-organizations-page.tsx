import type { IamOrganizationType } from '@sva/core';
import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ModalDialog } from '../../../components/ModalDialog';
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

const typeOptions = Object.keys(ORGANIZATION_TYPE_KEYS) as IamOrganizationType[];

type EditState = { mode: 'create' } | { mode: 'edit'; organizationId: string } | null;

export const OrganizationsPage = () => {
  const organizationsApi = useOrganizations();
  const usersApi = useUsers({ pageSize: 100 });

  const [editState, setEditState] = React.useState<EditState>(null);
  const [membershipOrganizationId, setMembershipOrganizationId] = React.useState<string | null>(null);
  const [deactivateOrganizationId, setDeactivateOrganizationId] = React.useState<string | null>(null);
  const [membershipForm, setMembershipForm] = React.useState({
    accountId: '',
    visibility: 'internal' as 'internal' | 'external',
    isDefaultContext: false,
  });
  const [formValues, setFormValues] = React.useState({
    organizationKey: '',
    displayName: '',
    organizationType: 'other' as IamOrganizationType,
    parentOrganizationId: '',
    contentAuthorPolicy: 'org_only' as 'org_only' | 'org_or_personal',
  });

  const pageCount = Math.max(1, Math.ceil(organizationsApi.total / organizationsApi.pageSize));

  const openCreateDialog = () => {
    organizationsApi.clearMutationError();
    setFormValues({
      organizationKey: '',
      displayName: '',
      organizationType: 'other',
      parentOrganizationId: '',
      contentAuthorPolicy: 'org_only',
    });
    setEditState({ mode: 'create' });
  };

  const openEditDialog = async (organizationId: string) => {
    organizationsApi.clearMutationError();
    const detail = await organizationsApi.loadOrganization(organizationId);
    if (!detail) {
      return;
    }
    setFormValues({
      organizationKey: detail.organizationKey,
      displayName: detail.displayName,
      organizationType: detail.organizationType,
      parentOrganizationId: detail.parentOrganizationId ?? '',
      contentAuthorPolicy: detail.contentAuthorPolicy,
    });
    setEditState({ mode: 'edit', organizationId });
  };

  const openMembershipDialog = async (organizationId: string) => {
    organizationsApi.clearMutationError();
    const detail = await organizationsApi.loadOrganization(organizationId);
    if (!detail) {
      return;
    }
    setMembershipForm({ accountId: '', visibility: 'internal', isDefaultContext: false });
    setMembershipOrganizationId(organizationId);
  };

  const onSubmitOrganization = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      organizationKey: formValues.organizationKey.trim(),
      displayName: formValues.displayName.trim(),
      organizationType: formValues.organizationType,
      parentOrganizationId: formValues.parentOrganizationId || undefined,
      contentAuthorPolicy: formValues.contentAuthorPolicy,
    };

    const success =
      editState?.mode === 'edit'
        ? await organizationsApi.updateOrganization(editState.organizationId, payload)
        : await organizationsApi.createOrganization(payload);

    if (!success) {
      return;
    }

    setEditState(null);
  };

  const onAssignMembership = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!membershipOrganizationId) {
      return;
    }

    const success = await organizationsApi.assignMembership(membershipOrganizationId, {
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
    if (!deactivateOrganizationId) {
      return;
    }
    const success = await organizationsApi.deactivateOrganization(deactivateOrganizationId);
    if (success) {
      setDeactivateOrganizationId(null);
    }
  };

  const selectedOrganization =
    membershipOrganizationId && organizationsApi.selectedOrganization?.id === membershipOrganizationId
      ? organizationsApi.selectedOrganization
      : null;

  return (
    <section className="space-y-5" aria-busy={organizationsApi.isLoading}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('admin.organizations.page.title')}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t('admin.organizations.page.subtitle')}</p>
      </header>

      <Card className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_auto_auto]">
        <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Label htmlFor="organizations-search">{t('admin.organizations.filters.searchLabel')}</Label>
          <Input
            id="organizations-search"
            placeholder={t('admin.organizations.filters.searchPlaceholder')}
            value={organizationsApi.filters.search}
            onChange={(event) => organizationsApi.setSearch(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Label htmlFor="organizations-type">{t('admin.organizations.filters.typeLabel')}</Label>
          <Select
            id="organizations-type"
            value={organizationsApi.filters.organizationType}
            onChange={(event) =>
              organizationsApi.setOrganizationType(event.target.value as typeof organizationsApi.filters.organizationType)
            }
          >
            <option value="all">{t('admin.organizations.filters.typeAll')}</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {t(ORGANIZATION_TYPE_KEYS[type])}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Label htmlFor="organizations-status">{t('admin.organizations.filters.statusLabel')}</Label>
          <Select
            id="organizations-status"
            value={organizationsApi.filters.status}
            onChange={(event) => organizationsApi.setStatus(event.target.value as 'active' | 'inactive' | 'all')}
          >
            <option value="all">{t('admin.organizations.filters.statusAll')}</option>
            <option value="active">{t('admin.organizations.filters.statusActive')}</option>
            <option value="inactive">{t('admin.organizations.filters.statusInactive')}</option>
          </Select>
        </div>
        <div className="flex items-end justify-end">
          <Button type="button" onClick={openCreateDialog}>
            {t('admin.organizations.actions.create')}
          </Button>
        </div>
      </Card>

      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {t('admin.organizations.messages.resultCount', { count: organizationsApi.total })}
      </p>

      {organizationsApi.error ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>{organizationErrorMessage(organizationsApi.error)}</span>
            <div>
              <Button type="button" size="sm" variant="outline" onClick={() => void organizationsApi.refetch()}>
                {t('admin.organizations.actions.retry')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-shell">
        <table className="min-w-full border-collapse" aria-label={t('admin.organizations.table.ariaLabel')}>
          <caption className="sr-only">{t('admin.organizations.table.caption')}</caption>
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-3">{t('admin.organizations.table.headerName')}</th>
              <th scope="col" className="px-3 py-3">{t('admin.organizations.table.headerType')}</th>
              <th scope="col" className="px-3 py-3">{t('admin.organizations.table.headerParent')}</th>
              <th scope="col" className="px-3 py-3">{t('admin.organizations.table.headerChildren')}</th>
              <th scope="col" className="px-3 py-3">{t('admin.organizations.table.headerMembers')}</th>
              <th scope="col" className="px-3 py-3">{t('admin.organizations.table.headerStatus')}</th>
              <th scope="col" className="px-3 py-3 text-right">{t('admin.organizations.table.headerActions')}</th>
            </tr>
          </thead>
          <tbody>
            {organizationsApi.organizations.map((organization) => (
              <tr key={organization.id} className="border-t border-border bg-card text-sm text-foreground">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2" style={{ paddingLeft: `${organization.depth * 12}px` }}>
                    <div>
                      <span className="font-medium">{organization.displayName}</span>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{organization.organizationKey}</span>
                        <span>{t('admin.organizations.messages.depth', { value: organization.depth })}</span>
                        <span>{t('admin.organizations.messages.hierarchySize', { value: organization.hierarchyPath?.length ?? 0 })}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">{t(ORGANIZATION_TYPE_KEYS[organization.organizationType])}</td>
                <td className="px-3 py-3">{organization.parentDisplayName ?? t('admin.organizations.messages.root')}</td>
                <td className="px-3 py-3">{organization.childCount}</td>
                <td className="px-3 py-3">{organization.membershipCount}</td>
                <td className="px-3 py-3">
                  {organization.isActive
                    ? t('admin.organizations.filters.statusActive')
                    : t('admin.organizations.filters.statusInactive')}
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void openEditDialog(organization.id)}
                    >
                      {t('admin.organizations.actions.edit')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void openMembershipDialog(organization.id)}
                    >
                      {t('admin.organizations.actions.memberships')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeactivateOrganizationId(organization.id)}
                      disabled={!organization.isActive}
                    >
                      {t('admin.organizations.actions.deactivate')}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {organizationsApi.organizations.length === 0 && !organizationsApi.isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">
          {t('admin.organizations.messages.emptyState')}
        </Card>
      ) : null}

      <nav aria-label={t('admin.organizations.pagination.ariaLabel')} className="flex items-center justify-between text-sm text-muted-foreground">
        <p aria-live="polite">{t('admin.organizations.pagination.pageLabel', { page: organizationsApi.page, totalPages: pageCount })}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={organizationsApi.page <= 1}
            onClick={() => organizationsApi.setPage(organizationsApi.page - 1)}
          >
            {t('admin.organizations.pagination.previous')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={organizationsApi.page >= pageCount}
            onClick={() => organizationsApi.setPage(organizationsApi.page + 1)}
          >
            {t('admin.organizations.pagination.next')}
          </Button>
        </div>
      </nav>

      <ModalDialog
        open={editState !== null}
        onClose={() => setEditState(null)}
        title={editState?.mode === 'edit' ? t('admin.organizations.editDialog.title') : t('admin.organizations.createDialog.title')}
        description={
          editState?.mode === 'edit'
            ? t('admin.organizations.editDialog.description')
            : t('admin.organizations.createDialog.description')
        }
      >
        <form className="space-y-4" onSubmit={(event) => void onSubmitOrganization(event)}>
          {organizationsApi.mutationError ? (
            <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
              <AlertDescription>{organizationErrorMessage(organizationsApi.mutationError)}</AlertDescription>
            </Alert>
          ) : null}
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
          <div className="grid gap-1 text-sm text-foreground">
            <Label htmlFor="organization-type">{t('admin.organizations.form.typeLabel')}</Label>
            <Select
              id="organization-type"
              value={formValues.organizationType}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, organizationType: event.target.value as IamOrganizationType }))
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            >
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {t(ORGANIZATION_TYPE_KEYS[type])}
                </option>
              ))}
            </Select>
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
                .filter((organization) => organization.id !== (editState?.mode === 'edit' ? editState.organizationId : ''))
                .map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.displayName}
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
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            >
              <option value="org_only">{t('admin.organizations.policies.orgOnly')}</option>
              <option value="org_or_personal">{t('admin.organizations.policies.orgOrPersonal')}</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditState(null)}>
              {t('account.actions.cancel')}
            </Button>
            <Button type="submit">
              {editState?.mode === 'edit' ? t('admin.organizations.actions.save') : t('admin.organizations.actions.create')}
            </Button>
          </div>
        </form>
      </ModalDialog>

      <ModalDialog
        open={membershipOrganizationId !== null}
        onClose={() => {
          setMembershipOrganizationId(null);
          organizationsApi.clearSelectedOrganization();
        }}
        title={t('admin.organizations.membershipsDialog.title')}
        description={selectedOrganization ? t('admin.organizations.membershipsDialog.description', { name: selectedOrganization.displayName }) : ''}
      >
        <div className="space-y-4">
          {selectedOrganization ? (
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
          ) : null}
          {organizationsApi.mutationError ? (
            <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
              <AlertDescription>{organizationErrorMessage(organizationsApi.mutationError)}</AlertDescription>
            </Alert>
          ) : null}
          <Card className="grid gap-3 p-4">
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
                className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
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
            <div className="flex justify-end">
              <Button type="submit" disabled={!membershipForm.accountId}>
                {t('admin.organizations.actions.assignMembership')}
              </Button>
            </div>
            </form>
          </Card>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{t('admin.organizations.membershipsDialog.membersTitle')}</h2>
            {selectedOrganization?.memberships.length ? (
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
                        onClick={() => {
                          if (!membershipOrganizationId) {
                            return;
                          }
                          void organizationsApi.removeMembership(membershipOrganizationId, membership.accountId);
                        }}
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
        </div>
      </ModalDialog>

      <ConfirmDialog
        open={deactivateOrganizationId !== null}
        title={t('admin.organizations.confirm.deactivateTitle')}
        description={t('admin.organizations.confirm.deactivateDescription')}
        confirmLabel={t('admin.organizations.actions.deactivate')}
        cancelLabel={t('account.actions.cancel')}
        onConfirm={() => void onConfirmDeactivate()}
        onCancel={() => setDeactivateOrganizationId(null)}
      />
    </section>
  );
};
