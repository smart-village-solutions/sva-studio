import { IconEdit, IconRefresh, IconTrash } from '@tabler/icons-react';
import { Button, StudioDataTable, StudioListPageTemplate } from '@sva/studio-ui-react';
import React from 'react';
import { Link } from '@tanstack/react-router';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import {
  createStudioDataTableLabels,
  createStudioDataTableSortingLabels,
} from '../../../components/studio-data-table-labels';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Card } from '../../../components/ui/card';
import { useKeycloakRoles } from '../../../hooks/use-keycloak-roles';
import { useRoles } from '../../../hooks/use-roles';
import { isIamAccessAllowed, useIamResourceAccess } from '../../../hooks/use-iam-resource-access';
import { useAuth } from '../../../providers/auth-provider';
import { t } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/translate';
import type { RoleReconcileReport } from '../../../lib/iam-api';
import { hasPlatformInstanceAdminAccess } from '../../../lib/iam-admin-access';
import { isTenantRoleReadOnly, isTenantRoleVisible } from '../../../lib/iam-role-governance';
import { IamRuntimeDiagnosticDetails } from '../-iam-runtime-diagnostic-details';
import { matchesRoleTypeFilter, RoleFilters, type RoleTypeFilter } from './-role-filters';
import {
  createRoleListColumns,
  toKeycloakRoleRow,
  toLocalRoleRow,
  type RoleRow,
} from './-role-list-columns';
import { getRoleDeleteConfirmationContent, roleErrorMessage } from './-roles-shared';

const RECONCILE_OUTCOME_LABEL_KEYS = {
  success: 'admin.roles.messages.reconcileOutcome.success',
  partial_failure: 'admin.roles.messages.reconcileOutcome.partialFailure',
  blocked: 'admin.roles.messages.reconcileOutcome.blocked',
  failed: 'admin.roles.messages.reconcileOutcome.failed',
} as const satisfies Record<RoleReconcileReport['outcome'], TranslationKey>;

