import { ArrowDownAZ, ArrowUpDown, ArrowUpZA } from 'lucide-react';
import * as React from 'react';
import {
  flexRender,
  type RowData,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import {
  type LegacyColumnDef,
  type LegacyHeader,
  type LegacyRow,
  type LegacyTable,
  getCoreRowModel,
  getSortedRowModel,
  useLegacyTable,
} from '@tanstack/react-table/legacy';

import { Button, type ButtonProps } from './button.js';
import { Checkbox } from './checkbox.js';
import { Select } from './select.js';
import { StudioTableLayoutProvider } from './studio-table-layout-context.js';
import { cn } from './utils.js';

export type StudioDataTableLabels = Readonly<{
  selectionColumn: string;
  actionsColumn: string;
  loading: React.ReactNode;
  selectAllRows: (label: string) => string;
  selectRow: (context: { label: string; rowId: string }) => string;
  selectMobileRow?: (context: { label: string; rowId: string }) => string;
}>;

export type StudioBulkAction<TData> = Readonly<{
  id: string;
  label: React.ReactNode;
  disabled?: boolean;
  variant?: ButtonProps['variant'];
  onClick: (context: { selectedRows: TData[]; clearSelection: () => void }) => void | Promise<void>;
  render?: React.ReactNode;
}>;

type StudioColumnDefBase<TData> = Readonly<{
  id: string;
  header: React.ReactNode;
  cell: (row: TData) => React.ReactNode;
  mobileLabel?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  mobileClassName?: string;
}>;

export type StudioColumnDef<TData> = StudioColumnDefBase<TData> &
  (
    | Readonly<{
        sortable: true;
        sortLabel: string;
        sortValue: (row: TData) => string | number | null | undefined;
      }>
    | Readonly<{
        sortable?: false;
        sortLabel?: never;
        sortValue?: never;
      }>
  );

export type StudioDataTableSortingLabels = Readonly<{
  field: string;
  direction: string;
  none: string;
  ascending: string;
  descending: string;
}>;

export type StudioDataTableSorting =
  | Readonly<{ mode: 'disabled' }>
  | Readonly<{
      mode: 'client';
      labels: StudioDataTableSortingLabels;
      state?: SortingState;
      onChange?: (sorting: SortingState) => void;
    }>
  | Readonly<{
      mode: 'external';
      labels: StudioDataTableSortingLabels;
      state: SortingState;
      onChange: (sorting: SortingState) => void;
    }>;

export type StudioDataTableProps<TData> = Readonly<{
  ariaLabel: string;
  labels: StudioDataTableLabels;
  caption?: string;
  data: readonly TData[];
  columns: readonly StudioColumnDef<TData>[];
  rowActions?: (row: TData) => React.ReactNode;
  bulkActions?: readonly StudioBulkAction<TData>[];
  toolbarStart?: React.ReactNode;
  toolbarCenter?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
  footer?: React.ReactNode;
  emptyState: React.ReactNode;
  loadingState?: React.ReactNode;
  isLoading?: boolean;
  getRowId: (row: TData) => string;
  selectionMode?: 'none' | 'multiple';
  canSelectRow?: (row: TData) => boolean;
  sorting: StudioDataTableSorting;
}>;

const getAriaSort = (sorting: false | 'asc' | 'desc') => {
  if (sorting === 'asc') {
    return 'ascending';
  }
  if (sorting === 'desc') {
    return 'descending';
  }
  return 'none';
};

const SortIcon = ({ direction }: { direction: false | 'asc' | 'desc' }) => {
  if (direction === 'asc') {
    return <ArrowDownAZ className="h-4 w-4" aria-hidden="true" />;
  }
  if (direction === 'desc') {
    return <ArrowUpZA className="h-4 w-4" aria-hidden="true" />;
  }
  return <ArrowUpDown className="h-4 w-4" aria-hidden="true" />;
};

const compareByCodeUnit = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
};

export const compareAlphabetically = (left: string, right: string) =>
  left.localeCompare(right, 'de') || compareByCodeUnit(left, right);

const renderSelectionHeader = <TData extends RowData>(
  table: LegacyTable<TData>,
  ariaLabel: string,
  labels: StudioDataTableLabels
) => (
  <Checkbox
    aria-label={labels.selectAllRows(ariaLabel)}
    checked={table.getIsAllRowsSelected()}
    aria-checked={
      table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()
        ? 'mixed'
        : table.getIsAllRowsSelected()
    }
    indeterminate={table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()}
    onChange={(event) => table.toggleAllRowsSelected(event.target.checked)}
  />
);

