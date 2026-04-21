import type {
  IamKeycloakMappingStatus,
  IamKeycloakObjectDiagnostic,
  IamKeycloakObjectEditability,
  IamUserImportSyncReport,
} from '@sva/core';
import { Link } from '@tanstack/react-router';
import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { StudioDataTable, type StudioColumnDef } from '../../../components/StudioDataTable';
import { StudioListPageTemplate } from '../../../components/StudioListPageTemplate';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { useUsers } from '../../../hooks/use-users';
import { isIamBulkEnabled } from '../../../lib/iam-admin-access';
import { useAuth } from '../../../providers/auth-provider';
import { t } from '../../../i18n';
import { IamRuntimeDiagnosticDetails } from '../-iam-runtime-diagnostic-details';
import { userErrorMessage } from './-user-error-message';

const statusClassByValue: Record<'active' | 'inactive' | 'pending', string> = {
  active: 'border-primary/40 bg-primary/15 text-primary',
  inactive: 'border-destructive/40 bg-destructive/10 text-destructive',
  pending: 'border-secondary/40 bg-secondary/10 text-secondary',
};

const statusTranslationKeyByValue = {
  active: 'account.status.active',
  inactive: 'account.status.inactive',
  pending: 'account.status.pending',
} as const;

const syncOutcomeTranslationKey = {
  success: 'admin.users.messages.syncOutcome.success',
  partial_failure: 'admin.users.messages.syncOutcome.partialFailure',
  blocked: 'admin.users.messages.syncOutcome.blocked',
  failed: 'admin.users.messages.syncOutcome.failed',
} as const;

const mappingStatusTranslationKey: Record<IamKeycloakMappingStatus, string> = {
  mapped: 'admin.users.mapping.mapped',
  unmapped: 'admin.users.mapping.unmapped',
  manual_review: 'admin.users.mapping.manualReview',
};

const editabilityTranslationKey: Record<IamKeycloakObjectEditability, string> = {
  editable: 'admin.users.editability.editable',
  read_only: 'admin.users.editability.readOnly',
  blocked: 'admin.users.editability.blocked',
};

const editabilityClassByValue: Record<IamKeycloakObjectEditability, string> = {
  editable: 'border-primary/40 bg-primary/10 text-primary',
  read_only: 'border-secondary/40 bg-secondary/10 text-secondary',
  blocked: 'border-destructive/40 bg-destructive/10 text-destructive',
};

const renderDiagnosticCodes = (diagnostics: readonly IamKeycloakObjectDiagnostic[] | undefined) =>
  diagnostics && diagnostics.length > 0 ? (
    <span className="block text-xs text-muted-foreground">
      {t('admin.users.messages.diagnosticCodes', {
        codes: diagnostics.map((diagnostic) => diagnostic.code).join(', '),
      })}
    </span>
  ) : null;

