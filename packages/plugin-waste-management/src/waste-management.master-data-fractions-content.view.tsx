import type { WasteFractionRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioConfirmDialog, StudioDataTable } from '@sva/studio-ui-react';

import { WastePanelTableBottomBar } from './waste-management.table-frame.js';
import {
  FractionPrimaryAction,
  FractionRowActions,
  sortFieldByColumnId,
  type useFractionBulkActions,
  type useFractionTableLabels,
  WasteFractionsFilterAction,
  type WasteFractionsContentProps,
} from './waste-management.master-data-fractions-content.parts.js';
import type { useFractionColumns } from './waste-management.master-data-fractions-content.columns.js';
import type { WasteManagementFractionSortDirection, WasteManagementFractionSortField } from './search-params.js';

type WasteMasterDataFractionsTableSectionProps = {
  readonly fractions: readonly WasteFractionRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly totalItems: number;
  readonly sorting: {
    readonly id: string;
    readonly desc: boolean;
  }[];
  readonly labels: ReturnType<typeof useFractionTableLabels>;
  readonly bulkActions: ReturnType<typeof useFractionBulkActions>;
  readonly columns: ReturnType<typeof useFractionColumns>;
  readonly onOpenCreateFraction: () => void;
  readonly onOpenEditFraction: (fraction: WasteFractionRecord) => void;
  readonly onRequestDeleteFraction: (fraction: WasteFractionRecord) => void;
  readonly onFractionsSortChange: (
    sortBy: WasteManagementFractionSortField,
    sortDirection: WasteManagementFractionSortDirection
  ) => void;
  readonly fractionsStatus: WasteFractionsContentProps['fractionsStatus'];
  readonly filterDialogOpen: boolean;
  readonly draftFractionsStatus: WasteFractionsContentProps['fractionsStatus'];
  readonly onOpenFilterDialog: () => void;
  readonly onFilterDialogOpenChange: (open: boolean) => void;
  readonly onDraftFractionsStatusChange: (status: WasteFractionsContentProps['fractionsStatus']) => void;
  readonly onApplyFractionsStatus: () => void;
  readonly onResetFractionsStatus: () => void;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
};

const renderFractionRowActions = (
  fraction: WasteFractionRecord,
  onOpenEditFraction: (fraction: WasteFractionRecord) => void,
  onRequestDeleteFraction: (fraction: WasteFractionRecord) => void,
) => (
  <FractionRowActions
    fraction={fraction}
    onOpenEditFraction={onOpenEditFraction}
    onRequestDeleteFraction={onRequestDeleteFraction}
  />
);

const resolveNextFractionSorting = (
  nextSorting: readonly {
    readonly id: string;
    readonly desc: boolean;
  }[],
): readonly [WasteManagementFractionSortField, WasteManagementFractionSortDirection] => {
  const current = nextSorting[0];
  if (!current) {
    return ['name', 'asc'];
  }

  return [sortFieldByColumnId[current.id] ?? 'name', current.desc ? 'desc' : 'asc'];
};

export const WasteMasterDataFractionsTableSection = ({
  fractions,
  page,
  pageSize,
  pageCount,
  totalItems,
  sorting,
  labels,
  bulkActions,
  columns,
  onOpenCreateFraction,
  onOpenEditFraction,
  onRequestDeleteFraction,
  onFractionsSortChange,
  fractionsStatus,
  filterDialogOpen,
  draftFractionsStatus,
  onOpenFilterDialog,
  onFilterDialogOpenChange,
  onDraftFractionsStatusChange,
  onApplyFractionsStatus,
  onResetFractionsStatus,
  onPageChange,
  onPageSizeChange,
}: WasteMasterDataFractionsTableSectionProps) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="[&>div]:rounded-none [&>div]:border-x-0">
      <StudioDataTable
        ariaLabel={pt('masterData.fractions.table.ariaLabel')}
        caption={pt('masterData.fractions.table.caption')}
        labels={labels}
        data={fractions}
        columns={columns}
        getRowId={(fraction) => fraction.id}
        bulkActions={bulkActions}
        toolbarStart={
          <WasteFractionsFilterAction
            fractionsStatus={fractionsStatus}
            filterDialogOpen={filterDialogOpen}
            draftFractionsStatus={draftFractionsStatus}
            onOpenFilterDialog={onOpenFilterDialog}
            onFilterDialogOpenChange={onFilterDialogOpenChange}
            onDraftFractionsStatusChange={onDraftFractionsStatusChange}
            onApplyFractionsStatus={onApplyFractionsStatus}
            onResetFractionsStatus={onResetFractionsStatus}
          />
        }
        toolbarEnd={<FractionPrimaryAction onOpenCreateFraction={onOpenCreateFraction} />}
        selectionMode="multiple"
        emptyState={<p className="text-sm text-muted-foreground">{pt('masterData.messages.emptyBody')}</p>}
        sorting={sorting}
        onSortingChange={(nextSorting) => {
          const [sortBy, sortDirection] = resolveNextFractionSorting(nextSorting);
          onFractionsSortChange(sortBy, sortDirection);
        }}
        rowActions={(fraction) => renderFractionRowActions(fraction, onOpenEditFraction, onRequestDeleteFraction)}
      />
      <WastePanelTableBottomBar
        pt={pt}
        page={page}
        pageSize={pageSize}
        pageCount={pageCount}
        totalItems={totalItems}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
};

type WasteMasterDataFractionDeleteDialogProps = Pick<
  WasteFractionsContentProps,
  'onOpenDeleteFraction'
> & {
  readonly fractionPendingDelete: WasteFractionRecord | null;
  readonly onCancel: () => void;
};

export const WasteMasterDataFractionDeleteDialog = ({
  fractionPendingDelete,
  onOpenDeleteFraction,
  onCancel,
}: WasteMasterDataFractionDeleteDialogProps) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <StudioConfirmDialog
      open={fractionPendingDelete !== null}
      title={pt('masterData.fractions.deleteDialog.title')}
      description={pt('masterData.fractions.deleteDialog.description', {
        value: fractionPendingDelete?.name ?? '',
      })}
      confirmLabel={pt('masterData.fractions.deleteDialog.confirm')}
      cancelLabel={pt('masterData.fractions.deleteDialog.cancel')}
      onCancel={onCancel}
      onConfirm={() => {
        if (!fractionPendingDelete) {
          return;
        }
        void Promise.resolve(onOpenDeleteFraction(fractionPendingDelete)).finally(onCancel);
      }}
    />
  );
};
