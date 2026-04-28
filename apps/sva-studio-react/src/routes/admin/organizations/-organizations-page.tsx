import { Link } from '@tanstack/react-router';
import type { IamOrganizationType } from '@sva/core';
import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
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

export const OrganizationsPage = () => {
  const organizationsApi = useOrganizations();
  const [deactivateOrganizationId, setDeactivateOrganizationId] = React.useState<string | null>(null);

  const pageCount = Math.max(1, Math.ceil(organizationsApi.total / organizationsApi.pageSize));

  const onConfirmDeactivate = async () => {
    if (!deactivateOrganizationId) {
      return;
    }
    const success = await organizationsApi.deactivateOrganization(deactivateOrganizationId);
    if (success) {
      setDeactivateOrganizationId(null);
    }
  };

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
          <Button asChild type="button">
            <Link to="/admin/organizations/new">{t('admin.organizations.actions.create')}</Link>
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
                      asChild
                      size="sm"
                      variant="outline"
                    >
                      <Link to="/admin/organizations/$organizationId" params={{ organizationId: organization.id }}>
                        {t('admin.organizations.actions.edit')}
                      </Link>
                    </Button>
                    <Button asChild type="button" size="sm" variant="secondary">
                      <Link to="/admin/organizations/$organizationId" params={{ organizationId: organization.id }}>
                        {t('admin.organizations.actions.memberships')}
                      </Link>
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
        <p key={organizationsApi.page} className="animate-pagination-active" aria-live="polite">{t('admin.organizations.pagination.pageLabel', { page: organizationsApi.page, totalPages: pageCount })}</p>
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
