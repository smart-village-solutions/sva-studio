import { useMemo, useRef, useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioDataTable,
  type StudioDataTableSorting,
  type StudioBulkAction,
} from '@sva/studio-ui-react';

import type { WasteSchedulingTableEntry } from './waste-management.scheduling.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { WasteSchedulingDeleteDialog } from './waste-management.scheduling-delete-dialog.js';
import { WasteSchedulingRowsDeleteError } from './waste-management.scheduling-mutations.js';
import {
  useSchedulingColumns,
  useSchedulingTableLabels,
} from './waste-management.scheduling-shifts-table.parts.js';
import { WasteSchedulingRowActions } from './waste-management.scheduling-row-actions.js';
import {
  createPagedItems,
  usePagedRouteSync,
  WastePanelTableBottomBar,
  WastePanelTableTopBar,
  type WastePanelTableTopBarProps,
} from './waste-management.table-frame.js';

type WasteSchedulingShiftsTableProps = {
  readonly search?: WasteManagementSearchParams;
  readonly entries: readonly WasteSchedulingTableEntry[];
  readonly onOpenCreateShiftDialog: () => void;
  readonly onEditHolidayRule: (
    rule: Extract<WasteSchedulingTableEntry, { kind: 'holiday' }>['rule']
  ) => void;
  readonly onEditGlobalShiftDialog: (
    shift: Extract<WasteSchedulingTableEntry, { kind: 'global' }>['shift']
  ) => void;
  readonly onEditTourShiftDialog: (
    shift: Extract<WasteSchedulingTableEntry, { kind: 'tour' }>['shift']
  ) => void;
  readonly onDeleteSchedulingRows: (rows: readonly WasteSchedulingTableEntry[]) => Promise<void>;
  readonly saving: boolean;
  readonly page: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly onSyncPageChange?: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
  readonly toolbar?: WastePanelTableTopBarProps;
};

const useSortedSchedulingShifts = (
  entries: readonly WasteSchedulingTableEntry[],
  columns: ReturnType<typeof useSchedulingColumns>,
  sorting: Extract<StudioDataTableSorting, { mode: 'external' }>['state']
) =>
  useMemo(() => {
    const [sort] = sorting;
    const column = columns.find((item) => item.id === sort?.id);
    if (!sort || !column?.sortable) return entries;
    return [...entries].sort((left, right) => {
      const a = column.sortValue(left);
      const b = column.sortValue(right);
      if (Boolean(a) !== Boolean(b)) return a ? -1 : 1;
      const comparison = String(a ?? '').localeCompare(String(b ?? ''), 'de', {
        numeric: true,
        sensitivity: 'base',
      });
      return (
        (sort.desc ? -comparison : comparison) ||
        left.kind.localeCompare(right.kind) ||
        left.sortLabel.localeCompare(right.sortLabel) ||
        left.id.localeCompare(right.id)
      );
    });
  }, [columns, entries, sorting]);

export const WasteSchedulingShiftsTable = ({
  entries,
  search,
  onOpenCreateShiftDialog,
  onEditHolidayRule,
  onEditGlobalShiftDialog,
  onEditTourShiftDialog,
  onDeleteSchedulingRows,
  saving,
  page,
  pageSize,
  onPageChange,
  onSyncPageChange,
  onPageSizeChange,
  toolbar,
}: WasteSchedulingShiftsTableProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const [pendingDeleteRows, setPendingDeleteRows] = useState<readonly WasteSchedulingTableEntry[]>(
    []
  );
  const clearSelectionRef = useRef<() => void>(() => undefined);
  const labels = useSchedulingTableLabels();
  const columns = useSchedulingColumns();
  const [sorting, setSorting] = useState<
    Extract<StudioDataTableSorting, { mode: 'external' }>['state']
  >([{ id: 'originalDate', desc: false }]);
  const sortedRows = useSortedSchedulingShifts(entries, columns, sorting);
  const pagedRows = createPagedItems({ items: sortedRows, page, pageSize });
  const bulkActions = useMemo<readonly StudioBulkAction<WasteSchedulingTableEntry>[]>(
    () => [
      {
        id: 'delete-selected-scheduling-rows',
        label: pt('scheduling.actions.deleteSelected'),
        ...(saving ? { disabled: true } : {}),
        onClick: async ({ selectedRows, clearSelection }) => {
          clearSelectionRef.current = clearSelection;
          setPendingDeleteRows(selectedRows);
        },
      },
    ],
    [pt, saving]
  );

  const hasDeletableRows = pagedRows.items.some((row) => row.canDelete);

  usePagedRouteSync({ page, safePage: pagedRows.safePage, onPageChange, onSyncPageChange });

  return (
    <div className="[&>div]:rounded-none [&>div]:border-x-0">
      <WastePanelTableTopBar
        {...toolbar}
        actions={
          <>
            {toolbar?.actions}
            <Button type="button" className="rounded-md" onClick={onOpenCreateShiftDialog}>
              {pt('scheduling.actions.openCreate')}
            </Button>
          </>
        }
      />
      <StudioDataTable
        sorting={{
          mode: 'external',
          state: sorting,
          onChange: (next) => {
            setSorting(next);
            if (page !== 1) onPageChange(1);
          },
          labels: {
            field: pt('filters.sortField'),
            direction: pt('filters.sortDirection'),
            none: pt('filters.any'),
            ascending: pt('masterData.locationsWorkspace.sorting.ascending'),
            descending: pt('masterData.locationsWorkspace.sorting.descending'),
          },
        }}
        ariaLabel={pt('scheduling.table.ariaLabel')}
        caption={pt('scheduling.table.caption')}
        labels={labels}
        data={pagedRows.items}
        columns={columns}
        getRowId={(row) => `${row.kind}:${row.id}`}
        selectionMode={hasDeletableRows ? 'multiple' : 'none'}
        canSelectRow={(row) => row.canDelete}
        bulkActions={hasDeletableRows ? bulkActions : []}
        emptyState={
          <p className="text-sm text-muted-foreground">{pt('scheduling.messages.emptyBody')}</p>
        }
        rowActions={(row) => (
          <WasteSchedulingRowActions
            row={row}
            search={search}
            onEditHolidayRule={onEditHolidayRule}
            onEditGlobalShiftDialog={onEditGlobalShiftDialog}
            onEditTourShiftDialog={onEditTourShiftDialog}
            onRequestDeleteRows={(rows) => {
              clearSelectionRef.current = () => undefined;
              setPendingDeleteRows(rows);
            }}
          />
        )}
      />
      <WastePanelTableBottomBar
        pt={pt}
        page={pagedRows.safePage}
        pageSize={pageSize}
        pageCount={pagedRows.pageCount}
        totalItems={pagedRows.totalItems}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
      <WasteSchedulingDeleteDialog
        pendingDeleteRows={pendingDeleteRows}
        onCancel={() => setPendingDeleteRows([])}
        onConfirm={async () => {
          try {
            await onDeleteSchedulingRows(pendingDeleteRows);
          } catch (error) {
            if (error instanceof WasteSchedulingRowsDeleteError) {
              setPendingDeleteRows(error.remainingRows);
            }
            throw error;
          }
          clearSelectionRef.current();
          setPendingDeleteRows([]);
        }}
      />
    </div>
  );
};
