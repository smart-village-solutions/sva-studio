import type { WasteFractionRecord } from '@sva/plugin-sdk';
import { useMemo, useState } from 'react';
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
  WasteMasterDataFractionsTableSection,
} from './waste-management.master-data-fractions-content.view.js';

export const WasteMasterDataFractionsContent = ({
  fractions,
  fractionsSortBy,
  fractionsSortDirection,
  onOpenCreateFraction,
  onOpenEditFraction,
  onOpenDeleteFraction,
  onDeleteFractions,
  onToggleFractionStatus,
  onFractionsSortChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  saving,
}: WasteFractionsContentProps) => {
  const [fractionPendingDelete, setFractionPendingDelete] = useState<WasteFractionRecord | null>(null);
  const pagedFractions = useMemo(
    () =>
      createPagedItems({
        items: fractions,
        page,
        pageSize,
      }),
    [fractions, page, pageSize]
  );
  const sorting = useMemo(() => createFractionSorting(fractionsSortBy, fractionsSortDirection), [fractionsSortBy, fractionsSortDirection]);
  const tableLabels = useFractionTableLabels();
  const bulkActions = useFractionBulkActions({ saving, onDeleteFractions });
  const columns = useFractionColumns({ saving, onToggleFractionStatus });

  usePagedRouteSync({ page, safePage: pagedFractions.safePage, onPageChange });
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
        onFractionsSortChange={onFractionsSortChange}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
      <WasteMasterDataFractionDeleteDialog
        fractionPendingDelete={fractionPendingDelete}
        onOpenDeleteFraction={onOpenDeleteFraction}
        onCancel={() => setFractionPendingDelete(null)}
      />
    </div>
  );
};
