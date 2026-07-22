import type { WasteFractionRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconFilter } from '@tabler/icons-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  type StudioBulkAction,
  type StudioDataTableLabels,
  type StudioDataTableProps,
} from '@sva/studio-ui-react';
import type {
  WasteManagementFractionSortDirection,
  WasteManagementFractionSortField,
  WasteManagementStatusFilter,
} from './search-params.js';
export { FractionRowActions } from './waste-management.master-data-fraction-row-actions.js';

type StudioTableSortingState = NonNullable<StudioDataTableProps<WasteFractionRecord>['sorting']>;

export type WasteFractionsContentProps = {
  readonly fractions: readonly WasteFractionRecord[];
  readonly fractionsSortBy: WasteManagementFractionSortField;
  readonly fractionsSortDirection: WasteManagementFractionSortDirection;
  readonly fractionsStatus: WasteManagementStatusFilter;
  readonly onOpenCreateFraction: () => void;
  readonly onOpenEditFraction: (fraction: WasteFractionRecord) => void;
  readonly onOpenDeleteFraction: (fraction: WasteFractionRecord) => void | Promise<void>;
  readonly onDeleteFractions: (fractionIds: readonly string[]) => void | Promise<void>;
  readonly onToggleFractionStatus: (
    fraction: WasteFractionRecord,
    active: boolean
  ) => void | Promise<void>;
  readonly onFractionsSortChange: (
    sortBy: WasteManagementFractionSortField,
    sortDirection: WasteManagementFractionSortDirection
  ) => void;
  readonly onFractionsStatusChange: (status: WasteManagementStatusFilter) => void;
  readonly page: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly onSyncPageChange?: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
  readonly saving?: boolean;
};

const columnIdBySortField: Record<WasteManagementFractionSortField, string> = {
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
): StudioTableSortingState => [
  { id: columnIdBySortField[fractionsSortBy], desc: fractionsSortDirection === 'desc' },
];

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
      ...(saving ? { disabled: true } : {}),
      onClick: async ({ selectedRows, clearSelection }) => {
        await onDeleteFractions(selectedRows.map((row) => row.id));
        clearSelection();
      },
    },
  ];
  return actions;
};

export const FractionPrimaryAction = ({
  onOpenCreateFraction,
}: {
  readonly onOpenCreateFraction: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <Button type="button" onClick={onOpenCreateFraction}>
      {pt('masterData.fractions.actions.openCreate')}
    </Button>
  );
};

export const WasteFractionsFilterAction = ({
  fractionsStatus,
  filterDialogOpen,
  draftFractionsStatus,
  onOpenFilterDialog,
  onFilterDialogOpenChange,
  onDraftFractionsStatusChange,
  onApplyFractionsStatus,
  onResetFractionsStatus,
}: {
  readonly fractionsStatus: WasteManagementStatusFilter;
  readonly filterDialogOpen: boolean;
  readonly draftFractionsStatus: WasteManagementStatusFilter;
  readonly onOpenFilterDialog: () => void;
  readonly onFilterDialogOpenChange: (open: boolean) => void;
  readonly onDraftFractionsStatusChange: (status: WasteManagementStatusFilter) => void;
  readonly onApplyFractionsStatus: () => void;
  readonly onResetFractionsStatus: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <>
      <div className="flex items-center gap-2">
        {fractionsStatus !== 'all' ? (
          <Button
            type="button"
            variant="ghost"
            className="h-10 rounded-lg px-3"
            onClick={onResetFractionsStatus}
          >
            {pt('masterData.fractions.filters.reset')}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-lg border-border/70 px-3"
          onClick={onOpenFilterDialog}
        >
          <IconFilter aria-hidden="true" className="h-4 w-4" />
          {pt('masterData.fractions.filters.open')}
        </Button>
      </div>
      <FractionsFilterDialog
        open={filterDialogOpen}
        status={fractionsStatus}
        draftStatus={draftFractionsStatus}
        onOpenChange={onFilterDialogOpenChange}
        onDraftStatusChange={onDraftFractionsStatusChange}
        onApply={onApplyFractionsStatus}
      />
    </>
  );
};

const FractionsFilterDialog = ({
  open,
  status,
  draftStatus,
  onOpenChange,
  onDraftStatusChange,
  onApply,
}: {
  readonly open: boolean;
  readonly status: WasteManagementStatusFilter;
  readonly draftStatus: WasteManagementStatusFilter;
  readonly onOpenChange: (open: boolean) => void;
  readonly onDraftStatusChange: (status: WasteManagementStatusFilter) => void;
  readonly onApply: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pt('masterData.fractions.filters.title')}</DialogTitle>
          <DialogDescription>{pt('masterData.fractions.filters.description')}</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-muted-foreground">
            {pt('masterData.fractions.filters.statusLabel')}
          </span>
          <Select
            aria-label={pt('masterData.fractions.filters.statusLabel')}
            className="h-10 rounded-lg"
            value={draftStatus}
            onChange={(event) =>
              onDraftStatusChange(event.target.value as WasteManagementStatusFilter)
            }
          >
            <option value="all">{pt('masterData.fractions.filters.status.all')}</option>
            <option value="active">{pt('masterData.fractions.filters.status.active')}</option>
            <option value="inactive">{pt('masterData.fractions.filters.status.inactive')}</option>
          </Select>
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {pt('masterData.fractions.filters.cancel')}
          </Button>
          <Button type="button" onClick={onApply} disabled={draftStatus === status}>
            {pt('masterData.fractions.filters.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
