import type { WasteFractionRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPagedItems, usePagedRouteSync } from './waste-management.table-frame.js';
import { useWasteTabPanelActions } from './waste-management.tab-panel-actions.js';
import {
  createFractionSorting,
  type FractionBulkDeleteRequest,
  type WasteFractionsContentProps,
  useFractionBulkActions,
  useFractionTableLabels,
  useFractionSortingLabels,
} from './waste-management.master-data-fractions-content.parts.js';
import { useFractionColumns } from './waste-management.master-data-fractions-content.columns.js';
import {
  WasteMasterDataFractionStatusDialog,
  WasteMasterDataFractionsTableSection,
} from './waste-management.master-data-fractions-content.view.js';
import {
  WasteMasterDataFractionDeleteDialog,
  WasteMasterDataFractionsBulkDeleteDialog,
} from './waste-management.master-data-fraction-delete-dialogs.js';

const getFractionSortValue = (
  fraction: WasteFractionRecord,
  field: Parameters<typeof createFractionSorting>[0]
): string | null => {
  switch (field) {
    case 'name':
      return fraction.name;
    case 'containerSize':
      return fraction.containerSize ?? null;
    case 'color':
      return fraction.color;
    case 'description':
      return fraction.description ?? null;
    case 'status':
      return fraction.active ? 'active' : 'inactive';
  }
};

const sortFractions = (
  fractions: readonly WasteFractionRecord[],
  sortField: Parameters<typeof createFractionSorting>[0],
  sortDirection: Parameters<typeof createFractionSorting>[1]
) =>
  [...fractions].sort((left, right) => {
    const leftValue = getFractionSortValue(left, sortField);
    const rightValue = getFractionSortValue(right, sortField);
    if (leftValue === null && rightValue !== null) return 1;
    if (leftValue !== null && rightValue === null) return -1;

    const comparison = (leftValue ?? '').localeCompare(rightValue ?? '', 'de', {
      numeric: true,
      sensitivity: 'base',
    });
    if (comparison !== 0) {
      return sortDirection === 'asc' ? comparison : comparison * -1;
    }
    return left.id.localeCompare(right.id);
  });

