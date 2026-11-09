import {
  readStudioDestructiveNavigationFeedback,
  removeStudioActionNavigationFeedback,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import React from 'react';
import { useContents, type ContentBulkMutationResult } from '../../hooks/use-contents';
import { t } from '../../i18n';
import {
  deleteSelectedContents,
  updateVoucherSelection,
  buildBulkActionButtons,
  voucherBulkStatusLabel,
  voucherStatusEligibility,
  type PendingBulkAction,
} from './-content-list-bulk-actions';
import { type ContentListRouteState, type RouteSearchState } from './-content-list-route-state';
import {
  canDeleteMainserverItem,
  deleteMainserverItem,
  resolveRowAccess,
  isBulkActionableContent,
  resolveListMutationPrincipal,
  type RegisteredContentRow,
} from './-content-list-row-actions';

type ContentDeletionResult = Readonly<{
  kind: 'success';
  title?: string;
  description: string;
}>;
const withVoucherDeletionWarning = (description: string, contentType?: string): string =>
  contentType === 'vouchers.voucher'
    ? `${description} ${t('content.actions.deleteVoucherWarning')}`
    : description;

const bulkDialogCopy = (pending: PendingBulkAction | null) => {
  const status = pending?.targetStatus;
  const count = pending?.selectedRows.length ?? 0;
  return status
    ? {
        title: voucherBulkStatusLabel(status),
        description: t('content.actions.bulkStatusConfirm', {
          count,
          status: t(`content.status.${status}`),
        }),
        confirmLabel: voucherBulkStatusLabel(status),
        pendingLabel: t('content.messages.loading'),
      }
    : {
        title: t('content.actions.deleteBulkConfirmTitle'),
        description: withVoucherDeletionWarning(
          t('content.actions.deleteBulkConfirmDescription', { count }),
          pending?.selectedRows[0]?.contentType
        ),
        confirmLabel: t('content.actions.delete'),
        pendingLabel: t('content.actions.deletePending'),
      };
};

const bulkError = (pending: PendingBulkAction, failedCount: number): string =>
  t(pending.targetStatus ? 'content.actions.bulkStatusError' : 'content.messages.deleteBulkError', {
    failedCount,
  });

const bulkSuccess = (
  pending: PendingBulkAction,
  result: ContentBulkMutationResult
): ContentDeletionResult => {
  if (pending.targetStatus) {
    const description = t('content.actions.bulkStatusSuccess');
    return {
      kind: 'success',
      title: t('content.history.actions.statusChanged'),
      description: result.refreshFailed
        ? `${description} ${t('content.messages.loadError')}`
        : description,
    };
  }
  return {
    kind: 'success',
    description: result.refreshFailed
      ? t('content.messages.deleteRefreshError')
      : t('content.messages.deleteBulkSuccess', { count: result.acceptedCount }),
  };
};

const useDestructiveFeedback = () => {
  const navigate = useNavigate();
  const locationState = useLocation().state;
  const [destructiveResult, setDestructiveResult] = React.useState<ContentDeletionResult | null>(
    () => {
      const feedback = readStudioDestructiveNavigationFeedback(locationState);
      return feedback
        ? {
            kind: 'success',
            description: t('content.messages.deleteSuccess', { id: feedback.resourceId }),
          }
        : null;
    }
  );
  React.useEffect(() => {
    const feedback = readStudioDestructiveNavigationFeedback(locationState);
    if (!feedback) return;
    setDestructiveResult({
      kind: 'success',
      description: t('content.messages.deleteSuccess', { id: feedback.resourceId }),
    });
    void navigate({
      to: '/admin/content',
      replace: true,
      search: (current: RouteSearchState) => current,
      state: (previous) => removeStudioActionNavigationFeedback(previous),
    });
  }, [locationState, navigate]);
  return [destructiveResult, setDestructiveResult] as const;
};

type ContentListDeletionInput = Readonly<{
  contentsApi: ReturnType<typeof useContents>;
  routeState: ContentListRouteState;
  registeredContents: readonly RegisteredContentRow[];
  principalControl: MainserverPrincipalControlModel | undefined;
  unscopedPermissionActions: readonly string[];
  permissionActions: readonly string[];
  enabledMainserverMutationActions: readonly string[];
}>;

export const useContentListDeletion = ({
  contentsApi,
  routeState,
  registeredContents,
  principalControl,
  unscopedPermissionActions,
  permissionActions,
  enabledMainserverMutationActions,
}: ContentListDeletionInput) => {
  const [destructiveResult, setDestructiveResult] = useDestructiveFeedback();
  const [pendingRowDeletion, setPendingRowDeletion] = React.useState<RegisteredContentRow | null>(
    null
  );
  const [rowDeletePending, setRowDeletePending] = React.useState(false);
  const [rowDeleteError, setRowDeleteError] = React.useState<string | null>(null);
  const [pendingBulkDeletion, setPendingBulkDeletion] = React.useState<PendingBulkAction | null>(
    null
  );
  const [bulkDeletePending, setBulkDeletePending] = React.useState(false);
  const [bulkDeleteError, setBulkDeleteError] = React.useState<string | null>(null);
  const deleteFocusFallbackRef = React.useRef<HTMLElement | null>(null);
  const voucherSelection = routeState.type === 'vouchers.voucher';
  const canDeleteVoucher = (item: RegisteredContentRow): boolean =>
    item.contentType === 'vouchers.voucher' &&
    resolveRowAccess(item.access, contentsApi.error).canRead &&
    item.access?.state !== 'server_denied' &&
    resolveListMutationPrincipal(item, principalControl) !== undefined &&
    canDeleteMainserverItem(item.contentType, permissionActions, enabledMainserverMutationActions);
  const canChangeVoucherStatus = voucherStatusEligibility(
    principalControl,
    permissionActions,
    enabledMainserverMutationActions
  );
  const canSelectContent = (item: RegisteredContentRow): boolean =>
    voucherSelection
      ? canDeleteVoucher(item) || canChangeVoucherStatus(item)
      : isBulkActionableContent(item);

  const deleteMainserverRow = async (item: RegisteredContentRow): Promise<void> => {
    const currentItem = registeredContents.find(
      (row) => row.id === item.id && row.contentType === item.contentType
    );
    if (
      !currentItem ||
      !resolveRowAccess(currentItem.access, contentsApi.error).canRead ||
      currentItem.access?.state === 'server_denied'
    ) {
      throw new Error('content_mutation_unavailable');
    }
    const principal = resolveListMutationPrincipal(currentItem, principalControl);
    if (!principal) {
      throw new Error('mainserver_mutation_principal_unavailable');
    }
    await deleteMainserverItem(
      item.contentType,
      item.id,
      principal,
      permissionActions,
      enabledMainserverMutationActions
    );
  };

  const confirmRowDeletion = async () => {
    const item = pendingRowDeletion;
    if (!item || rowDeletePending) return;
    setRowDeletePending(true);
    setRowDeleteError(null);
    try {
      await deleteMainserverRow(item);
    } catch {
      setRowDeleteError(t('content.messages.deleteError'));
      setRowDeletePending(false);
      return;
    }

    setPendingRowDeletion(null);
    setDestructiveResult({
      kind: 'success',
      description: t('content.messages.deleteSuccess', { id: item.id }),
    });
    const refreshSucceeded = await contentsApi.refetchWithOutcome();
    if (!refreshSucceeded) {
      setDestructiveResult({
        kind: 'success',
        description: t('content.messages.deleteRefreshError'),
      });
    }
    setRowDeletePending(false);
  };

  const confirmBulkDeletion = async () => {
    const pending = pendingBulkDeletion;
    if (!pending || bulkDeletePending) return;
    setBulkDeletePending(true);
    setBulkDeleteError(null);
    let result: Awaited<ReturnType<typeof contentsApi.deleteContents>>;
    try {
      const status = pending.targetStatus;
      result = status
        ? await updateVoucherSelection(pending.selectedRows, status, {
            registeredContents,
            principalControl,
            permissionActions,
            enabledMainserverMutationActions,
            refresh: contentsApi.refetchWithOutcome,
          })
        : await deleteSelectedContents(
            pending.selectedRows,
            contentsApi,
            routeState,
            deleteMainserverRow
          );
    } catch {
      setBulkDeleteError(bulkError(pending, pending.selectedRows.length));
      setBulkDeletePending(false);
      return;
    }
    setBulkDeletePending(false);

    if (result.failedCount > 0) {
      const failedIds = new Set(result.failedContentIds);
      setPendingBulkDeletion({
        ...pending,
        selectedRows: pending.selectedRows.filter((item) => failedIds.has(item.id)),
      });
      setBulkDeleteError(bulkError(pending, result.failedCount));
      return;
    }

    pending.clearSelection();
    setPendingBulkDeletion(null);
    setDestructiveResult(bulkSuccess(pending, result));
  };

  const bulkActionButtons = buildBulkActionButtons({
    contentsApi,
    routeState,
    registeredContents,
    canDeleteVoucher,
    canChangeVoucherStatus,
    voucherSelection,
    unscopedPermissionActions,
    requestBulkAction: (pending) => {
      if (pending.selectedRows.length === 0) return;
      setBulkDeleteError(null);
      setPendingBulkDeletion(pending);
    },
  });

  return {
    destructiveResult,
    setDestructiveResult,
    pendingRowDeletion,
    rowDeleteDescription: withVoucherDeletionWarning(
      t('content.actions.deleteConfirmDescription', { title: pendingRowDeletion?.title ?? '' }),
      pendingRowDeletion?.contentType
    ),
    setPendingRowDeletion,
    rowDeletePending,
    rowDeleteError,
    setRowDeleteError,
    pendingBulkDeletion,
    bulkDialog: bulkDialogCopy(pendingBulkDeletion),
    setPendingBulkDeletion,
    bulkDeletePending,
    bulkDeleteError,
    setBulkDeleteError,
    deleteFocusFallbackRef,
    confirmRowDeletion,
    confirmBulkDeletion,
    bulkActionButtons,
    canSelectContent,
  };
};