const renderSelectionCell = <TData extends RowData>(
  row: LegacyRow<TData>,
  ariaLabel: string,
  labels: StudioDataTableLabels
) => (
  <Checkbox
    aria-label={labels.selectRow({ label: ariaLabel, rowId: row.id })}
    checked={row.getIsSelected()}
    disabled={!row.getCanSelect()}
    ref={undefined}
    onChange={(event) => row.toggleSelected(event.target.checked)}
  />
);

const renderActionsCell = <TData extends RowData>(
  row: LegacyRow<TData>,
  rowActions: (row: TData) => React.ReactNode
) => <div className="flex justify-end gap-2">{rowActions(row.original)}</div>;

const renderHeaderCellContent = <TData extends RowData>(header: LegacyHeader<TData>) => {
  if (header.isPlaceholder) {
    return null;
  }

  const canSort = header.column.getCanSort();
  const sortingState = header.column.getIsSorted();

  if (!canSort) {
    return (
      <span className="font-semibold text-foreground">
        {flexRender(header.column.columnDef.header, header.getContext())}
      </span>
    );
  }

  return (
    <Button
      type="button"
      className="h-auto px-0 py-0 font-semibold hover:bg-transparent hover:animate-none"
      variant="tertiary"
      onClick={header.column.getToggleSortingHandler()}
    >
      {flexRender(header.column.columnDef.header, header.getContext())}
      <SortIcon direction={sortingState} />
    </Button>
  );
};

