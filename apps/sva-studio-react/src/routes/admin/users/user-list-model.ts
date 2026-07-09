import type { IamUserImportSyncReport } from '@sva/core';
import type { BulkReprovisionMainserverUsersResult } from '../../../lib/iam-api';

import type { useUsers } from '../../../hooks/use-users';

export type UserMutationDialogState =
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
    }
  | {
      action: 'reprovision-mainserver';
      mode: 'bulk';
      userIds: string[];
    };

export type UsersApiState = ReturnType<typeof useUsers>;
export type SyncStatusState = 'idle' | 'pending' | 'success' | 'empty' | 'error';
export type BulkReprovisionFeedbackState = BulkReprovisionMainserverUsersResult | null;

export const executeStatusAction = async (
  usersApi: UsersApiState,
  action: UserMutationDialogState | null,
): Promise<BulkReprovisionMainserverUsersResult | null> => {
  if (!action) {
    return null;
  }

  if (action.action === 'activate') {
    await usersApi.updateUser(action.userId, { status: 'active' });
    return null;
  }

  if (action.action === 'deactivate' && action.mode === 'single') {
    await usersApi.deactivateUser(action.userId);
    return null;
  }

  if (action.action === 'reprovision-mainserver') {
    return await usersApi.bulkReprovisionMainserver(action.userIds);
  }

  await usersApi.bulkDeactivate(action.userIds);
  return null;
};

export const resolveSyncStatus = (report: IamUserImportSyncReport): Extract<SyncStatusState, 'success' | 'empty'> =>
  report.importedCount === 0
  && report.updatedCount === 0
  && report.manualReviewCount === 0
    ? 'empty'
    : 'success';

export const getStatusActionDialogTranslationKeys = (statusActionDialog: UserMutationDialogState | null) => ({
  title:
    statusActionDialog?.action === 'activate'
      ? 'admin.users.confirm.activateTitle'
      : statusActionDialog?.action === 'reprovision-mainserver'
        ? 'admin.users.confirm.bulkReprovisionTitle'
      : statusActionDialog?.mode === 'bulk'
        ? 'admin.users.confirm.bulkTitle'
        : 'admin.users.confirm.singleTitle',
  description:
    statusActionDialog?.action === 'activate'
      ? 'admin.users.confirm.activateDescription'
      : statusActionDialog?.action === 'reprovision-mainserver'
        ? 'admin.users.confirm.bulkReprovisionDescription'
      : statusActionDialog?.mode === 'bulk'
        ? 'admin.users.confirm.bulkDescription'
        : 'admin.users.confirm.singleDescription',
  confirmLabel:
    statusActionDialog?.action === 'activate'
      ? 'admin.users.actions.activate'
      : statusActionDialog?.action === 'reprovision-mainserver'
        ? 'admin.users.actions.reprovisionMainserverData'
        : 'admin.users.actions.deactivate',
});
