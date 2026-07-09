import type {
  IamKeycloakMappingStatus,
  IamKeycloakObjectDiagnostic,
  IamKeycloakObjectEditability,
  IamUserImportSyncReport,
} from '@sva/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
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
import { useUsers } from '../../../hooks/use-users';
import { hasPlatformInstanceAdminAccess, hasUserDeleteAccess, isIamBulkEnabled } from '../../../lib/iam-admin-access';
import { useAuth } from '../../../providers/auth-provider';
import { t } from '../../../i18n';
import { IamRuntimeDiagnosticDetails } from '../-iam-runtime-diagnostic-details';
import { userErrorMessage } from './-user-error-message';
import { useUserListController } from './use-user-list-controller';
import {
  getStatusActionDialogTranslationKeys,
  type BulkReprovisionFeedbackState,
  type SyncStatusState,
  type UsersApiState,
} from './user-list-model';

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

type UserListUser = UsersApiState['users'][number];

const UserStatusCell = ({
  user,
  isAuthLoading,
  isPlatformScope,
  onStatusAction,
}: {
  user: UserListUser;
  isAuthLoading: boolean;
  isPlatformScope: boolean;
  onStatusAction: (action: 'activate' | 'deactivate', userId: string) => void;
}) =>
  isPlatformScope || isAuthLoading ? (
    <Badge className={`rounded-full ${statusClassByValue[user.status]}`} variant="outline">
      {t(statusTranslationKeyByValue[user.status])}
    </Badge>
  ) : (
    <div className="flex items-center gap-2">
      <Switch
        checked={user.status !== 'inactive'}
        disabled={user.editability === 'blocked' || user.editability === 'read_only'}
        aria-label={t('admin.users.messages.statusSwitchLabel', {
          name: user.displayName,
        })}
        onCheckedChange={(checked) => onStatusAction(checked ? 'activate' : 'deactivate', user.id)}
      />
      {user.status === 'pending' ? (
        <Badge className={`rounded-full ${statusClassByValue[user.status]}`} variant="outline">
          {t(statusTranslationKeyByValue[user.status])}
        </Badge>
      ) : null}
    </div>
  );

const UserKeycloakCell = ({ user }: { user: UserListUser }) => {
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
};

const buildUserColumns = (
  isAuthLoading: boolean,
  isPlatformScope: boolean,
  onStatusAction: (action: 'activate' | 'deactivate', userId: string) => void,
): readonly StudioColumnDef<UserListUser>[] => [
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
      <UserStatusCell
        user={user}
        isAuthLoading={isAuthLoading}
        isPlatformScope={isPlatformScope}
        onStatusAction={onStatusAction}
      />
    ),
    sortable: true,
    sortValue: (user) => user.status,
  },
  {
    id: 'keycloak',
    header: t('admin.users.table.headerKeycloak'),
    cell: (user) => <UserKeycloakCell user={user} />,
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
];

const UserListToolbarStart = ({ usersApi }: { usersApi: UsersApiState }) => (
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
);

const UserListToolbarEnd = ({
  syncStatus,
  total,
  onSyncUsers,
}: {
  syncStatus: SyncStatusState;
  total: number;
  onSyncUsers: () => Promise<void>;
}) => (
  <>
    <p role="status" className="text-xs text-muted-foreground">
      {t('admin.users.messages.resultCount', { count: total })}
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
);

