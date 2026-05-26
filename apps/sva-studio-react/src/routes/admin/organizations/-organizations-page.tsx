import { IconEdit, IconTrash, IconUsersGroup } from '@tabler/icons-react';
import { StudioDataTable, StudioListPageTemplate, type StudioColumnDef } from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';
import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { createStudioDataTableLabels } from '../../../components/studio-data-table-labels';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { Switch } from '../../../components/ui/switch';
import { useOrganizations } from '../../../hooks/use-organizations';
import { t } from '../../../i18n';
import {
  getOrganizationTypeTranslationKey,
  organizationErrorMessage,
  organizationTypeOptions,
} from './-organization-shared';

export const OrganizationsPage = () => {
  const studioDataTableLabels = createStudioDataTableLabels();
  const organizationsApi = useOrganizations();
  const [deactivateOrganizationId, setDeactivateOrganizationId] = React.useState<string | null>(null);
  const [statusMutationOrganizationIds, setStatusMutationOrganizationIds] = React.useState<readonly string[]>([]);

  const pageCount = Math.max(1, Math.ceil(organizationsApi.total / organizationsApi.pageSize));

  const onConfirmDeactivate = async () => {
    if (!deactivateOrganizationId) {
      return;
    }
    const success = await organizationsApi.deactivateOrganization(deactivateOrganizationId);
    setDeactivateOrganizationId(null);
    if (!success) {
      return;
    }
  };

  const onStatusChange = async (organizationId: string, isActive: boolean) => {
    setStatusMutationOrganizationIds((current) =>
      current.includes(organizationId) ? current : [...current, organizationId]
    );
    try {
      await organizationsApi.updateOrganization(organizationId, { isActive });
    } finally {
      setStatusMutationOrganizationIds((current) => current.filter((id) => id !== organizationId));
    }
  };

  const organizationColumns = React.useMemo<readonly StudioColumnDef<(typeof organizationsApi.organizations)[number]>[]>(
    () => [
      {
        id: 'organization',
        header: t('admin.organizations.table.headerName'),
        cell: (organization) => (
          <div className="space-y-1" style={{ paddingLeft: `${organization.depth * 12}px` }}>
            <span className="block font-semibold">{organization.displayName}</span>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{organization.organizationKey}</span>
              <span>{t('admin.organizations.messages.depth', { value: organization.depth })}</span>
              <span>
                {t('admin.organizations.messages.hierarchySize', {
                  value: organization.hierarchyPath?.length ?? 0,
                })}
              </span>
            </div>
          </div>
        ),
        sortable: true,
        sortValue: (organization) => organization.displayName.toLocaleLowerCase(),
      },
      {
        id: 'type',
        header: t('admin.organizations.table.headerType'),
        cell: (organization) => t(getOrganizationTypeTranslationKey(organization.organizationType)),
        sortable: true,
        sortValue: (organization) => t(getOrganizationTypeTranslationKey(organization.organizationType)).toLocaleLowerCase(),
      },
      {
        id: 'parent',
        header: t('admin.organizations.table.headerParent'),
        cell: (organization) => organization.parentDisplayName ?? t('admin.organizations.messages.root'),
        sortable: true,
        sortValue: (organization) => (organization.parentDisplayName ?? '').toLocaleLowerCase(),
      },
      {
        id: 'children',
        header: t('admin.organizations.table.headerChildren'),
        cell: (organization) => String(organization.childCount),
        sortable: true,
        sortValue: (organization) => organization.childCount,
      },
      {
        id: 'members',
        header: t('admin.organizations.table.headerMembers'),
        cell: (organization) => String(organization.membershipCount),
        sortable: true,
        sortValue: (organization) => organization.membershipCount,
      },
      {
        id: 'status',
        header: t('admin.organizations.table.headerStatus'),
        cell: (organization) => (
          <div className="flex items-center gap-3">
            <Switch
              checked={organization.isActive}
              disabled={statusMutationOrganizationIds.includes(organization.id)}
              aria-label={t('admin.organizations.messages.statusSwitchLabel', {
                name: organization.displayName,
              })}
              onCheckedChange={(checked) => {
                void onStatusChange(organization.id, checked);
              }}
            />
            <Badge variant="outline">
              {organization.isActive
                ? t('admin.organizations.filters.statusActive')
                : t('admin.organizations.filters.statusInactive')}
            </Badge>
          </div>
        ),
        sortable: true,
        sortValue: (organization) => (organization.isActive ? 'active' : 'inactive'),
      },
    ],
    [statusMutationOrganizationIds, organizationsApi.organizations]
  );

  return (
    <section className="space-y-5" aria-busy={organizationsApi.isLoading}>
      <StudioListPageTemplate
        title={t('admin.organizations.page.title')}
        description={t('admin.organizations.page.subtitle')}
        primaryAction={{
          label: t('admin.organizations.actions.create'),
          render: (
            <Button asChild type="button">
              <Link to="/admin/organizations/new">{t('admin.organizations.actions.create')}</Link>
            </Button>
          ),
        }}
      >
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

        {organizationsApi.mutationError ? (
          <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertDescription className="flex flex-col gap-3">
              <span>{organizationErrorMessage(organizationsApi.mutationError)}</span>
              <div>
                <Button type="button" size="sm" variant="outline" onClick={organizationsApi.clearMutationError}>
                  {t('shell.permissionsDegraded.dismiss')}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        <StudioDataTable
          ariaLabel={t('admin.organizations.table.ariaLabel')}
          labels={studioDataTableLabels}
          caption={t('admin.organizations.table.caption')}
          data={organizationsApi.organizations}
          columns={organizationColumns}
          getRowId={(organization) => organization.id}
          selectionMode="none"
          isLoading={organizationsApi.isLoading}
          loadingState={t('content.messages.loading')}
          emptyState={
            <Card className="border-none p-0 text-sm text-muted-foreground shadow-none" role="status">
              {t('admin.organizations.messages.emptyState')}
            </Card>
          }
          toolbarStart={
            <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <Label htmlFor="organizations-search">{t('admin.organizations.filters.searchLabel')}</Label>
              <Input
                id="organizations-search"
                placeholder={t('admin.organizations.filters.searchPlaceholder')}
                value={organizationsApi.filters.search}
                onChange={(event) => organizationsApi.setSearch(event.target.value)}
              />
            </div>
          }
          toolbarEnd={
            <>
              <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <Label htmlFor="organizations-type">{t('admin.organizations.filters.typeLabel')}</Label>
                <Select
                  id="organizations-type"
                  value={organizationsApi.filters.organizationType}
                  onChange={(event) =>
                    organizationsApi.setOrganizationType(
                      event.target.value as typeof organizationsApi.filters.organizationType
                    )
                  }
                >
                  <option value="all">{t('admin.organizations.filters.typeAll')}</option>
                  {organizationTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {t(getOrganizationTypeTranslationKey(type))}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <Label htmlFor="organizations-status">{t('admin.organizations.filters.statusLabel')}</Label>
                <Select
                  id="organizations-status"
                  value={organizationsApi.filters.status}
                  onChange={(event) =>
                    organizationsApi.setStatus(event.target.value as 'active' | 'inactive' | 'all')
                  }
                >
                  <option value="all">{t('admin.organizations.filters.statusAll')}</option>
                  <option value="active">{t('admin.organizations.filters.statusActive')}</option>
                  <option value="inactive">{t('admin.organizations.filters.statusInactive')}</option>
                </Select>
              </div>
            </>
          }
          rowActions={(organization) => (
            <>
              <Button asChild type="button" size="icon" variant="outline">
                <Link
                  to="/admin/organizations/$organizationId"
                  params={{ organizationId: organization.id }}
                  aria-label={t('admin.organizations.actions.edit')}
                  title={t('admin.organizations.actions.edit')}
                >
                  <IconEdit aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild type="button" size="icon" variant="secondary">
                <Link
                  to="/admin/organizations/$organizationId"
                  params={{ organizationId: organization.id }}
                  aria-label={t('admin.organizations.actions.memberships')}
                  title={t('admin.organizations.actions.memberships')}
                >
                  <IconUsersGroup aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                type="button"
                size="icon"
                variant="destructive"
                onClick={() => setDeactivateOrganizationId(organization.id)}
                aria-label={t('admin.organizations.actions.delete')}
                title={t('admin.organizations.actions.delete')}
              >
                <IconTrash aria-hidden="true" className="h-4 w-4" />
              </Button>
            </>
          )}
          footer={
            <nav
              aria-label={t('admin.organizations.pagination.ariaLabel')}
              className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-1">
                <p role="status" aria-live="polite">
                  {t('admin.organizations.messages.resultCount', { count: organizationsApi.total })}
                </p>
                <p key={organizationsApi.page} className="animate-pagination-active" aria-live="polite">
                  {t('admin.organizations.pagination.pageLabel', {
                    page: organizationsApi.page,
                    totalPages: pageCount,
                  })}
                </p>
              </div>
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
          }
        />
      </StudioListPageTemplate>

      <ConfirmDialog
        open={deactivateOrganizationId !== null}
        title={t('admin.organizations.confirm.deactivateTitle')}
        description={t('admin.organizations.confirm.deactivateDescription')}
        confirmLabel={t('admin.organizations.actions.delete')}
        cancelLabel={t('account.actions.cancel')}
        onConfirm={() => void onConfirmDeactivate()}
        onCancel={() => setDeactivateOrganizationId(null)}
      />
    </section>
  );
};
