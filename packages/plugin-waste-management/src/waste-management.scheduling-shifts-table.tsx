import { useMemo, useRef, useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioDataTable,
} from '@sva/studio-ui-react';

import type { WasteSchedulingTableEntry } from './waste-management.scheduling.shared.js';
import {
  useSchedulingColumns,
  WasteSchedulingDeleteDialog,
  useSchedulingTableLabels,
  WasteSchedulingRowActions,
} from './waste-management.scheduling-shifts-table.parts.js';
import {
  createPagedItems,
  usePagedRouteSync,
  WastePanelTableBottomBar,
} from './waste-management.table-frame.js';

type WasteSchedulingShiftsTableProps = {
  readonly entries: readonly WasteSchedulingTableEntry[];
  readonly onOpenCreateShiftDialog: () => void;
  readonly onEditHolidayRule: (rule: Extract<WasteSchedulingTableEntry, { kind: 'holiday' }>['rule']) => void;
  readonly onEditGlobalShiftDialog: (shift: Extract<WasteSchedulingTableEntry, { kind: 'global' }>['shift']) => void;
  readonly onEditTourShiftDialog: (shift: Extract<WasteSchedulingTableEntry, { kind: 'tour' }>['shift']) => void;
  readonly onDeleteSchedulingRows: (rows: readonly WasteSchedulingTableEntry[]) => Promise<void>;
  readonly saving: boolean;
  readonly page: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly onSyncPageChange?: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
};

export const WasteSchedulingShiftsTable = ({
  entries,
  onOpenCreateShiftDialog,
  onEditHolidayRule,
  onEditGlobalShiftDialog,
  onEditTourShiftDialog,
  onDeleteSchedulingRows,
  page,
  pageSize,
  onPageChange,
  onSyncPageChange,
  onPageSizeChange,
}: WasteSchedulingShiftsTableProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const [pendingDeleteRows, setPendingDeleteRows] = useState<readonly WasteSchedulingTableEntry[]>([]);
  const clearSelectionRef = useRef<() => void>(() => undefined);
  const labels = useSchedulingTableLabels();
  const columns = useSchedulingColumns();
  const pagedRows = useMemo(() => createPagedItems({ items: entries, page, pageSize }), [entries, page, pageSize]);

  usePagedRouteSync({ page, safePage: pagedRows.safePage, onPageChange, onSyncPageChange });

  return (
    <div className="[&>div]:rounded-none [&>div]:border-x-0">
      <StudioDataTable
        ariaLabel={pt('scheduling.table.ariaLabel')}
        caption={pt('scheduling.table.caption')}
        labels={labels}
        data={pagedRows.items}
        columns={columns}
        getRowId={(row) => `${row.kind}:${row.id}`}
        toolbarEnd={
          <Button type="button" className="rounded-lg" onClick={onOpenCreateShiftDialog}>
            {pt('scheduling.actions.openCreate')}
          </Button>
        }
        emptyState={<p className="text-sm text-muted-foreground">{pt('scheduling.messages.emptyBody')}</p>}
        rowActions={(row) => (
          <WasteSchedulingRowActions
            row={row}
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
        onConfirm={() => {
          void Promise.resolve(onDeleteSchedulingRows(pendingDeleteRows)).finally(() => {
            clearSelectionRef.current();
            setPendingDeleteRows([]);
          });
        }}
      />
    </div>
  );
};