export const RolesPage = () => {
  const studioDataTableLabels = createStudioDataTableLabels();
  const studioDataTableSortingLabels = createStudioDataTableSortingLabels();
  const rolesApi = useRoles();
  const access = useIamResourceAccess('role');
  const canCreateRoles = isIamAccessAllowed(access.create);
  const canUpdateRoles = isIamAccessAllowed(access.update);
  const canDeleteRoles = isIamAccessAllowed(access.delete);
  const { user } = useAuth();
  const isPlatformScope = user !== null && !user.instanceId && hasPlatformInstanceAdminAccess(user);

  const [search, setSearch] = React.useState('');
  const [roleTypeFilter, setRoleTypeFilter] = React.useState<RoleTypeFilter>('studio');
  const keycloakRolesApi = useKeycloakRoles(!isPlatformScope && roleTypeFilter !== 'studio');
  const [deleteRoleId, setDeleteRoleId] = React.useState<string | null>(null);
  const deleteConfirmation = getRoleDeleteConfirmationContent();
  const visibleRoles = React.useMemo(
    () =>
      isPlatformScope ? rolesApi.roles : rolesApi.roles.filter((role) => isTenantRoleVisible(role)),
    [isPlatformScope, rolesApi.roles]
  );

  const filteredRoles = React.useMemo<readonly RoleRow[]>(() => {
    const query = search.trim().toLowerCase();
    const sourceRoles =
      isPlatformScope || roleTypeFilter === 'studio'
        ? visibleRoles.map(toLocalRoleRow)
        : keycloakRolesApi.roles.map(toKeycloakRoleRow);

    return sourceRoles.filter(
      (role) =>
        (isPlatformScope || matchesRoleTypeFilter(role, roleTypeFilter)) &&
        (!query ||
          role.roleName.toLowerCase().includes(query) ||
          role.roleKey.toLowerCase().includes(query) ||
          role.description?.toLowerCase().includes(query) ||
          role.localRole?.permissions.some((permission) =>
            permission.permissionKey.toLowerCase().includes(query)
          ))
    );
  }, [isPlatformScope, keycloakRolesApi.roles, roleTypeFilter, search, visibleRoles]);

  const showsStudioRoleDetails = isPlatformScope || roleTypeFilter === 'studio';

  const roleColumns = React.useMemo(
    () => createRoleListColumns(showsStudioRoleDetails),
    [showsStudioRoleDetails]
  );

  const selectedApi = roleTypeFilter === 'studio' || isPlatformScope ? rolesApi : keycloakRolesApi;

  return (
    <section className="space-y-5" aria-busy={selectedApi.isLoading}>
      <StudioListPageTemplate
        title={t(isPlatformScope ? 'admin.roles.page.platformTitle' : 'admin.roles.page.title')}
        description={t(
          isPlatformScope ? 'admin.roles.page.platformSubtitle' : 'admin.roles.page.subtitle'
        )}
        primaryAction={
          roleTypeFilter === 'studio' && (canUpdateRoles || (!isPlatformScope && canCreateRoles))
            ? {
                label: t(
                  isPlatformScope
                    ? 'admin.roles.actions.reconcilePlatform'
                    : 'admin.roles.actions.create'
                ),
                render: (
                  <div className="flex flex-wrap gap-2">
                    {canUpdateRoles ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void rolesApi.reconcile()}
                      >
                        {t(
                          isPlatformScope
                            ? 'admin.roles.actions.reconcilePlatform'
                            : 'admin.roles.actions.importFromKeycloak'
                        )}
                      </Button>
                    ) : null}
                    {!isPlatformScope && canCreateRoles ? (
                      <Button asChild type="button">
                        <Link to="/admin/roles/new">{t('admin.roles.actions.create')}</Link>
                      </Button>
                    ) : null}
                  </div>
                ),
              }
            : undefined
        }
      >
        <StudioDataTable
          ariaLabel={t(
            isPlatformScope ? 'admin.roles.table.platformAriaLabel' : 'admin.roles.table.ariaLabel'
          )}
          labels={studioDataTableLabels}
          caption={t(
            isPlatformScope ? 'admin.roles.table.platformCaption' : 'admin.roles.table.caption'
          )}
          data={filteredRoles}
          columns={roleColumns}
          sorting={{ mode: 'client', labels: studioDataTableSortingLabels }}
          getRowId={(role) => role.id}
          selectionMode="none"
          isLoading={selectedApi.isLoading}
          loadingState={t('content.messages.loading')}
          emptyState={
            <Card
              className="border-none p-0 text-sm text-muted-foreground shadow-none"
              role="status"
            >
              {t('admin.roles.messages.emptyState')}
            </Card>
          }
          toolbarStart={
            <RoleFilters
              search={search}
              roleType={roleTypeFilter}
              onSearchChange={setSearch}
              onRoleTypeChange={setRoleTypeFilter}
            />
          }
          rowActions={
            isPlatformScope
              ? undefined
              : (role) => {
                  if (!role.localRole) return null;
                  const localRole = role.localRole;
                  const isReadOnly = isTenantRoleReadOnly(localRole);

                  return (
                    <>
                      <Button asChild type="button" size="icon" variant="secondary">
                        <Link
                          to="/admin/roles/$roleId"
                          params={{ roleId: role.id }}
                          aria-label={t('admin.roles.actions.edit')}
                          title={t('admin.roles.actions.edit')}
                        >
                          <IconEdit aria-hidden="true" className="h-4 w-4" />
                        </Link>
                      </Button>
                      {canUpdateRoles && localRole.syncState === 'failed' ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          disabled={localRole.managedBy !== 'studio'}
                          aria-label={t('admin.roles.actions.retrySync')}
                          title={t('admin.roles.actions.retrySync')}
                          onClick={() => void rolesApi.retryRoleSync(role.id)}
                        >
                          <IconRefresh aria-hidden="true" className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {canDeleteRoles ? (
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
                      ) : null}
                    </>
                  );
                }
          }
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
            <span>
              {t('admin.roles.messages.reconcileSummary', {
                checked: String(rolesApi.reconcileReport.checkedCount),
                corrected: String(rolesApi.reconcileReport.correctedCount),
                failed: String(rolesApi.reconcileReport.failedCount),
                manual: String(rolesApi.reconcileReport.manualReviewCount),
              })}
            </span>
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

      {selectedApi.error ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>
              {roleErrorMessage(selectedApi.error, 'admin.roles.messages.error', {
                includeKeycloakReconcileError: true,
                includeRecoveryRunningError: true,
              })}
            </span>
            <IamRuntimeDiagnosticDetails error={selectedApi.error} />
            <div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void selectedApi.refetch()}
              >
                {t('admin.roles.actions.retry')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <ConfirmDialog
        open={canDeleteRoles && Boolean(deleteRoleId)}
        title={deleteConfirmation.title}
        description={deleteConfirmation.description}
        confirmLabel={deleteConfirmation.confirmLabel}
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
