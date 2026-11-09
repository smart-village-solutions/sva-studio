import {
  readStudioDestructiveNavigationFeedback,
  removeStudioActionNavigationFeedback,
  type MainserverPrincipalControlModel,
  type StudioBulkAction,
} from '@sva/studio-ui-react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import React from 'react';
import { useContents, type ContentBulkMutationResult } from '../../hooks/use-contents';
import { t } from '../../i18n';
import { type ContentListRouteState, type RouteSearchState } from './-content-list-route-state';
import {
  buildBulkActionLabel,
  canDeleteMainserverItem,
  deleteMainserverItem,
  resolveRowAccess,
  isBulkActionableContent,
  resolveListMutationPrincipal,
  type RegisteredContentRow,
} from './-content-list-row-actions';

type ContentDeletionResult = Readonly<{
  kind: 'success';
  description: string;
}>;
type PendingBulkDeletion = Readonly<{
  clearSelection: () => void;
  selectedRows: readonly RegisteredContentRow[];
}>;

const deleteSelectedContents = async (
  selectedRows: readonly RegisteredContentRow[],
  contentsApi: ReturnType<typeof useContents>,
  routeState: ContentListRouteState,
  deleteMainserverRow: (item: RegisteredContentRow) => Promise<void>
): Promise<ContentBulkMutationResult> => {
  if (!selectedRows.every((item) => item.contentType === 'vouchers.voucher')) {
    return contentsApi.deleteContents({
      actionId: 'content.delete',
      contentIds: selectedRows.map((item) => item.id),
      matchingCount: selectedRows.length,
      page: routeState.page,
      pageSize: routeState.pageSize,
      selectionMode: 'explicitIds',
      sort: routeState.sort,
      statusFilter: routeState.status,
    });
  }

  const failedContentIds: string[] = [];
  for (const item of selectedRows) {
    try {
      await deleteMainserverRow(item);
    } catch {
      failedContentIds.push(item.id);
    }
  }
  const acceptedCount = selectedRows.length - failedContentIds.length;
  return {
    acceptedCount,
    failedCount: failedContentIds.length,
    failedContentIds,
    refreshFailed: acceptedCount > 0 && !(await contentsApi.refetchWithOutcome()),
    skippedCount: 0,
  };
};

const withVoucherDeletionWarning = (description: string, contentType?: string): string =>
  contentType === 'vouchers.voucher'
    ? `${description} ${t('content.actions.deleteVoucherWarning')}`
    : description;