export const UserListPage = () => {
  const usersApi = useUsers();

  const [deactivateDialog, setDeactivateDialog] = React.useState<{ mode: 'single' | 'bulk'; userId?: string; userIds?: string[] } | null>(
    null
  );
  const [syncStatus, setSyncStatus] = React.useState<'idle' | 'pending' | 'success' | 'empty' | 'error'>('idle');
  const [syncResult, setSyncResult] = React.useState<IamUserImportSyncReport | null>(null);
  const [syncError, setSyncError] = React.useState<Parameters<typeof userErrorMessage>[0]>(null);
  const { user } = useAuth();
  const isPlatformScope = user !== null && !user.instanceId;
  const isAuthLoading = user === null;

  const onConfirmDeactivate = async () => {
    const action = deactivateDialog;
    setDeactivateDialog(null);

    if (!action) {
      return;
    }

    if (action.mode === 'single' && action.userId) {
      await usersApi.deactivateUser(action.userId);
      return;
    }

    if (action.mode === 'bulk' && action.userIds) {
      await usersApi.bulkDeactivate(action.userIds);
    }
  };

  const onSyncUsers = async () => {
    setSyncStatus('pending');
    setSyncResult(null);
    setSyncError(null);
    const result = await usersApi.syncUsersFromKeycloak();
    if (!result.ok) {
      setSyncStatus('error');
      setSyncError(result.error);
      return;
    }

    setSyncResult(result.report);
    setSyncStatus(
      result.report.importedCount === 0 &&
        result.report.updatedCount === 0 &&
        result.report.manualReviewCount === 0
        ? 'empty'
        : 'success'
    );
  };

  const pageCount = Math.max(1, Math.ceil(usersApi.total / usersApi.pageSize));
  const userColumns = React.useMemo<readonly StudioColumnDef<(typeof usersApi.users)[number]>[]>(
    () => [
      {
        id: 'displayName',
        header: t('admin.users.table.headerName'),
        cell: (user) => user.displayName,
        sortable: true,
        sortValue: (user) => user.displayName.toLowerCase(),
      },
      {
        id: 'email',
        header: t('admin.users.table.headerEmail'),
        cell: (user) => user.email ?? '-',
        sortable: true,
        sortValue: (user) => (user.email ?? '').toLowerCase(),
      },
      {
        id: 'role',
        header: t('admin.users.table.headerRole'),
        cell: (user) => user.roles[0]?.roleName ?? '-',
        sortable: true,
        sortValue: (user) => (user.roles[0]?.roleName ?? '').toLowerCase(),
      },
      {
        id: 'status',
        header: t('admin.users.table.headerStatus'),
        cell: (user) => (
          <Badge className={`rounded-full ${statusClassByValue[user.status]}`} variant="outline">
            {t(statusTranslationKeyByValue[user.status])}
          </Badge>
        ),
        sortable: true,
        sortValue: (user) => user.status,
      },
      {
        id: 'keycloak',
        header: t('admin.users.table.headerKeycloak'),
        cell: (user) => {
          const mappingStatus = user.mappingStatus ?? 'mapped';
          const editability = user.editability ?? 'editable';
          return (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge className="rounded-full" variant="outline">
                  {t(mappingStatusTranslationKey[mappingStatus])}
                </Badge>
                <Badge className={`rounded-full ${editabilityClassByValue[editability]}`} variant="outline">
                  {t(editabilityTranslationKey[editability])}
                </Badge>
              </div>
              {renderDiagnosticCodes(user.diagnostics)}
            </div>
          );
        },
        sortable: true,
        sortValue: (user) => `${user.mappingStatus ?? 'mapped'}:${user.editability ?? 'editable'}`,
      },
      {
        id: 'lastLoginAt',
        header: t('admin.users.table.headerLastLogin'),
        cell: (user) => user.lastLoginAt ?? '-',
        sortable: true,
        sortValue: (user) => user.lastLoginAt ?? '',
      },
    ],
    [usersApi.users]
  );

  return (
    <section className="space-y-5" aria-busy={usersApi.isLoading}>
      <StudioListPageTemplate
        title={t(isPlatformScope ? 'admin.users.page.platformTitle' : 'admin.users.page.title')}
        description={t(isPlatformScope ? 'admin.users.page.platformSubtitle' : 'admin.users.page.subtitle')}
        primaryAction={
          isPlatformScope || isAuthLoading
            ? undefined
            : {
                label: t('admin.users.actions.create'),
                render: (
                  <Button asChild type="button">
                    <Link to="/admin/users/new">{t('admin.users.actions.create')}</Link>
                  </Button>
                ),
              }
        }
      >
        <StudioDataTable
          ariaLabel={t(isPlatformScope ? 'admin.users.table.platformAriaLabel' : 'admin.users.table.ariaLabel')}
          caption={t(isPlatformScope ? 'admin.users.table.platformCaption' : 'admin.users.table.caption')}
          data={usersApi.users}
          columns={userColumns}
          getRowId={(user) => user.id}
          isLoading={usersApi.isLoading}
          loadingState={t('content.messages.loading')}
          emptyState={
            <Card className="border-none p-0 text-sm text-muted-foreground shadow-none" role="status">
              {t('admin.users.messages.emptyState')}
            </Card>
          }
          bulkActions={
            isIamBulkEnabled() && !isPlatformScope
              ? [
                  {
                    id: 'bulk-deactivate',
                    label: t('admin.users.actions.bulkDeactivate'),
                    variant: 'destructive',
                    onClick: ({ selectedRows }) =>
                      setDeactivateDialog({
                        mode: 'bulk',
                        userIds: selectedRows.map((user) => user.id),
                      }),
                  },
                ]
              : []
          }
          toolbarStart={
            <>
              <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <Label htmlFor="users-search">{t('admin.users.filters.searchLabel')}</Label>
                <Input
                  id="users-search"
                  placeholder={t('admin.users.filters.searchPlaceholder')}
                  value={usersApi.filters.search}
                  onChange={(event) => usersApi.setSearch(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <Label htmlFor="users-status">{t('admin.users.filters.statusLabel')}</Label>
                <Select
                  id="users-status"
                  value={usersApi.filters.status}
                  onChange={(event) => usersApi.setStatus(event.target.value as 'active' | 'inactive' | 'pending' | 'all')}
                >
                  <option value="all">{t('admin.users.filters.statusAll')}</option>
                  <option value="active">{t('admin.users.filters.statusActive')}</option>
                  <option value="inactive">{t('admin.users.filters.statusInactive')}</option>
                  <option value="pending">{t('admin.users.filters.statusPending')}</option>
                </Select>
              </div>
            </>
          }
          toolbarEnd={
            <>
              <p role="status" className="text-xs text-muted-foreground">
                {t('admin.users.messages.resultCount', { count: usersApi.total })}
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={syncStatus === 'pending'}
                onClick={() => void onSyncUsers()}
              >
                {syncStatus === 'pending' ? t('admin.users.actions.syncing') : t('admin.users.actions.syncKeycloak')}
              </Button>
            </>
          }
          rowActions={isPlatformScope || isAuthLoading ? undefined : (user) => (
            <>
              {user.editability === 'blocked' ? (
                <Button size="sm" variant="outline" disabled>
                  {t('admin.users.actions.edit')}
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <Link to="/admin/users/$userId" params={{ userId: user.id }}>
                    {t('admin.users.actions.edit')}
                  </Link>
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={user.editability === 'blocked' || user.editability === 'read_only'}
                onClick={() => setDeactivateDialog({ mode: 'single', userId: user.id })}
              >
                {t('admin.users.actions.deactivate')}
              </Button>
            </>
          )}
        />
      </StudioListPageTemplate>

      {syncStatus === 'pending' ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {t('admin.users.messages.syncRunning')}
        </p>
      ) : null}

      {syncStatus === 'success' && syncResult ? (
        <Alert className="border-secondary/40 bg-secondary/10 text-secondary" role="status">
          <AlertDescription>
            {t('admin.users.messages.syncResult', {
              checkedCount: syncResult.checkedCount,
              correctedCount: syncResult.correctedCount,
              manualReviewCount: syncResult.manualReviewCount,
              importedCount: syncResult.importedCount,
              updatedCount: syncResult.updatedCount,
              skippedCount: syncResult.skippedCount,
            })}
            <span className="block text-xs text-muted-foreground">
              {t(syncOutcomeTranslationKey[syncResult.outcome])}
            </span>
            {syncResult.diagnostics ? (
              <span className="block text-xs text-muted-foreground">
                {t('admin.users.messages.syncDiagnostics', {
                  authRealm: syncResult.diagnostics.authRealm,
                  providerSource:
                    syncResult.diagnostics.providerSource === 'instance'
                      ? t('admin.users.messages.syncProviderSource.instance')
                      : syncResult.diagnostics.providerSource === 'fallback_global'
                        ? t('admin.users.messages.syncProviderSource.fallback_global')
                        : syncResult.diagnostics.providerSource === 'platform'
                          ? t('admin.users.messages.syncProviderSource.platform')
                          : t('admin.users.messages.syncProviderSource.global'),
                  matchedWithoutInstanceAttributeCount: String(
                    syncResult.diagnostics.matchedWithoutInstanceAttributeCount ?? 0
                  ),
                })}
              </span>
            ) : null}
            {syncResult.objects && syncResult.objects.length > 0 ? (
              <span className="block text-xs text-muted-foreground">
                {t('admin.users.messages.syncObjectDiagnostics', {
                  count: syncResult.objects.length,
                  codes: Array.from(
                    new Set(
                      syncResult.objects.flatMap((entry) =>
                        entry.diagnostics.map((diagnostic) => diagnostic.code)
                      )
                    )
                  ).join(', '),
                })}
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {syncStatus === 'empty' && syncResult ? (
        <Alert className="border-secondary/40 bg-secondary/10 text-secondary" role="status">
          <AlertDescription>
            {t('admin.users.messages.syncEmpty', {
              skippedCount: syncResult.skippedCount,
            })}
            <span className="block text-xs text-muted-foreground">
              {t(syncOutcomeTranslationKey[syncResult.outcome])}
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      {syncStatus === 'error' && syncError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive" role="alert">
          <AlertDescription className="flex flex-col gap-3">
            <span>{userErrorMessage(syncError)}</span>
            <IamRuntimeDiagnosticDetails error={syncError} />
            <div>
              <Button type="button" size="sm" variant="outline" onClick={() => void onSyncUsers()}>
                {t('admin.users.actions.retry')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {usersApi.error ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>{userErrorMessage(usersApi.error)}</span>
            <IamRuntimeDiagnosticDetails error={usersApi.error} />
            <div>
              <Button type="button" size="sm" variant="outline" onClick={() => void usersApi.refetch()}>
                {t('admin.users.actions.retry')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          {t('admin.users.pagination.pageLabel', { page: usersApi.page, totalPages: pageCount })}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={usersApi.page <= 1}
            onClick={() => usersApi.setPage(usersApi.page - 1)}
          >
            {t('admin.users.pagination.previous')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={usersApi.page >= pageCount}
            onClick={() => usersApi.setPage(usersApi.page + 1)}
          >
            {t('admin.users.pagination.next')}
          </Button>
        </div>
      </footer>

      <ConfirmDialog
        open={Boolean(deactivateDialog)}
        title={t(
          deactivateDialog?.mode === 'bulk'
            ? 'admin.users.confirm.bulkTitle'
            : 'admin.users.confirm.singleTitle'
        )}
        description={t(
          deactivateDialog?.mode === 'bulk'
            ? 'admin.users.confirm.bulkDescription'
            : 'admin.users.confirm.singleDescription'
        )}
        confirmLabel={t('admin.users.actions.deactivate')}
        cancelLabel={t('account.actions.cancel')}
        onCancel={() => setDeactivateDialog(null)}
        onConfirm={() => void onConfirmDeactivate()}
      />
    </section>
  );
};
