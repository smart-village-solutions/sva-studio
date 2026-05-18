import { useMemo, useRef, useState } from 'react';
import type { WasteGlobalDateShiftRecord, WasteTourDateShiftRecord, WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconEdit } from '@tabler/icons-react';
import {
  Badge,
  Button,
  StudioConfirmDialog,
  type StudioBulkAction,
  type StudioColumnDef,
  type StudioDataTableLabels,
  StudioDataTable,
} from '@sva/studio-ui-react';

import {
  combineSchedulingTableRows,
  type WasteSchedulingTableRow,
} from './waste-management.scheduling.shared.js';
import { WasteSchedulingMissingValue } from './waste-management.scheduling-list.parts.js';
import {
  createPagedItems,
  usePagedRouteSync,
  WastePanelTableBottomBar,
} from './waste-management.table-frame.js';

type WasteSchedulingShiftsTableProps = {
  readonly globalDateShifts: readonly WasteGlobalDateShiftRecord[];
  readonly tourDateShifts: readonly WasteTourDateShiftRecord[];
  readonly availableTours: readonly WasteTourRecord[];
  readonly onOpenCreateShiftDialog: () => void;
  readonly onEditGlobalShiftDialog: (shift: WasteGlobalDateShiftRecord) => void;
  readonly onEditTourShiftDialog: (shift: WasteTourDateShiftRecord) => void;
  readonly onDeleteSchedulingRows: (rows: readonly WasteSchedulingTableRow[]) => Promise<void>;
  readonly saving: boolean;
  readonly page: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly onSyncPageChange?: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
};

const formatDisplayDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeZone: 'UTC' }).format(parsed);
};

const WasteSchedulingTableMeta = ({ children }: { readonly children: string }) => (
  <span className="text-xs leading-5 text-muted-foreground">{children}</span>
);

const WasteSchedulingTableScopeBadge = ({ kind }: { readonly kind: WasteSchedulingTableRow['kind'] }) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Badge variant="outline" className="rounded-full border-border/70 bg-transparent px-2 py-0.5 text-[11px] font-medium">
      {kind === 'global' ? pt('scheduling.table.scopeGlobal') : pt('scheduling.table.scopeTour')}
    </Badge>
  );
};

const joinMetaItems = (values: readonly string[]) => values.filter((value) => value.length > 0).join(' · ');

const useSchedulingTableLabels = () => {
  const pt = usePluginTranslation('wasteManagement');

  return {
    selectionColumn: pt('common.selection'),
    actionsColumn: pt('scheduling.table.actions'),
    loading: pt('masterData.messages.loading'),
    selectAllRows: (label: string) => `${label}: alle Zeilen auswählen`,
    selectRow: ({ rowId }: { label: string; rowId: string }) => `${rowId}: Zeile auswählen`,
  } satisfies StudioDataTableLabels;
};

const useSchedulingColumns = () => {
  const pt = usePluginTranslation('wasteManagement');

  return useMemo(
    () =>
      [
        {
          id: 'originalDate',
          header: pt('scheduling.table.originalDate'),
          className: 'whitespace-nowrap',
          headerClassName: 'whitespace-nowrap',
          cell: (row) => <span className="font-medium tabular-nums">{formatDisplayDate(row.shift.originalDate)}</span>,
        },
        {
          id: 'actualDate',
          header: pt('scheduling.table.actualDate'),
          className: 'whitespace-nowrap',
          headerClassName: 'whitespace-nowrap',
          cell: (row) => <span className="font-medium tabular-nums">{formatDisplayDate(row.shift.actualDate)}</span>,
        },
        {
          id: 'scope',
          header: pt('scheduling.table.scope'),
          className: 'w-[110px]',
          headerClassName: 'w-[110px]',
          cell: (row) => <WasteSchedulingTableScopeBadge kind={row.kind} />,
        },
        {
          id: 'validity',
          header: pt('scheduling.table.validity'),
          className: 'min-w-[220px]',
          headerClassName: 'min-w-[220px]',
          cell: (row) => {
            const scopeMeta = joinMetaItems([
              `${pt('scheduling.table.hasYear')}: ${row.shift.hasYear ? pt('common.yes') : pt('common.no')}`,
              'followUpMode' in row.shift && row.shift.followUpMode
                ? `${pt('scheduling.table.followUpMode')}: ${pt(`scheduling.followUpModes.${row.shift.followUpMode}`)}`
                : '',
            ]);

            return (
              <div className="space-y-1">
                <p className="text-sm font-medium">{row.contextLabel}</p>
                {scopeMeta ? <WasteSchedulingTableMeta>{scopeMeta}</WasteSchedulingTableMeta> : null}
              </div>
            );
          },
        },
        {
          id: 'description',
          header: pt('scheduling.table.descriptionColumn'),
          className: 'min-w-[260px]',
          headerClassName: 'min-w-[260px]',
          cell: (row) => {
            const reasonLabel = row.shift.reasonType ? pt(`scheduling.reasonTypes.${row.shift.reasonType}`) : '';
            const descriptionMeta = joinMetaItems([
              reasonLabel ? `${pt('scheduling.table.reason')}: ${reasonLabel}` : '',
              row.shift.reasonKey ? `${pt('scheduling.table.reasonKey')}: ${row.shift.reasonKey}` : '',
            ]);

            return (
              <div className="space-y-1">
                {row.shift.description ? <p className="text-sm">{row.shift.description}</p> : <WasteSchedulingMissingValue />}
                {descriptionMeta ? <WasteSchedulingTableMeta>{descriptionMeta}</WasteSchedulingTableMeta> : null}
              </div>
            );
          },
        },
      ] satisfies readonly StudioColumnDef<WasteSchedulingTableRow>[],
    [pt]
  );
};

