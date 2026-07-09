import type { IamUserImportSyncReport } from '@sva/core';
import React from 'react';

import { userErrorMessage } from './-user-error-message';
import {
  type BulkReprovisionFeedbackState,
  executeStatusAction,
  resolveSyncStatus,
  type UserMutationDialogState,
  type SyncStatusState,
  type UsersApiState,
} from './user-list-model';

type UseUserListControllerOptions = {
  readonly usersApi: UsersApiState;
};

export const useUserListController = ({ usersApi }: UseUserListControllerOptions) => {
  const [statusActionDialog, setStatusActionDialog] = React.useState<UserMutationDialogState | null>(null);
  const [syncStatus, setSyncStatus] = React.useState<SyncStatusState>('idle');
  const [syncResult, setSyncResult] = React.useState<IamUserImportSyncReport | null>(null);
  const [syncError, setSyncError] = React.useState<Parameters<typeof userErrorMessage>[0]>(null);
  const [bulkReprovisionFeedback, setBulkReprovisionFeedback] = React.useState<BulkReprovisionFeedbackState>(null);

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
    const result = await executeStatusAction(usersApi, action);
    if (action?.action === 'reprovision-mainserver' && action.mode === 'bulk') {
      setBulkReprovisionFeedback(result ?? null);
    } else {
      setBulkReprovisionFeedback(null);
    }
  }, [statusActionDialog, usersApi]);

  const openSingleStatusAction = React.useCallback((action: 'activate' | 'deactivate', userId: string) => {
    setStatusActionDialog({
      action,
      mode: 'single',
      userId,
    });
  }, []);

  const openBulkDeactivate = React.useCallback((userIds: string[]) => {
    setBulkReprovisionFeedback(null);
    setStatusActionDialog({
      action: 'deactivate',
      mode: 'bulk',
      userIds,
    });
  }, []);

  const openBulkReprovisionMainserver = React.useCallback((userIds: string[]) => {
    setBulkReprovisionFeedback(null);
    setStatusActionDialog({
      action: 'reprovision-mainserver',
      mode: 'bulk',
      userIds,
    });
  }, []);

  return {
    closeStatusActionDialog: () => setStatusActionDialog(null),
    bulkReprovisionFeedback,
    onConfirmStatusAction,
    onSyncUsers,
    openBulkDeactivate,
    openBulkReprovisionMainserver,
    openSingleStatusAction,
    statusActionDialog,
    syncError,
    syncResult,
    syncStatus,
  };
};
