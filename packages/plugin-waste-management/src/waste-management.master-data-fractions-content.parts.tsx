import type { WasteFractionRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import {
  Button,
  type StudioBulkAction,
  type StudioDataTableLabels,
  type StudioDataTableProps,
} from '@sva/studio-ui-react';
import { useFractionColumns } from './waste-management.master-data-fractions-content.columns.js';

import type { WasteManagementFractionSortDirection, WasteManagementFractionSortField } from './search-params.js';

type StudioTableSortingState = NonNullable<StudioDataTableProps<WasteFractionRecord>['sorting']>;

export type WasteFractionsContentProps = {
  readonly fractions: readonly WasteFractionRecord[];
  readonly fractionsSortBy: WasteManagementFractionSortField;
  readonly fractionsSortDirection: WasteManagementFractionSortDirection;
  readonly onOpenCreateFraction: () => void;
  readonly onOpenEditFraction: (fraction: WasteFractionRecord) => void;
  readonly onOpenDeleteFraction: (fraction: WasteFractionRecord) => void | Promise<void>;
  readonly onDeleteFractions: (fractionIds: readonly string[]) => void | Promise<void>;
  readonly onToggleFractionStatus: (fraction: WasteFractionRecord, active: boolean) => void | Promise<void>;
  readonly onFractionsSortChange: (
    sortBy: WasteManagementFractionSortField,
    sortDirection: WasteManagementFractionSortDirection
  ) => void;
  readonly page: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly onSyncPageChange?: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
  readonly saving?: boolean;
};

export const columnIdBySortField: Record<WasteManagementFractionSortField, string> = {
  name: 'nameWithContainerSize',
  containerSize: 'nameWithContainerSize',
  color: 'color',
  description: 'description',
  status: 'status',
};

export const sortFieldByColumnId: Record<string, WasteManagementFractionSortField> = {
  nameWithContainerSize: 'name',
  color: 'color',
  description: 'description',
  status: 'status',
};

export const createFractionSorting = (
  fractionsSortBy: WasteManagementFractionSortField,
  fractionsSortDirection: WasteManagementFractionSortDirection
): StudioTableSortingState => [{ id: columnIdBySortField[fractionsSortBy], desc: fractionsSortDirection === 'desc' }];

export const useFractionTableLabels = () => {
  const pt = usePluginTranslation('wasteManagement');
  const labels: StudioDataTableLabels = {
    selectionColumn: pt('masterData.fractions.table.selection'),
    actionsColumn: pt('masterData.fractions.table.actions'),
    loading: pt('masterData.messages.loading'),
    selectAllRows: (label) => pt('masterData.fractions.table.selectAllRows', { label }),
    selectRow: ({ rowId }) => pt('masterData.fractions.table.selectRow', { rowId }),
    selectMobileRow: ({ rowId }) => pt('masterData.fractions.table.selectMobileRow', { rowId }),
  };
  return labels;
};

export const useFractionBulkActions = ({
  saving,
  onDeleteFractions,
}: {
  readonly saving?: boolean;
  readonly onDeleteFractions: (fractionIds: readonly string[]) => void | Promise<void>;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const actions: readonly StudioBulkAction<WasteFractionRecord>[] = [
    {
      id: 'delete-selected-fractions',
      label: pt('masterData.fractions.actions.deleteSelected'),
      variant: 'outline',
      disabled: saving,
      onClick: async ({ selectedRows, clearSelection }) => {
        await onDeleteFractions(selectedRows.map((row) => row.id));
        clearSelection();
      },
    },
  ];
  return actions;
};

export const FractionPrimaryAction = ({ onOpenCreateFraction }: { readonly onOpenCreateFraction: () => void }) => {
  const pt = usePluginTranslation('wasteManagement');
  return <Button type="button" onClick={onOpenCreateFraction}>{pt('masterData.fractions.actions.openCreate')}</Button>;
};

export const FractionRowActions = ({
  fraction,
  onOpenEditFraction,
  onRequestDeleteFraction,
}: {
  readonly fraction: WasteFractionRecord;
  readonly onOpenEditFraction: (fraction: WasteFractionRecord) => void;
  readonly onRequestDeleteFraction: (fraction: WasteFractionRecord) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
        aria-label={pt('masterData.fractions.actions.edit')}
        onClick={() => onOpenEditFraction(fraction)}
      >
        <IconEdit aria-hidden="true" className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-destructive"
        aria-label={pt('masterData.fractions.actions.delete')}
        onClick={() => onRequestDeleteFraction(fraction)}
      >
        <IconTrash aria-hidden="true" className="h-4 w-4 text-destructive" />
      </Button>
    </>
  );
};
