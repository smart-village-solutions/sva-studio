import { IconEdit, IconRefresh, IconTrash } from '@tabler/icons-react';
import { StudioDataTable, StudioListPageTemplate, type StudioColumnDef } from '@sva/studio-ui-react';
import React from 'react';
import { Link } from '@tanstack/react-router';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { createStudioDataTableLabels } from '../../../components/studio-data-table-labels';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { useRoles } from '../../../hooks/use-roles';
import { useAuth } from '../../../providers/auth-provider';
import { t } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/translate';
import type { RoleReconcileReport } from '../../../lib/iam-api';
import { isTenantRoleReadOnly, isTenantRoleVisible } from '../../../lib/iam-role-governance';
import { IamRuntimeDiagnosticDetails } from '../-iam-runtime-diagnostic-details';
import { roleErrorMessage, roleStatusLabel, roleStatusTone, roleTypeLabel } from './-roles-shared';

const RECONCILE_OUTCOME_LABEL_KEYS = {
  success: 'admin.roles.messages.reconcileOutcome.success',
  partial_failure: 'admin.roles.messages.reconcileOutcome.partialFailure',
  blocked: 'admin.roles.messages.reconcileOutcome.blocked',
  failed: 'admin.roles.messages.reconcileOutcome.failed',
} as const satisfies Record<RoleReconcileReport['outcome'], TranslationKey>;

const editabilityClassByValue = {
  editable: 'border-primary/40 bg-primary/10 text-primary',
  read_only: 'border-secondary/40 bg-secondary/10 text-secondary',
  blocked: 'border-destructive/40 bg-destructive/10 text-destructive',
} as const;

const editabilityLabelKey = {
  editable: 'admin.roles.editability.editable',
  read_only: 'admin.roles.editability.readOnly',
  blocked: 'admin.roles.editability.blocked',
} as const;