const UserListSyncFeedback = ({
  syncError,
  syncResult,
  syncStatus,
  onRetry,
}: {
  syncError: Parameters<typeof userErrorMessage>[0];
  syncResult: IamUserImportSyncReport | null;
  syncStatus: SyncStatusState;
  onRetry: () => Promise<void>;
}) => {
  if (syncStatus === 'pending') {
    return (
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {t('admin.users.messages.syncRunning')}
      </p>
    );
  }

  if (syncStatus === 'success' && syncResult) {
    return (
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
    );
  }

  if (syncStatus === 'empty' && syncResult) {
    return (
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
    );
  }

  if (syncStatus === 'error' && syncError) {
    return (
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive" role="alert">
        <AlertDescription className="flex flex-col gap-3">
          <span>{userErrorMessage(syncError)}</span>
          <IamRuntimeDiagnosticDetails error={syncError} />
          <div>
            <Button type="button" size="sm" variant="outline" onClick={() => void onRetry()}>
              {t('admin.users.actions.retry')}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

const UserListErrorAlert = ({
  error,
  onRetry,
}: {
  error: UsersApiState['error'];
  onRetry: () => void;
}) =>
  error ? (
    <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
      <AlertDescription className="flex flex-col gap-3">
        <span>{userErrorMessage(error)}</span>
        <IamRuntimeDiagnosticDetails error={error} />
        <div>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            {t('admin.users.actions.retry')}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  ) : null;

const UserListBulkReprovisionFeedback = ({
  feedback,
}: {
  feedback: BulkReprovisionFeedbackState;
}) => {
  if (!feedback) {
    return null;
  }

  return (
    <Alert className="border-secondary/40 bg-secondary/10 text-secondary" role="status">
      <AlertDescription className="flex flex-col gap-2">
        <span>{t('admin.users.messages.bulkReprovisionSuccessCount', { count: feedback.successCount })}</span>
        <span>{t('admin.users.messages.bulkReprovisionFailureCount', { count: feedback.failureCount })}</span>
        {feedback.failures.length > 0 ? (
          <ul className="list-disc pl-5 text-xs text-muted-foreground" aria-label={t('admin.users.messages.bulkReprovisionFailuresLabel')}>
            {feedback.failures.map((failure) => (
              <li key={failure.id}>
                {t('admin.users.messages.bulkReprovisionFailureItem', {
                  id: failure.id,
                  code: failure.code,
                  message: failure.message,
                })}
              </li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  );
};

const UserListPaginationFooter = ({
  page,
  pageCount,
  setPage,
}: {
  page: number;
  pageCount: number;
  setPage: (page: number) => void;
}) => (
  <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
    <p key={page} className="animate-pagination-active" aria-live="polite">
      {t('admin.users.pagination.pageLabel', { page, totalPages: pageCount })}
    </p>
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        {t('admin.users.pagination.previous')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={page >= pageCount}
        onClick={() => setPage(page + 1)}
      >
        {t('admin.users.pagination.next')}
      </Button>
    </div>
  </footer>
);

const hasSystemAdminTargetRole = (user: UserListUser): boolean =>
  user.roles.some((role) => role.roleKey === 'system_admin');

const UserListRowActions = ({
  canDeleteUsers,
  onDeleteAction,
  user,
}: {
  canDeleteUsers: boolean;
  onDeleteAction: (userId: string) => void;
  user: UserListUser;
}) => {
  const editBlocked = user.editability === 'blocked';
  const deleteBlocked = editBlocked || user.editability === 'read_only' || hasSystemAdminTargetRole(user);
  const deleteDisabledReason = hasSystemAdminTargetRole(user)
    ? t('admin.users.confirm.deleteSystemAdminDisabled')
    : t('admin.users.actions.delete');

  return (
    <>
      {editBlocked ? (
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled
          aria-label={t('admin.users.actions.edit')}
          title={t('admin.users.actions.edit')}
        >
          <IconEdit aria-hidden="true" className="h-4 w-4" />
        </Button>
      ) : (
        <Button asChild type="button" size="icon" variant="outline">
          <Link
            to="/admin/users/$userId"
            params={{ userId: user.id }}
            aria-label={t('admin.users.actions.edit')}
            title={t('admin.users.actions.edit')}
          >
            <IconEdit aria-hidden="true" className="h-4 w-4" />
          </Link>
        </Button>
      )}
      {canDeleteUsers ? (
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={deleteBlocked}
          aria-label={t('admin.users.actions.delete')}
          title={deleteBlocked ? deleteDisabledReason : t('admin.users.actions.delete')}
          onClick={() => onDeleteAction(user.id)}
        >
          <IconTrash aria-hidden="true" className="h-4 w-4" />
        </Button>
      ) : null}
    </>
  );
};

export const UserListPage = () => {
  const studioDataTableLabels = createStudioDataTableLabels();
  const usersApi = useUsers();
  const [deleteUserId, setDeleteUserId] = React.useState<string | null>(null);
  const {
    bulkReprovisionFeedback,
    closeStatusActionDialog,
    onConfirmStatusAction,
    onSyncUsers,
    openBulkDeactivate,
    openBulkReprovisionMainserver,
    openSingleStatusAction,
    statusActionDialog,
    syncError,
    syncResult,
    syncStatus,
  } = useUserListController({ usersApi });
  const { user } = useAuth();
  const isPlatformScope = user !== null && !user.instanceId && hasPlatformInstanceAdminAccess(user);
  const isAuthLoading = user === null;
  const canDeleteUsers = !isPlatformScope && !isAuthLoading && hasUserDeleteAccess(user);
  const statusActionDialogKeys = getStatusActionDialogTranslationKeys(statusActionDialog);

  const pageCount = Math.max(1, Math.ceil(usersApi.total / usersApi.pageSize));
  const userColumns = React.useMemo(
    () => buildUserColumns(isAuthLoading, isPlatformScope, openSingleStatusAction),
    [isAuthLoading, isPlatformScope, openSingleStatusAction]
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
          labels={studioDataTableLabels}
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
                    onClick: ({ selectedRows }) => openBulkDeactivate(selectedRows.map((user) => user.id)),
                  },
                  {
                    id: 'bulk-reprovision-mainserver',
                    label: t('admin.users.actions.reprovisionMainserverData'),
                    onClick: ({ selectedRows }) =>
                      openBulkReprovisionMainserver(selectedRows.map((user) => user.id)),
                  },
                ]
              : []
          }
          toolbarStart={<UserListToolbarStart usersApi={usersApi} />}
          toolbarEnd={<UserListToolbarEnd syncStatus={syncStatus} total={usersApi.total} onSyncUsers={onSyncUsers} />}
          rowActions={
            isPlatformScope || isAuthLoading
              ? undefined
              : (user) => (
                  <UserListRowActions
                    canDeleteUsers={canDeleteUsers}
                    onDeleteAction={setDeleteUserId}
                    user={user}
                  />
                )
          }
        />
      </StudioListPageTemplate>

      <UserListSyncFeedback
        syncStatus={syncStatus}
        syncResult={syncResult}
        syncError={syncError}
        onRetry={onSyncUsers}
      />

      <UserListBulkReprovisionFeedback feedback={bulkReprovisionFeedback} />

      <UserListErrorAlert error={usersApi.error} onRetry={() => void usersApi.refetch()} />

      <UserListPaginationFooter page={usersApi.page} pageCount={pageCount} setPage={usersApi.setPage} />

      <ConfirmDialog
        open={Boolean(statusActionDialog)}
        title={t(statusActionDialogKeys.title)}
        description={t(statusActionDialogKeys.description)}
        confirmLabel={t(statusActionDialogKeys.confirmLabel)}
        cancelLabel={t('account.actions.cancel')}
        onCancel={closeStatusActionDialog}
        onConfirm={() => void onConfirmStatusAction()}
      />
      <ConfirmDialog
        open={Boolean(deleteUserId)}
        title={t('admin.users.confirm.deleteTitle')}
        description={t('admin.users.confirm.deleteDescription')}
        confirmLabel={t('admin.users.actions.delete')}
        cancelLabel={t('account.actions.cancel')}
        onCancel={() => setDeleteUserId(null)}
        onConfirm={async () => {
          const userId = deleteUserId;
          setDeleteUserId(null);
          if (userId) {
            await usersApi.deleteUser(userId);
          }
        }}
      />
    </section>
  );
};
