import { Button, StudioDataTable, StudioListPageTemplate } from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';
import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { createStudioDataTableLabels } from '../../../components/studio-data-table-labels';
import { Card } from '../../../components/ui/card';
import { isIamAccessAllowed, useIamResourceAccess } from '../../../hooks/use-iam-resource-access';
import { useUsers } from '../../../hooks/use-users';
import { t } from '../../../i18n';
import { hasPlatformInstanceAdminAccess, isIamBulkEnabled } from '../../../lib/iam-admin-access';
import { useAuth } from '../../../providers/auth-provider';
import { useUserListController } from './use-user-list-controller';
import { getStatusActionDialogTranslationKeys } from './user-list-model';

import {
  UserListBulkReprovisionFeedback,
  UserListErrorAlert,
  UserListPaginationFooter,
  UserListSyncFeedback,
} from './-user-list-feedback';
import {
  buildUserColumns,
  UserListRowActions,
  UserListToolbarEnd,
  UserListToolbarStart,
} from './-user-list-table';

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
  const access = useIamResourceAccess('user');
  const roleAccess = useIamResourceAccess('role');
  const isPlatformScope = user !== null && !user.instanceId && hasPlatformInstanceAdminAccess(user);
  const isAuthLoading = user === null;
  const canCreateUsers = isIamAccessAllowed(access.create);
  const canUpdateUsers = isIamAccessAllowed(access.update);
  const canDeleteUsers = isIamAccessAllowed(access.delete);
  const canManageKeycloakRoles = isIamAccessAllowed(roleAccess.update);
  const statusActionDialogKeys = getStatusActionDialogTranslationKeys(statusActionDialog);

  const pageCount = Math.max(1, Math.ceil(usersApi.total / usersApi.pageSize));
  const userColumns = React.useMemo(
    () => buildUserColumns(isAuthLoading, isPlatformScope, canUpdateUsers, openSingleStatusAction),
    [canUpdateUsers, isAuthLoading, isPlatformScope, openSingleStatusAction]
  );

  return (
    <section className="space-y-5" aria-busy={usersApi.isLoading}>
      <StudioListPageTemplate
        title={t(isPlatformScope ? 'admin.users.page.platformTitle' : 'admin.users.page.title')}
        description={t(
          isPlatformScope ? 'admin.users.page.platformSubtitle' : 'admin.users.page.subtitle'
        )}
        primaryAction={
          isPlatformScope || isAuthLoading || !canCreateUsers
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
          ariaLabel={t(
            isPlatformScope ? 'admin.users.table.platformAriaLabel' : 'admin.users.table.ariaLabel'
          )}
          labels={studioDataTableLabels}
          sorting={{ mode: 'disabled' }}
          caption={t(
            isPlatformScope ? 'admin.users.table.platformCaption' : 'admin.users.table.caption'
          )}
          data={usersApi.users}
          columns={userColumns}
          getRowId={(user) => user.id}
          isLoading={usersApi.isLoading}
          loadingState={t('content.messages.loading')}
          emptyState={
            <Card
              className="border-none p-0 text-sm text-muted-foreground shadow-none"
              role="status"
            >
              {t('admin.users.messages.emptyState')}
            </Card>
          }
          bulkActions={
            isIamBulkEnabled() && !isPlatformScope && canUpdateUsers
              ? [
                  {
                    id: 'bulk-deactivate',
                    label: t('admin.users.actions.bulkDeactivate'),
                    variant: 'destructive',
                    onClick: ({ selectedRows }) =>
                      openBulkDeactivate(selectedRows.map((user) => user.id)),
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
          toolbarEnd={
            <UserListToolbarEnd
              canUpdateUsers={canUpdateUsers}
              syncStatus={syncStatus}
              total={usersApi.total}
              onSyncUsers={onSyncUsers}
            />
          }
          rowActions={
            isPlatformScope || isAuthLoading
              ? undefined
              : (user) => (
                  <UserListRowActions
                    canManageKeycloakRoles={canManageKeycloakRoles}
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

      <UserListPaginationFooter
        page={usersApi.page}
        pageCount={pageCount}
        setPage={usersApi.setPage}
      />

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
