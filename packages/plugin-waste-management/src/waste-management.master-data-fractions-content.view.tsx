import type { WasteFractionRecord } from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioConfirmDialog, StudioDataTable } from '@sva/studio-ui-react';

import { WastePanelTableBottomBar, WastePanelTableTopBar } from './waste-management.table-frame.js';
import {
  FractionRowActions,
  sortFieldByColumnId,
  type useFractionBulkActions,
  type useFractionTableLabels,
  type useFractionSortingLabels,
  WasteFractionsFilterAction,
  WasteFractionFilterSummary,
  type WasteFractionsContentProps,
} from './waste-management.master-data-fractions-content.parts.js';
import type { useFractionColumns } from './waste-management.master-data-fractions-content.columns.js';
import type {
  WasteManagementFractionSortDirection,
  WasteManagementFractionSortField,
  WasteManagementSearchParams,
} from './search-params.js';

type WasteMasterDataFractionsTableSectionProps = {
  readonly search?: WasteManagementSearchParams;
  readonly fractions: readonly WasteFractionRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly totalItems: number;
  readonly sorting: { id: string; desc: boolean }[];
  readonly sortingLabels: ReturnType<typeof useFractionSortingLabels>;
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
  readonly onQueryChange: WasteFractionsContentProps['onQueryChange'];
  readonly onFractionsStatusChange: WasteFractionsContentProps['onFractionsStatusChange'];
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
};

const renderFractionRowActions = (
  fraction: WasteFractionRecord,
  search: WasteManagementSearchParams | undefined,
  onOpenEditFraction: (fraction: WasteFractionRecord) => void,
  onRequestDeleteFraction: (fraction: WasteFractionRecord) => void
) => (
  <FractionRowActions
    fraction={fraction}
    search={search}
    onOpenEditFraction={onOpenEditFraction}
    onRequestDeleteFraction={onRequestDeleteFraction}
  />
);

const resolveNextFractionSorting = (
  nextSorting: readonly {
    readonly id: string;
    readonly desc: boolean;
  }[]
): readonly [WasteManagementFractionSortField, WasteManagementFractionSortDirection] => {
  const current = nextSorting[0];
  if (!current) {
    return ['name', 'asc'];
  }

  return [sortFieldByColumnId[current.id] ?? 'name', current.desc ? 'desc' : 'asc'];
};

export const WasteMasterDataFractionsTableSection = ({
  fractions,
  search,
  sorting,
  sortingLabels,
  labels,
  bulkActions,
  columns,
  onOpenCreateFraction,
  onOpenEditFraction,
  onRequestDeleteFraction,
  onFractionsSortChange,
  fractionsStatus,
  onQueryChange,
  onFractionsStatusChange,
  ...pagination
}: WasteMasterDataFractionsTableSectionProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const query = search?.q ?? '';
  return (
    <div className="[&>div]:rounded-none [&>div]:border-x-0">
      <WastePanelTableTopBar
        activeFilters={
          <WasteFractionFilterSummary
            {...{ query, fractionsStatus, onQueryChange, onFractionsStatusChange }}
          />
        }
        actions={
          <Button type="button" onClick={onOpenCreateFraction}>
            {pt('masterData.fractions.actions.openCreate')}
          </Button>
        }
      >
        <WasteFractionsFilterAction
          fractionsStatus={fractionsStatus}
          query={query}
          onQueryChange={onQueryChange}
          onFractionsStatusChange={onFractionsStatusChange}
        />
      </WastePanelTableTopBar>
      <StudioDataTable
        ariaLabel={pt('masterData.fractions.table.ariaLabel')}
        caption={pt('masterData.fractions.table.caption')}
        labels={labels}
        data={fractions}
        columns={columns}
        getRowId={(fraction) => fraction.id}
        bulkActions={bulkActions}
        selectionMode="multiple"
        emptyState={
          <p className="text-sm text-muted-foreground">{pt('masterData.messages.emptyBody')}</p>
        }
        sorting={{
          mode: 'external',
          labels: sortingLabels,
          state: sorting,
          onChange: (nextSorting) => {
            const [sortBy, sortDirection] = resolveNextFractionSorting(nextSorting);
            onFractionsSortChange(sortBy, sortDirection);
          },
        }}
        rowActions={(fraction) =>
          renderFractionRowActions(fraction, search, onOpenEditFraction, onRequestDeleteFraction)
        }
      />
      <WastePanelTableBottomBar pt={pt} {...pagination} />
    </div>
  );
};

type WasteMasterDataFractionStatusDialogProps = {
  readonly fractionPendingStatusChange: {
    readonly fraction: WasteFractionRecord;
    readonly nextActive: boolean;
  } | null;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
};

export const WasteMasterDataFractionStatusDialog = ({
  fractionPendingStatusChange,
  onCancel,
  onConfirm,
}: WasteMasterDataFractionStatusDialogProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const nextActive = fractionPendingStatusChange?.nextActive ?? false;
  const translationPrefix = nextActive ? 'activate' : 'deactivate';

  return (
    <StudioConfirmDialog
      open={fractionPendingStatusChange !== null}
      title={pt(`masterData.fractions.statusDialog.${translationPrefix}Title`)}
      description={pt(`masterData.fractions.statusDialog.${translationPrefix}Description`, {
        value: fractionPendingStatusChange?.fraction.name ?? '',
      })}
      confirmLabel={pt('masterData.fractions.statusDialog.confirm')}
      cancelLabel={pt('masterData.fractions.statusDialog.cancel')}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
};