const noopClearSelection = () => undefined;

export const WasteSchedulingShiftsTable = ({
  globalDateShifts,
  tourDateShifts,
  availableTours,
  onOpenCreateShiftDialog,
  onEditGlobalShiftDialog,
  onEditTourShiftDialog,
  onDeleteSchedulingRows,
  saving,
  page,
  pageSize,
  onPageChange,
  onSyncPageChange,
  onPageSizeChange,
}: WasteSchedulingShiftsTableProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const [bulkDeleteRows, setBulkDeleteRows] = useState<readonly WasteSchedulingTableRow[]>([]);
  const clearSelectionRef = useRef<() => void>(noopClearSelection);
  const labels = useSchedulingTableLabels();
  const columns = useSchedulingColumns();
  const rows = useMemo(
    () =>
      combineSchedulingTableRows({
        globalDateShifts,
        tourDateShifts,
        availableTours,
        t: pt,
      }),
    [availableTours, globalDateShifts, pt, tourDateShifts]
  );
  const pagedRows = useMemo(() => createPagedItems({ items: rows, page, pageSize }), [page, pageSize, rows]);
  const bulkActions = useMemo(
    () =>
      [
        {
          id: 'delete-selected',
          label: pt('scheduling.table.deleteSelected'),
          disabled: saving,
          onClick: ({ selectedRows, clearSelection }) => {
            clearSelectionRef.current = clearSelection;
            setBulkDeleteRows(selectedRows);
          },
        },
      ] satisfies readonly StudioBulkAction<WasteSchedulingTableRow>[],
    [pt, saving],
  );

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
        bulkActions={bulkActions}
        toolbarEnd={
          <Button type="button" className="rounded-lg" onClick={onOpenCreateShiftDialog}>
            {pt('scheduling.actions.openCreate')}
          </Button>
        }
        selectionMode="multiple"
        emptyState={<p className="text-sm text-muted-foreground">{pt('scheduling.messages.emptyBody')}</p>}
        rowActions={(row) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
            aria-label={row.kind === 'global' ? pt('scheduling.global.actions.edit') : pt('scheduling.tour.actions.edit')}
            onClick={() => (row.kind === 'global' ? onEditGlobalShiftDialog(row.shift) : onEditTourShiftDialog(row.shift))}
          >
            <IconEdit aria-hidden="true" className="h-4 w-4" />
          </Button>
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
      <StudioConfirmDialog
        open={bulkDeleteRows.length > 0}
        title={pt('scheduling.bulkDeleteDialog.title')}
        description={pt('scheduling.bulkDeleteDialog.description', { value: bulkDeleteRows.length })}
        confirmLabel={pt('scheduling.bulkDeleteDialog.confirm')}
        cancelLabel={pt('scheduling.bulkDeleteDialog.cancel')}
        onCancel={() => setBulkDeleteRows([])}
        onConfirm={() => {
          void Promise.resolve(onDeleteSchedulingRows(bulkDeleteRows)).finally(() => {
            clearSelectionRef.current();
            setBulkDeleteRows([]);
          });
        }}
      />
    </div>
  );
};
