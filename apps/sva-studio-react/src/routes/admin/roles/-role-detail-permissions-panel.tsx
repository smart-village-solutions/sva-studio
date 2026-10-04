import { Button, StudioDataTable, StudioFormActionBar } from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { t } from '../../../i18n';

import type { RoleDetailTab } from './-role-detail-page';
import type { RoleDetailState } from './-role-detail-state';

export const RolePermissionsPanel = ({
  state,
  activeTab,
  arePermissionsDirty,
  savePermissionsAction,
}: Readonly<{
  state: RoleDetailState;
  role: NonNullable<RoleDetailState['role']>;
  activeTab: RoleDetailTab;
  arePermissionsDirty: boolean;
  savePermissionsAction: React.ReactNode;
}>) => {
  const {
    showTechnicalDetails,
    setShowTechnicalDetails,
    permissionsApi,
    studioDataTableLabels,
    studioDataTableSortingLabels,
    filteredPermissionTableRows,
    permissionTableColumns,
    permissionSearch,
    setPermissionSearch,
    permissionDraft,
    isReadOnly,
    resetPermissionDraft,
  } = state;
  return (
    <section
      id="role-detail-panel-permissions"
      role="tabpanel"
      aria-labelledby="role-detail-tab-permissions"
      hidden={activeTab !== 'permissions'}
      className="space-y-4"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.roles.workspace.editPermissionsTitle')}</CardTitle>
            <CardDescription>{t('admin.roles.detail.permissions.subtitle')}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('admin.roles.workspace.sideTitle')}</CardTitle>
            <CardDescription>{t('admin.roles.workspace.sideSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {t('admin.roles.detail.permissions.cockpitHint')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                aria-pressed={showTechnicalDetails}
                onClick={() => setShowTechnicalDetails((current) => !current)}
              >
                {showTechnicalDetails
                  ? t('admin.roles.detail.permissions.hideTechnicalDetails')
                  : t('admin.roles.detail.permissions.showTechnicalDetails')}
              </Button>
              <Button asChild type="button" variant="secondary">
                <Link to="/admin/iam" search={{ tab: 'rights' }}>
                  {t('admin.roles.workspace.openIamCta')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <StudioFormActionBar position="start">{savePermissionsAction}</StudioFormActionBar>

      {permissionsApi.error ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{t('admin.roles.workspace.permissionsLoadError')}</AlertDescription>
        </Alert>
      ) : permissionsApi.isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t('admin.roles.workspace.permissionsLoading')}
        </p>
      ) : (
        <StudioDataTable
          ariaLabel={t('admin.roles.detail.permissions.table.ariaLabel')}
          labels={studioDataTableLabels}
          caption={t('admin.roles.detail.permissions.table.caption')}
          data={filteredPermissionTableRows}
          columns={permissionTableColumns}
          sorting={{ mode: 'client', labels: studioDataTableSortingLabels }}
          getRowId={(permission) => permission.id}
          selectionMode="none"
          emptyState={
            <Card
              className="border-none p-0 text-sm text-muted-foreground shadow-none"
              role="status"
            >
              {t('admin.roles.detail.permissions.table.empty')}
            </Card>
          }
          toolbarStart={
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-[16rem] flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <Label htmlFor="role-permissions-search">
                  {t('admin.roles.detail.permissions.filters.searchLabel')}
                </Label>
                <Input
                  id="role-permissions-search"
                  value={permissionSearch}
                  onChange={(event) => setPermissionSearch(event.target.value)}
                  placeholder={t('admin.roles.detail.permissions.filters.searchPlaceholder')}
                />
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">
                  {t('admin.roles.detail.permissions.summary.visibleCount', {
                    count: String(filteredPermissionTableRows.length),
                  })}
                </Badge>
                <Badge variant="outline">
                  {t('admin.roles.detail.permissions.summary.assignedCount', {
                    count: String(permissionDraft.length),
                  })}
                </Badge>
              </div>
            </div>
          }
          toolbarEnd={<RolePermissionBulkToolbar state={state} />}
        />
      )}

      <StudioFormActionBar>
        {savePermissionsAction}
        <Button
          type="button"
          variant="secondary"
          disabled={isReadOnly || !arePermissionsDirty}
          onClick={resetPermissionDraft}
        >
          {t('admin.roles.workspace.resetPermissions')}
        </Button>
      </StudioFormActionBar>
    </section>
  );
};

const RolePermissionBulkToolbar = ({ state }: Readonly<{ state: RoleDetailState }>) => {
  const {
    isReadOnly,
    assignVisiblePermissions,
    removeVisiblePermissions,
    assignAllPermissions,
    removeAllPermissions,
  } = state;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={isReadOnly}
        onClick={assignVisiblePermissions}
      >
        {t('admin.roles.detail.permissions.bulk.assignVisible')}
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={isReadOnly}
        onClick={removeVisiblePermissions}
      >
        {t('admin.roles.detail.permissions.bulk.removeVisible')}
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={isReadOnly}
        onClick={assignAllPermissions}
      >
        {t('admin.roles.detail.permissions.bulk.assignAll')}
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={isReadOnly}
        onClick={removeAllPermissions}
      >
        {t('admin.roles.detail.permissions.bulk.removeAll')}
      </Button>
    </div>
  );
};
