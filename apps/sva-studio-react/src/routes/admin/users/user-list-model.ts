import type { IamUserImportSyncReport } from '@sva/core';

import type { useUsers } from '../../../hooks/use-users';

export type StatusActionDialogState =
  | {
      action: 'activate';
      mode: 'single';
      userId: string;
    }
  | {
      action: 'deactivate';
      mode: 'single';
      userId: string;
    }
  | {
      action: 'deactivate';
      mode: 'bulk';
      userIds: string[];
    };

export type UsersApiState = ReturnType<typeof useUsers>;
export type SyncStatusState = 'idle' | 'pending' | 'success' | 'empty' | 'error';

export const executeStatusAction = async (
  usersApi: UsersApiState,
  action: StatusActionDialogState | null,
): Promise<void> => {
  if (!action) {
    return;
  }

  if (action.action === 'activate') {
    await usersApi.updateUser(action.userId, { status: 'active' });
    return;
  }

  if (action.mode === 'single') {
    await usersApi.deactivateUser(action.userId);
    return;
  }

  await usersApi.bulkDeactivate(action.userIds);
};

export const resolveSyncStatus = (report: IamUserImportSyncReport): Extract<SyncStatusState, 'success' | 'empty'> =>
  report.importedCount === 0
  && report.updatedCount === 0
  && report.manualReviewCount === 0
    ? 'empty'
    : 'success';

export const getStatusActionDialogTranslationKeys = (statusActionDialog: StatusActionDialogState | null) => ({
  title:
    statusActionDialog?.action === 'activate'
      ? 'admin.users.confirm.activateTitle'
      : statusActionDialog?.mode === 'bulk'
        ? 'admin.users.confirm.bulkTitle'
        : 'admin.users.confirm.singleTitle',
  description:
    statusActionDialog?.action === 'activate'
      ? 'admin.users.confirm.activateDescription'
      : statusActionDialog?.mode === 'bulk'
        ? 'admin.users.confirm.bulkDescription'
        : 'admin.users.confirm.singleDescription',
  confirmLabel: statusActionDialog?.action === 'activate' ? 'admin.users.actions.activate' : 'admin.users.actions.deactivate',
});
