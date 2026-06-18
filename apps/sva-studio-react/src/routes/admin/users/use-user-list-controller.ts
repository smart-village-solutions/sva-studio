import type { IamUserImportSyncReport } from '@sva/core';
import React from 'react';

import { userErrorMessage } from './-user-error-message';
import {
  executeStatusAction,
  resolveSyncStatus,
  type StatusActionDialogState,
  type SyncStatusState,
  type UsersApiState,
} from './user-list-model';

type UseUserListControllerOptions = {
  readonly usersApi: UsersApiState;
};

export const useUserListController = ({ usersApi }: UseUserListControllerOptions) => {
  const [statusActionDialog, setStatusActionDialog] = React.useState<StatusActionDialogState | null>(null);
  const [syncStatus, setSyncStatus] = React.useState<SyncStatusState>('idle');
  const [syncResult, setSyncResult] = React.useState<IamUserImportSyncReport | null>(null);
  const [syncError, setSyncError] = React.useState<Parameters<typeof userErrorMessage>[0]>(null);

  const onSyncUsers = React.useCallback(async () => {
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
    setSyncStatus(resolveSyncStatus(result.report));
  }, [usersApi]);

  const onConfirmStatusAction = React.useCallback(async () => {
    const action = statusActionDialog;
    setStatusActionDialog(null);
    await executeStatusAction(usersApi, action);
  }, [statusActionDialog, usersApi]);

  const openSingleStatusAction = React.useCallback((action: 'activate' | 'deactivate', userId: string) => {
    setStatusActionDialog({
      action,
      mode: 'single',
      userId,
    });
  }, []);

  const openBulkDeactivate = React.useCallback((userIds: string[]) => {
    setStatusActionDialog({
      action: 'deactivate',
      mode: 'bulk',
      userIds,
    });
  }, []);

  return {
    closeStatusActionDialog: () => setStatusActionDialog(null),
    onConfirmStatusAction,
    onSyncUsers,
    openBulkDeactivate,
    openSingleStatusAction,
    statusActionDialog,
    syncError,
    syncResult,
    syncStatus,
  };
};