export function StudioDataTable<TData extends RowData>({
  ariaLabel,
  labels,
  caption,
  data,
  columns,
  rowActions,
  bulkActions = [],
  toolbarStart,
  toolbarCenter,
  toolbarEnd,
  footer,
  emptyState,
  loadingState,
  isLoading = false,
  getRowId,
  selectionMode = 'multiple',
  canSelectRow,
  sorting: sortingConfig,
}: StudioDataTableProps<TData>) {
  const [uncontrolledSorting, setUncontrolledSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const selectedRowCount = Object.keys(rowSelection).length;
  const controlledSorting = sortingConfig.mode === 'disabled' ? undefined : sortingConfig.state;
  const sorting =
    sortingConfig.mode === 'disabled' ? [] : (controlledSorting ?? uncontrolledSorting);
  const sortableColumns = React.useMemo(
    () =>
      columns.filter(
        (column): column is StudioColumnDef<TData> & { sortable: true } => column.sortable === true
      ),
    [columns]
  );

  if (sortingConfig.mode === 'disabled' && sortableColumns.length > 0) {
    throw new Error('studio_data_table_disabled_sorting_has_sortable_columns');
  }
  if (sortingConfig.mode !== 'disabled' && sortableColumns.length === 0) {
    throw new Error('studio_data_table_enabled_sorting_has_no_sortable_columns');
  }
  if (
    sortingConfig.mode === 'external' &&
    (sorting.length !== 1 || !sortableColumns.some((column) => column.id === sorting[0]?.id))
  ) {
    throw new Error('studio_data_table_external_sorting_requires_one_supported_field');
  }

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [isCompact, setIsCompact] = React.useState(false);
  const selectionScopeKey = React.useMemo(
    () =>
      [...data]
        .map((row) => getRowId(row))
        .sort(compareAlphabetically)
        .join('\u0000'),
    [data, getRowId]
  );
  const selectableScopeKey = React.useMemo(
    () =>
      [...data]
        .map((row) => `${getRowId(row)}:${canSelectRow ? (canSelectRow(row) ? '1' : '0') : '1'}`)
        .sort(compareAlphabetically)
        .join('\u0000'),
    [canSelectRow, data, getRowId]
  );

  React.useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        setIsCompact(width < 640);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const availableRowIds = new Set(data.map((row) => getRowId(row)));
    const selectableRowIds = new Set(
      data.filter((row) => (canSelectRow ? canSelectRow(row) : true)).map((row) => getRowId(row))
    );

    setRowSelection((current) => {
      let changed = false;
      const next: RowSelectionState = {};

      for (const [rowId, isSelected] of Object.entries(current)) {
        if (isSelected && availableRowIds.has(rowId) && selectableRowIds.has(rowId)) {
          next[rowId] = true;
          continue;
        }
        changed = true;
      }

      return changed ? next : current;
    });
  }, [canSelectRow, data, getRowId, selectableScopeKey, selectionScopeKey]);

  const clearSelection = React.useCallback(() => {
    setRowSelection({});
  }, []);

  const handleSortingChange = React.useCallback(
    (updater: SortingState | ((current: SortingState) => SortingState)) => {
      if (sortingConfig.mode === 'disabled') {
        return;
      }
      const nextSorting = typeof updater === 'function' ? updater(sorting) : updater;
      const normalizedSorting =
        sortingConfig.mode === 'external' && nextSorting.length > 1
          ? nextSorting.slice(-1)
          : nextSorting;
      sortingConfig.onChange?.(normalizedSorting);
      if (sortingConfig.mode === 'client' && controlledSorting === undefined) {
        setUncontrolledSorting(normalizedSorting);
      }
    },
    [controlledSorting, sorting, sortingConfig]
  );

  const tableData = React.useMemo(() => [...data], [data]);

  const coreColumns = React.useMemo<LegacyColumnDef<TData>[]>(() => {
    const tableColumns = columns.map<LegacyColumnDef<TData>>((column) => ({
      id: column.id,
      ...(column.sortable ? { accessorFn: (row: TData) => column.sortValue(row) } : {}),
      enableSorting: column.sortable ?? false,
      header: () => column.header,
      cell: (context) => column.cell(context.row.original),
      meta: {
        className: column.className,
        headerClassName: column.headerClassName,
        mobileLabel: column.mobileLabel ?? column.header,
        mobileClassName: column.mobileClassName,
      },
    }));

    const mappedColumns: LegacyColumnDef<TData>[] = [];

    if (selectionMode === 'multiple') {
      mappedColumns.push({
        id: '__select__',
        enableSorting: false,
        header: ({ table }) => renderSelectionHeader(table, ariaLabel, labels),
        cell: ({ row }) => renderSelectionCell(row, ariaLabel, labels),
        meta: {
          className: 'w-12',
          headerClassName: 'w-12',
          mobileLabel: labels.selectionColumn,
          mobileClassName: 'w-auto',
        },
      });
    }

    mappedColumns.push(...tableColumns);

    if (rowActions) {
      mappedColumns.push({
        id: '__actions__',
        enableSorting: false,
        header: () => labels.actionsColumn,
        cell: ({ row }) => renderActionsCell(row, rowActions),
        meta: {
          className: 'text-right',
          headerClassName: 'text-right',
          mobileLabel: labels.actionsColumn,
          mobileClassName: 'justify-end',
        },
      });
    }

    return mappedColumns;
  }, [ariaLabel, columns, labels, rowActions, selectionMode]);

  const table = useLegacyTable({
    data: tableData,
    columns: coreColumns,
    getCoreRowModel: getCoreRowModel<TData>(),
    getSortedRowModel: getSortedRowModel<TData>(),
    manualSorting: sortingConfig.mode === 'external',
    enableSortingRemoval: sortingConfig.mode !== 'external',
    enableMultiSort: false,
    getRowId,
    enableRowSelection:
      selectionMode === 'multiple'
        ? (row) => (canSelectRow ? canSelectRow(row.original) : true)
        : false,
    onSortingChange: handleSortingChange,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      rowSelection,
    },
  });

  const activeSorting = sorting[0];
  const mobileSortingControls =
    sortingConfig.mode !== 'disabled' ? (
      <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:hidden">
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {sortingConfig.labels.field}
          <Select
            value={activeSorting?.id ?? ''}
            onChange={(event) => {
              const nextId = event.target.value;
              if (!nextId) {
                handleSortingChange([]);
                return;
              }
              handleSortingChange([{ id: nextId, desc: false }]);
            }}
          >
            {sortingConfig.mode === 'client' ? (
              <option value="">{sortingConfig.labels.none}</option>
            ) : null}
            {sortableColumns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.sortLabel}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {sortingConfig.labels.direction}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!activeSorting}
            aria-label={`${sortingConfig.labels.direction}: ${
              activeSorting?.desc ? sortingConfig.labels.descending : sortingConfig.labels.ascending
            }`}
            onClick={() => {
              if (activeSorting) {
                handleSortingChange([{ ...activeSorting, desc: !activeSorting.desc }]);
              }
            }}
          >
            <SortIcon direction={activeSorting ? (activeSorting.desc ? 'desc' : 'asc') : false} />
          </Button>
        </div>
      </div>
    ) : null;

  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);
  const hasToolbar = bulkActions.length > 0 || toolbarStart || toolbarCenter || toolbarEnd;
  const bulkActionsContent = bulkActions.map((action) =>
    action.render ? (
      <React.Fragment key={action.id}>{action.render}</React.Fragment>
    ) : (
      <Button
        key={action.id}
        type="button"
        variant={action.variant ?? 'secondary'}
        className="disabled:border-border/60 disabled:bg-muted disabled:text-muted-foreground"
        disabled={action.disabled ?? selectedRows.length === 0}
        onClick={() => void action.onClick({ selectedRows, clearSelection })}
      >
        {action.label}
      </Button>
    )
  );
  const toolbarContent = hasToolbar ? (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
      {toolbarCenter ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {bulkActionsContent}
            {toolbarStart}
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-center">
            {toolbarCenter}
          </div>
          {toolbarEnd ? (
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">{toolbarEnd}</div>
          ) : (
            <div className="hidden lg:block" />
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {bulkActionsContent}
            {toolbarStart}
          </div>
          {toolbarEnd ? (
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">{toolbarEnd}</div>
          ) : null}
        </>
      )}
    </div>
  ) : null;
  const footerContent = footer ? (
    <div className="border-t border-border px-4 py-4">{footer}</div>
  ) : null;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-shell" aria-busy="true">
        <div className="p-6 text-sm text-muted-foreground" role="status" aria-live="polite">
          {loadingState ?? labels.loading}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-shell">
        {toolbarContent}
        <div className="p-6" role="status" aria-live="polite">
          {emptyState}
        </div>
        {footerContent}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-xl border border-border bg-card shadow-shell"
      aria-busy="false"
      data-selected-rows={selectedRowCount}
      data-layout={isCompact ? 'compact' : 'wide'}
    >
      {toolbarContent}

      <div className={isCompact ? 'hidden' : 'overflow-x-auto'}>
        <StudioTableLayoutProvider layout="wide">
          <table className="min-w-full border-collapse" aria-label={ariaLabel}>
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta as
                      { headerClassName?: string } | undefined;

                    return (
                      <th
                        key={header.id}
                        scope="col"
                        className={cn('px-3 py-3', meta?.headerClassName)}
                        aria-sort={
                          header.column.getCanSort()
                            ? getAriaSort(header.column.getIsSorted())
                            : undefined
                        }
                      >
                        {renderHeaderCellContent(header)}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-border text-sm text-foreground transition-colors duration-150 hover:bg-muted/40"
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as { className?: string } | undefined;
                    return (
                      <td key={cell.id} className={cn('px-3 py-3 align-top', meta?.className)}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </StudioTableLayoutProvider>
      </div>

      <div className={isCompact ? 'space-y-3 p-3' : 'hidden'}>
        <StudioTableLayoutProvider layout="compact">
          {mobileSortingControls}
          {table.getRowModel().rows.map((row) => (
            <article
              key={row.id}
              className="rounded-lg border border-border bg-card p-3 text-sm text-foreground shadow-shell"
            >
              {selectionMode === 'multiple' ? (
                <div className="mb-3 flex justify-end">
                  <Checkbox
                    aria-label={(labels.selectMobileRow ?? labels.selectRow)({
                      label: ariaLabel,
                      rowId: row.id,
                    })}
                    checked={row.getIsSelected()}
                    disabled={!row.getCanSelect()}
                    ref={undefined}
                    onChange={(event) => row.toggleSelected(event.target.checked)}
                  />
                </div>
              ) : null}
              <div className="space-y-3">
                {row.getVisibleCells().map((cell) => {
                  if (cell.column.id === '__select__') {
                    return null;
                  }

                  const meta = cell.column.columnDef.meta as
                    { mobileClassName?: string; mobileLabel?: React.ReactNode } | undefined;

                  return (
                    <div key={cell.id} className={cn('grid gap-1', meta?.mobileClassName)}>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        {meta?.mobileLabel}
                      </span>
                      <div>{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </StudioTableLayoutProvider>
      </div>

      {footerContent}
    </div>
  );
}