export const RolesPage = () => {
  const studioDataTableLabels = createStudioDataTableLabels();
  const rolesApi = useRoles();
  const { user } = useAuth();
  const isPlatformScope = user !== null && !user.instanceId;

  const [search, setSearch] = React.useState('');
  const [deleteRoleId, setDeleteRoleId] = React.useState<string | null>(null);
  const visibleRoles = React.useMemo(
    () => (isPlatformScope ? rolesApi.roles : rolesApi.roles.filter((role) => isTenantRoleVisible(role))),
    [isPlatformScope, rolesApi.roles]
  );

  const filteredRoles = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return visibleRoles.filter((role) => {
      if (!query) {
        return true;
      }

      return (
        role.roleName.toLowerCase().includes(query) ||
        role.roleKey.toLowerCase().includes(query) ||
        role.description?.toLowerCase().includes(query) ||
        role.permissions.some((permission) => permission.permissionKey.toLowerCase().includes(query))
      );
    });
  }, [search, visibleRoles]);

  const roleColumns = React.useMemo<readonly StudioColumnDef<(typeof filteredRoles)[number]>[]>(
    () => [
      {
        id: 'roleName',
        header: t('admin.roles.table.headerName'),
        cell: (role) => (
          <div className="space-y-1">
            <span className="block font-semibold">{role.roleName}</span>
            <span className="block text-xs text-muted-foreground">{role.roleKey}</span>
            <span className="block text-xs text-muted-foreground">
              {role.description?.trim() || t('admin.roles.messages.noDescription')}
            </span>
          </div>
        ),
        sortable: true,
        sortValue: (role) => role.roleName.toLowerCase(),
      },
      {
        id: 'type',
        header: t('admin.roles.table.headerType'),
        cell: (role) => {
          const editability = role.editability ?? 'editable';
          return (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{roleTypeLabel(role)}</span>
                <Badge className={`rounded-full ${editabilityClassByValue[editability]}`} variant="outline">
                  {t(editabilityLabelKey[editability])}
                </Badge>
              </div>
              <span className="block text-xs text-muted-foreground">
                {t('admin.roles.messages.roleLevel', { value: role.roleLevel })}
              </span>
            </div>
          );
        },
      },
      {
        id: 'sync',
        header: t('admin.roles.table.headerSync'),
        cell: (role) => (
          <div className="space-y-2">
            <Badge
              className={`rounded-full ${roleStatusTone(role.syncState)}`}
              aria-label={`${t('admin.roles.table.headerSync')}: ${roleStatusLabel(role.syncState)}`}
              variant="outline"
            >
              {roleStatusLabel(role.syncState)}
            </Badge>
            {role.syncError ? (
              <p className="text-xs text-destructive" role="status">
                {t('admin.roles.messages.syncErrorCode', { code: role.syncError.code })}
              </p>
            ) : null}
            {!role.syncError && role.diagnostics && role.diagnostics.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t('admin.roles.messages.diagnosticCodes', {
                  codes: role.diagnostics.map((diagnostic) => diagnostic.code).join(', '),
                })}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'permissions',
        header: t('admin.roles.table.headerPermissions'),
        cell: (role) => String(role.permissions.length),
        sortable: true,
        sortValue: (role) => role.permissions.length,
      },
      {
        id: 'memberCount',
        header: t('admin.roles.table.headerUserCount'),
        cell: (role) => String(role.memberCount),
        sortable: true,
        sortValue: (role) => role.memberCount,
      },
    ],
    [filteredRoles]
  );

  return (
    <section className="space-y-5" aria-busy={rolesApi.isLoading}>
      <StudioListPageTemplate
        title={t(isPlatformScope ? 'admin.roles.page.platformTitle' : 'admin.roles.page.title')}
        description={t(isPlatformScope ? 'admin.roles.page.platformSubtitle' : 'admin.roles.page.subtitle')}
        primaryAction={{
          label: t(isPlatformScope ? 'admin.roles.actions.reconcilePlatform' : 'admin.roles.actions.create'),
          render: (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => void rolesApi.reconcile()}>
                {t(isPlatformScope ? 'admin.roles.actions.reconcilePlatform' : 'admin.roles.actions.importFromKeycloak')}
              </Button>
              {isPlatformScope ? null : (
                <Button asChild type="button">
                  <Link to="/admin/roles/new">{t('admin.roles.actions.create')}</Link>
                </Button>
              )}
            </div>
          ),
        }}
      >
        <StudioDataTable
          ariaLabel={t(isPlatformScope ? 'admin.roles.table.platformAriaLabel' : 'admin.roles.table.ariaLabel')}
          labels={studioDataTableLabels}
          caption={t(isPlatformScope ? 'admin.roles.table.platformCaption' : 'admin.roles.table.caption')}
          data={filteredRoles}
          columns={roleColumns}
          getRowId={(role) => role.id}
          selectionMode="none"
          isLoading={rolesApi.isLoading}
          loadingState={t('content.messages.loading')}
          emptyState={
            <Card className="border-none p-0 text-sm text-muted-foreground shadow-none" role="status">
              {t('admin.roles.messages.emptyState')}
            </Card>
          }
          toolbarStart={
            <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <Label htmlFor="roles-search">{t('admin.roles.filters.searchLabel')}</Label>
              <Input
                id="roles-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('admin.roles.filters.searchPlaceholder')}
              />
            </div>
          }
          rowActions={isPlatformScope ? undefined : (role) => {
            const isReadOnly = isTenantRoleReadOnly(role);

            return (
              <>
                <Button asChild type="button" size="icon" variant="outline">
                  <Link
                    to="/admin/roles/$roleId"
                    params={{ roleId: role.id }}
                    aria-label={t('admin.roles.actions.edit')}
                    title={t('admin.roles.actions.edit')}
                  >
                    <IconEdit aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </Button>
                {role.syncState === 'failed' ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    disabled={role.managedBy !== 'studio'}
                    aria-label={t('admin.roles.actions.retrySync')}
                    title={t('admin.roles.actions.retrySync')}
                    onClick={() => void rolesApi.retryRoleSync(role.id)}
                  >
                    <IconRefresh aria-hidden="true" className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  disabled={isReadOnly}
                  aria-label={t('admin.roles.actions.delete')}
                  title={t('admin.roles.actions.delete')}
                  onClick={() => setDeleteRoleId(role.id)}
                >
                  <IconTrash aria-hidden="true" className="h-4 w-4" />
                </Button>
              </>
            );
          }}
        />
      </StudioListPageTemplate>

      {rolesApi.reconcileReport ? (
        <Alert
          className={
            rolesApi.reconcileReport.outcome === 'success'
              ? 'border-secondary/40 bg-secondary/10 text-secondary'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }
          role="status"
        >
          <AlertDescription className="flex flex-col gap-1">
            <span>{t('admin.roles.messages.reconcileSummary', {
              checked: String(rolesApi.reconcileReport.checkedCount),
              corrected: String(rolesApi.reconcileReport.correctedCount),
              failed: String(rolesApi.reconcileReport.failedCount),
              manual: String(rolesApi.reconcileReport.manualReviewCount),
            })}</span>
            <span className="text-xs text-muted-foreground">
              {t(RECONCILE_OUTCOME_LABEL_KEYS[rolesApi.reconcileReport.outcome])}
            </span>
            {rolesApi.reconcileReport.roles.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                {t('admin.roles.messages.reconcileObjectDiagnostics', {
                  count: rolesApi.reconcileReport.roles.length,
                  codes: Array.from(
                    new Set(
                      rolesApi.reconcileReport.roles.flatMap((entry) => [
                        ...(entry.errorCode ? [entry.errorCode] : []),
                        ...(entry.diagnostics?.map((diagnostic) => diagnostic.code) ?? []),
                      ])
                    )
                  ).join(', '),
                })}
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {rolesApi.error ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>
              {roleErrorMessage(rolesApi.error, 'admin.roles.messages.error', {
                includeKeycloakReconcileError: true,
                includeRecoveryRunningError: true,
              })}
            </span>
            <IamRuntimeDiagnosticDetails error={rolesApi.error} />
            <div>
              <Button type="button" size="sm" variant="outline" onClick={() => void rolesApi.refetch()}>
                {t('admin.roles.actions.retry')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteRoleId)}
        title={t('admin.roles.confirm.deleteTitle')}
        description={t('admin.roles.confirm.deleteDescription')}
        confirmLabel={t('admin.roles.actions.delete')}
        cancelLabel={t('account.actions.cancel')}
        onCancel={() => setDeleteRoleId(null)}
        onConfirm={() => {
          const roleId = deleteRoleId;
          setDeleteRoleId(null);
          if (roleId) {
            void rolesApi.deleteRole(roleId);
          }
        }}
      />
    </section>
  );
};