export const WasteMasterDataFractionsContent = ({
  fractions,
  search,
  fractionsSortBy,
  fractionsSortDirection,
  fractionsStatus,
  onOpenCreateFraction,
  onOpenEditFraction,
  onOpenDeleteFraction,
  onDeleteFractions,
  onToggleFractionStatus,
  onFractionsSortChange,
  onFractionsStatusChange,
  page,
  pageSize,
  onPageChange,
  onSyncPageChange,
  onPageSizeChange,
  saving,
}: WasteFractionsContentProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const feedbackFocusFallbackRef = useRef<HTMLDivElement | null>(null);
  const [fractionPendingDelete, setFractionPendingDelete] = useState<WasteFractionRecord | null>(
    null
  );
  const [bulkDeleteRequest, setBulkDeleteRequest] = useState<FractionBulkDeleteRequest | null>(
    null
  );
  const [fractionPendingStatusChange, setFractionPendingStatusChange] = useState<{
    readonly fraction: WasteFractionRecord;
    readonly nextActive: boolean;
  } | null>(null);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [draftFractionsStatus, setDraftFractionsStatus] = useState(fractionsStatus);
  const [sortField, setSortField] = useState(fractionsSortBy);
  const [sortDirection, setSortDirection] = useState(fractionsSortDirection);
  useEffect(() => {
    setSortField(fractionsSortBy);
    setSortDirection(fractionsSortDirection);
  }, [fractionsSortBy, fractionsSortDirection]);
  useEffect(() => {
    if (!filterDialogOpen) {
      setDraftFractionsStatus(fractionsStatus);
    }
  }, [filterDialogOpen, fractionsStatus]);
  const sortedFractions = useMemo(
    () => sortFractions(fractions, sortField, sortDirection),
    [fractions, sortDirection, sortField]
  );
  const pagedFractions = useMemo(
    () =>
      createPagedItems({
        items: sortedFractions,
        page,
        pageSize,
      }),
    [page, pageSize, sortedFractions]
  );
  const sorting = useMemo(
    () => createFractionSorting(sortField, sortDirection),
    [sortDirection, sortField]
  );
  const tableLabels = useFractionTableLabels();
  const sortingLabels = useFractionSortingLabels();
  const bulkActions = useFractionBulkActions({
    saving,
    onRequestDeleteFractions: setBulkDeleteRequest,
  });
  const columns = useFractionColumns({
    saving,
    onToggleFractionStatus: (fraction, active) => {
      setFractionPendingStatusChange({ fraction, nextActive: active });
    },
  });

  usePagedRouteSync({ page, safePage: pagedFractions.safePage, onPageChange, onSyncPageChange });
  useWasteTabPanelActions(null);

  return (
    <div
      ref={feedbackFocusFallbackRef}
      role="region"
      tabIndex={-1}
      aria-label={pt('masterData.fractions.table.ariaLabel')}
      className="space-y-4"
    >
      <WasteMasterDataFractionsTableSection
        search={search}
        fractions={pagedFractions.items}
        page={pagedFractions.safePage}
        pageSize={pageSize}
        pageCount={pagedFractions.pageCount}
        totalItems={pagedFractions.totalItems}
        sorting={sorting}
        sortingLabels={sortingLabels}
        labels={tableLabels}
        bulkActions={bulkActions}
        columns={columns}
        onOpenCreateFraction={onOpenCreateFraction}
        onOpenEditFraction={onOpenEditFraction}
        onRequestDeleteFraction={setFractionPendingDelete}
        onFractionsSortChange={(nextSortBy, nextSortDirection) => {
          setSortField(nextSortBy);
          setSortDirection(nextSortDirection);
          onFractionsSortChange(nextSortBy, nextSortDirection);
        }}
        fractionsStatus={fractionsStatus}
        filterDialogOpen={filterDialogOpen}
        draftFractionsStatus={draftFractionsStatus}
        onOpenFilterDialog={() => {
          setDraftFractionsStatus(fractionsStatus);
          setFilterDialogOpen(true);
        }}
        onFilterDialogOpenChange={setFilterDialogOpen}
        onDraftFractionsStatusChange={setDraftFractionsStatus}
        onApplyFractionsStatus={() => {
          onFractionsStatusChange(draftFractionsStatus);
          setFilterDialogOpen(false);
        }}
        onResetFractionsStatus={() => {
          onFractionsStatusChange('all');
        }}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
      <WasteMasterDataFractionDeleteDialog
        fractionPendingDelete={fractionPendingDelete}
        fallbackFocusRef={feedbackFocusFallbackRef}
        onOpenDeleteFraction={onOpenDeleteFraction}
        onCancel={() => setFractionPendingDelete(null)}
      />
      <WasteMasterDataFractionsBulkDeleteDialog
        request={bulkDeleteRequest}
        fallbackFocusRef={feedbackFocusFallbackRef}
        onDeleteFractions={onDeleteFractions}
        onPartialFailure={(failedIds) => {
          setBulkDeleteRequest((request) =>
            request ? { ...request, fractionIds: failedIds } : null
          );
        }}
        onCancel={() => setBulkDeleteRequest(null)}
      />
      <WasteMasterDataFractionStatusDialog
        fractionPendingStatusChange={fractionPendingStatusChange}
        onCancel={() => setFractionPendingStatusChange(null)}
        onConfirm={() => {
          if (!fractionPendingStatusChange) {
            return;
          }

          void Promise.resolve(
            onToggleFractionStatus(
              fractionPendingStatusChange.fraction,
              fractionPendingStatusChange.nextActive
            )
          ).finally(() => setFractionPendingStatusChange(null));
        }}
      />
    </div>
  );
};
