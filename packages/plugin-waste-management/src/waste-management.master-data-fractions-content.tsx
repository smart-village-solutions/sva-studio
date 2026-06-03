import type { WasteFractionRecord } from '@sva/plugin-sdk';
import { useEffect, useMemo, useState } from 'react';
import { createPagedItems, usePagedRouteSync } from './waste-management.table-frame.js';
import { useWasteTabPanelActions } from './waste-management.tab-panel-actions.js';
import {
  createFractionSorting,
  type WasteFractionsContentProps,
  useFractionBulkActions,
  useFractionTableLabels,
} from './waste-management.master-data-fractions-content.parts.js';
import { useFractionColumns } from './waste-management.master-data-fractions-content.columns.js';
import {
  WasteMasterDataFractionDeleteDialog,
  WasteMasterDataFractionStatusDialog,
  WasteMasterDataFractionsTableSection,
} from './waste-management.master-data-fractions-content.view.js';

export const WasteMasterDataFractionsContent = ({
  fractions,
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
  const [fractionPendingDelete, setFractionPendingDelete] = useState<WasteFractionRecord | null>(null);
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
  const sortedFractions = useMemo(() => {
    const getSortValue = (fraction: WasteFractionRecord, field: typeof sortField): string => {
      switch (field) {
        case 'name':
          return fraction.name;
        case 'containerSize':
          return fraction.containerSize ?? '';
        case 'color':
          return fraction.color;
        case 'description':
          return fraction.description ?? '';
        case 'status':
          return fraction.active ? 'active' : 'inactive';
        default:
          return '';
      }
    };

    return [...fractions].sort((left, right) => {
      const comparison = getSortValue(left, sortField).localeCompare(getSortValue(right, sortField), 'de', {
        numeric: true,
        sensitivity: 'base',
      });

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });
  }, [fractions, sortDirection, sortField]);
  const pagedFractions = useMemo(
    () =>
      createPagedItems({
        items: sortedFractions,
        page,
        pageSize,
      }),
    [page, pageSize, sortedFractions]
  );
  const sorting = useMemo(() => createFractionSorting(sortField, sortDirection), [sortDirection, sortField]);
  const tableLabels = useFractionTableLabels();
  const bulkActions = useFractionBulkActions({ saving, onDeleteFractions });
  const columns = useFractionColumns({
    saving,
    onToggleFractionStatus: (fraction, active) => {
      setFractionPendingStatusChange({ fraction, nextActive: active });
    },
  });

  usePagedRouteSync({ page, safePage: pagedFractions.safePage, onPageChange, onSyncPageChange });
  useWasteTabPanelActions(null);

  return (
    <div className="space-y-4">
      <WasteMasterDataFractionsTableSection
        fractions={pagedFractions.items}
        page={pagedFractions.safePage}
        pageSize={pageSize}
        pageCount={pagedFractions.pageCount}
        totalItems={pagedFractions.totalItems}
        sorting={sorting}
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
        onOpenDeleteFraction={onOpenDeleteFraction}
        onCancel={() => setFractionPendingDelete(null)}
      />
      <WasteMasterDataFractionStatusDialog
        fractionPendingStatusChange={fractionPendingStatusChange}
        onCancel={() => setFractionPendingStatusChange(null)}
        onConfirm={() => {
          if (!fractionPendingStatusChange) {
            return;
          }

          void Promise.resolve(
            onToggleFractionStatus(fractionPendingStatusChange.fraction, fractionPendingStatusChange.nextActive)
          ).finally(() => setFractionPendingStatusChange(null));
        }}
      />
    </div>
  );
};
