import type { MainserverPrincipalControlModel, StudioBulkAction } from '@sva/studio-ui-react';
import type { ContentBulkMutationResult, useContents } from '../../hooks/use-contents';
import { t } from '../../i18n';
import {
  isContentMutationAvailable,
  updateMainserverContentStatus,
} from '../../lib/content-status-mutation';
import type { ContentListRouteState } from './-content-list-route-state';
import {
  buildBulkActionLabel,
  isBulkActionableContent,
  resolveListMutationPrincipal,
  type RegisteredContentRow,
} from './-content-list-row-actions';

type VoucherStatus = 'draft' | 'published';

export type PendingBulkAction = Readonly<{
  clearSelection: () => void;
  selectedRows: readonly RegisteredContentRow[];
  targetStatus?: VoucherStatus;
}>;

export const voucherBulkStatusLabel = (status: VoucherStatus): string =>
  t(status === 'published' ? 'content.actions.publishSelection' : 'content.actions.hideSelection');

export const voucherStatusEligibility = (
  principalControl: MainserverPrincipalControlModel | undefined,
  permissionActions: readonly string[],
  enabledMainserverMutationActions: readonly string[]
) => {
  const available = isContentMutationAvailable(
    'vouchers.voucher',
    'status',
    permissionActions,
    enabledMainserverMutationActions
  );
  return (item: RegisteredContentRow): boolean =>
    available &&
    item.contentType === 'vouchers.voucher' &&
    item.access?.state !== 'server_denied' &&
    item.access?.canUpdate === true &&
    resolveListMutationPrincipal(item, principalControl) !== undefined;
};

const runVoucherBatch = async (
  selectedRows: readonly RegisteredContentRow[],
  refresh: () => Promise<boolean>,
  mutate: (item: RegisteredContentRow) => Promise<void>
): Promise<ContentBulkMutationResult> => {
  const failedContentIds: string[] = [];
  for (const item of selectedRows) {
    try {
      await mutate(item);
    } catch {
      failedContentIds.push(item.id);
    }
  }
  const acceptedCount = selectedRows.length - failedContentIds.length;
  return {
    acceptedCount,
    failedCount: failedContentIds.length,
    failedContentIds,
    refreshFailed: acceptedCount > 0 && !(await refresh()),
    skippedCount: 0,
  };
};

export const updateVoucherSelection = (
  selectedRows: readonly RegisteredContentRow[],
  status: VoucherStatus,
  {
    registeredContents,
    principalControl,
    permissionActions,
    enabledMainserverMutationActions,
    refresh,
  }: {
    registeredContents: readonly RegisteredContentRow[];
    principalControl: MainserverPrincipalControlModel | undefined;
    permissionActions: readonly string[];
    enabledMainserverMutationActions: readonly string[];
    refresh: () => Promise<boolean>;
  }
): Promise<ContentBulkMutationResult> =>
  runVoucherBatch(selectedRows, refresh, async (item) => {
    const currentItem = registeredContents.find(
      (row) => row.id === item.id && row.contentType === 'vouchers.voucher'
    );
    const principal = currentItem && resolveListMutationPrincipal(currentItem, principalControl);
    if (!currentItem || !principal) throw new Error('content_mutation_unavailable');
    if (currentItem.status !== status) {
      await updateMainserverContentStatus(
        currentItem,
        status,
        principal,
        permissionActions,
        enabledMainserverMutationActions
      );
    }
  });

export const deleteSelectedContents = (
  selectedRows: readonly RegisteredContentRow[],
  contentsApi: ReturnType<typeof useContents>,
  routeState: ContentListRouteState,
  deleteMainserverRow: (item: RegisteredContentRow) => Promise<void>
): Promise<ContentBulkMutationResult> =>
  selectedRows.every((item) => item.contentType === 'vouchers.voucher')
    ? runVoucherBatch(selectedRows, contentsApi.refetchWithOutcome, deleteMainserverRow)
    : contentsApi.deleteContents({
        actionId: 'content.delete',
        contentIds: selectedRows.map((item) => item.id),
        matchingCount: selectedRows.length,
        page: routeState.page,
        pageSize: routeState.pageSize,
        selectionMode: 'explicitIds',
        sort: routeState.sort,
        statusFilter: routeState.status,
      });

export const buildBulkActionButtons = ({
  contentsApi,
  routeState,
  registeredContents,
  canDeleteVoucher,
  canChangeVoucherStatus,
  voucherSelection,
  unscopedPermissionActions,
  requestBulkAction,
}: {
  contentsApi: ReturnType<typeof useContents>;
  routeState: ContentListRouteState;
  registeredContents: readonly RegisteredContentRow[];
  canDeleteVoucher: (item: RegisteredContentRow) => boolean;
  canChangeVoucherStatus: (item: RegisteredContentRow) => boolean;
  voucherSelection: boolean;
  unscopedPermissionActions: readonly string[];
  requestBulkAction: (pending: PendingBulkAction) => void;
}): readonly StudioBulkAction<RegisteredContentRow>[] => {
  const actions: StudioBulkAction<RegisteredContentRow>[] = [];
  const hasLocalContents = !voucherSelection && registeredContents.some(isBulkActionableContent);
  if (hasLocalContents && unscopedPermissionActions.includes('content.archive')) {
    actions.push({
      id: 'archive-selection',
      label: buildBulkActionLabel('content.actions.archive'),
      onClick: async ({ selectedRows, clearSelection }) => {
        if (selectedRows.length === 0) return;
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
    });
  }
  if (
    voucherSelection
      ? registeredContents.some(canDeleteVoucher)
      : hasLocalContents && unscopedPermissionActions.includes('content.delete')
  ) {
    actions.push({
      id: 'delete-selection',
      label: buildBulkActionLabel('content.actions.delete'),
      variant: 'destructive',
      disabled: voucherSelection ? (rows) => !rows.every(canDeleteVoucher) : undefined,
      onClick: (pending) => requestBulkAction(pending),
    });
  }
  if (voucherSelection) {
    for (const targetStatus of ['published', 'draft'] as const) {
      const needsChange = (row: RegisteredContentRow) => row.status !== targetStatus;
      if (!registeredContents.some((row) => canChangeVoucherStatus(row) && needsChange(row)))
        continue;
      actions.push({
        id: `voucher-selection-${targetStatus}`,
        label: voucherBulkStatusLabel(targetStatus),
        disabled: (rows) => !rows.every(canChangeVoucherStatus) || !rows.some(needsChange),
        onClick: ({ selectedRows, clearSelection }) =>
          requestBulkAction({
            selectedRows: selectedRows.filter(needsChange),
            clearSelection,
            targetStatus,
          }),
      });
    }
  }
  return actions;
};