const useBulkActionButtons = ({
  contentsApi,
  routeState,
  hasBulkActionableContents,
  voucherSelection,
  unscopedPermissionActions,
  setBulkDeleteError,
  setPendingBulkDeletion,
}: Readonly<{
  contentsApi: ReturnType<typeof useContents>;
  routeState: ContentListRouteState;
  hasBulkActionableContents: boolean;
  voucherSelection: boolean;
  unscopedPermissionActions: readonly string[];
  setBulkDeleteError: React.Dispatch<React.SetStateAction<string | null>>;
  setPendingBulkDeletion: React.Dispatch<React.SetStateAction<PendingBulkDeletion | null>>;
}>): readonly StudioBulkAction<RegisteredContentRow>[] => {
  return React.useMemo<readonly StudioBulkAction<RegisteredContentRow>[]>(
    () =>
      hasBulkActionableContents
        ? [
            ...(!voucherSelection
              ? [
                  {
                    id: 'archive-selection',
                    label: buildBulkActionLabel('content.actions.archive'),
                    disabled: !unscopedPermissionActions.includes('content.archive'),
                    onClick: async ({
                      selectedRows,
                      clearSelection,
                    }: Parameters<StudioBulkAction<RegisteredContentRow>['onClick']>[0]) => {
                      if (selectedRows.length === 0) {
                        return;
                      }
                      await contentsApi.archiveContents({
                        actionId: 'content.archive',
                        contentIds: selectedRows.map((item) => item.id),
                        matchingCount: selectedRows.length,
                        page: routeState.page,
                        pageSize: routeState.pageSize,
                        selectionMode: 'explicitIds',
                        sort: routeState.sort,
                        statusFilter: routeState.status,
                      });
                      clearSelection();
                    },
                  },
                ]
              : []),
            {
              id: 'delete-selection',
              label: buildBulkActionLabel('content.actions.delete'),
              disabled: !voucherSelection && !unscopedPermissionActions.includes('content.delete'),
              variant: 'destructive',
              onClick: ({ selectedRows, clearSelection }) => {
                if (selectedRows.length === 0) return;
                setBulkDeleteError(null);
                setPendingBulkDeletion({ selectedRows, clearSelection });
              },
            },
          ]
        : [],
    [
      contentsApi,
      hasBulkActionableContents,
      routeState.page,
      routeState.pageSize,
      routeState.sort,
      routeState.status,
      unscopedPermissionActions,
      voucherSelection,
    ]
  );
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

export const useContentListDeletion = ({
  contentsApi,
  routeState,
  registeredContents,
  principalControl,
  unscopedPermissionActions,
  permissionActions,
  enabledMainserverMutationActions,
}: Readonly<{
  contentsApi: ReturnType<typeof useContents>;
  routeState: ContentListRouteState;
  registeredContents: readonly RegisteredContentRow[];
  principalControl: MainserverPrincipalControlModel | undefined;
  unscopedPermissionActions: readonly string[];
  permissionActions: readonly string[];
  enabledMainserverMutationActions: readonly string[];
}>) => {
  const [destructiveResult, setDestructiveResult] = useDestructiveFeedback();
  const [pendingRowDeletion, setPendingRowDeletion] = React.useState<RegisteredContentRow | null>(
    null
  );
  const [rowDeletePending, setRowDeletePending] = React.useState(false);
  const [rowDeleteError, setRowDeleteError] = React.useState<string | null>(null);
  const [pendingBulkDeletion, setPendingBulkDeletion] = React.useState<PendingBulkDeletion | null>(
    null
  );
  const [bulkDeletePending, setBulkDeletePending] = React.useState(false);
  const [bulkDeleteError, setBulkDeleteError] = React.useState<string | null>(null);
  const deleteFocusFallbackRef = React.useRef<HTMLElement | null>(null);
  const voucherSelection = routeState.type === 'vouchers.voucher';
  const canSelectContent = (item: RegisteredContentRow): boolean =>
    voucherSelection
      ? item.contentType === 'vouchers.voucher' &&
        resolveRowAccess(item.access, contentsApi.error).canRead &&
        item.access?.state !== 'server_denied' &&
        resolveListMutationPrincipal(item, principalControl) !== undefined &&
        canDeleteMainserverItem(
          item.contentType,
          permissionActions,
          enabledMainserverMutationActions
        )
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
      result = await deleteSelectedContents(
        pending.selectedRows,
        contentsApi,
        routeState,
        deleteMainserverRow
      );
    } catch {
      setBulkDeleteError(
        t('content.messages.deleteBulkError', { failedCount: pending.selectedRows.length })
      );
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
      setBulkDeleteError(
        t('content.messages.deleteBulkError', { failedCount: result.failedCount })
      );
      return;
    }

    pending.clearSelection();
    setPendingBulkDeletion(null);
    setDestructiveResult({
      kind: 'success',
      description: result.refreshFailed
        ? t('content.messages.deleteRefreshError')
        : t('content.messages.deleteBulkSuccess', { count: result.acceptedCount }),
    });
  };

  const bulkActionButtons = useBulkActionButtons({
    contentsApi,
    routeState,
    hasBulkActionableContents: registeredContents.some(canSelectContent),
    voucherSelection,
    unscopedPermissionActions,
    setBulkDeleteError,
    setPendingBulkDeletion,
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
    bulkDeleteDescription: withVoucherDeletionWarning(
      t('content.actions.deleteBulkConfirmDescription', {
        count: pendingBulkDeletion?.selectedRows.length ?? 0,
      }),
      pendingBulkDeletion?.selectedRows[0]?.contentType
    ),
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
