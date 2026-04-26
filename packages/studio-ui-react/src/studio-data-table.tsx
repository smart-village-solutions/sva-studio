import { ArrowDownAZ, ArrowUpDown, ArrowUpZA } from 'lucide-react';
import * as React from 'react';
import {
  type CellContext,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';

import { Button, type ButtonProps } from './button.js';
import { Checkbox } from './checkbox.js';
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

export type StudioColumnDef<TData> = Readonly<{
  id: string;
  header: React.ReactNode;
  cell: (row: TData) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: TData) => string | number;
  mobileLabel?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  mobileClassName?: string;
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
  toolbarEnd?: React.ReactNode;
  emptyState: React.ReactNode;
  loadingState?: React.ReactNode;
  isLoading?: boolean;
  getRowId: (row: TData) => string;
  selectionMode?: 'none' | 'multiple';
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

const renderSelectionHeader = <TData,>(
  table: ReturnType<typeof useReactTable<TData>>,
  ariaLabel: string,
  labels: StudioDataTableLabels
) => (
  <Checkbox
    aria-label={labels.selectAllRows(ariaLabel)}
    checked={table.getIsAllRowsSelected()}
    aria-checked={table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected() ? 'mixed' : table.getIsAllRowsSelected()}
    indeterminate={table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()}
    onChange={(event) => table.toggleAllRowsSelected(event.target.checked)}
  />
);

const renderSelectionCell = <TData,>(
  row: CellContext<TData, unknown>['row'],
  ariaLabel: string,
  labels: StudioDataTableLabels
) => (
  <Checkbox
    aria-label={labels.selectRow({ label: ariaLabel, rowId: row.id })}
    checked={row.getIsSelected()}
    ref={undefined}
    onChange={(event) => row.toggleSelected(event.target.checked)}
  />
);

const renderActionsCell = <TData,>(row: CellContext<TData, unknown>['row'], rowActions: (row: TData) => React.ReactNode) => (
  <div className="flex justify-end gap-2">{rowActions(row.original)}</div>
);

const renderHeaderCellContent = <TData,>(header: ReturnType<ReturnType<typeof useReactTable<TData>>['getHeaderGroups']>[number]['headers'][number]) => {
  if (header.isPlaceholder) {
    return null;
  }

  const canSort = header.column.getCanSort();
  const sortingState = header.column.getIsSorted();

  if (!canSort) {
    return <span className="font-semibold text-foreground">{flexRender(header.column.columnDef.header, header.getContext())}</span>;
  }

  return (
    <Button
      type="button"
      className="h-auto px-0 py-0 font-semibold hover:bg-transparent"
      variant="ghost"
      onClick={header.column.getToggleSortingHandler()}
    >
      {flexRender(header.column.columnDef.header, header.getContext())}
      <SortIcon direction={sortingState} />
    </Button>
  );
};

export function StudioDataTable<TData>({
  ariaLabel,
  labels,
  caption,
  data,
  columns,
  rowActions,
  bulkActions = [],
  toolbarStart,
  toolbarEnd,
  emptyState,
  loadingState,
  isLoading = false,
  getRowId,
  selectionMode = 'multiple',
}: StudioDataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const selectedRowCount = Object.keys(rowSelection).length;

  React.useEffect(() => {
    setRowSelection({});
  }, [data]);

  const clearSelection = React.useCallback(() => {
    setRowSelection({});
  }, []);

  const tableData = React.useMemo(() => [...data], [data]);

  const coreColumns = React.useMemo<ColumnDef<TData>[]>(() => {
    const tableColumns = columns.map<ColumnDef<TData>>((column) => ({
      id: column.id,
      accessorFn: column.sortable ? (row) => column.sortValue?.(row) ?? '' : undefined,
      enableSorting: column.sortable ?? false,
      header: () => column.header,
      cell: (context: CellContext<TData, unknown>) => column.cell(context.row.original),
      meta: {
        className: column.className,
        headerClassName: column.headerClassName,
        mobileLabel: column.mobileLabel ?? column.header,
        mobileClassName: column.mobileClassName,
      },
    }));

    const mappedColumns: ColumnDef<TData>[] = [];

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

  const table = useReactTable({
    data: tableData,
    columns: coreColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId,
    enableRowSelection: selectionMode === 'multiple',
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      rowSelection,
    },
  });

  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);
  const hasToolbar = bulkActions.length > 0 || toolbarStart || toolbarEnd;

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
        <div className="p-6" role="status" aria-live="polite">
          {emptyState}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-shell" aria-busy="false" data-selected-rows={selectedRowCount}>
      {hasToolbar ? (
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {bulkActions.map((action) =>
              action.render ? (
                <React.Fragment key={action.id}>{action.render}</React.Fragment>
              ) : (
                <Button
                  key={action.id}
                  type="button"
                  variant={action.variant ?? 'outline'}
                  disabled={action.disabled ?? selectedRows.length === 0}
                  onClick={() => void action.onClick({ selectedRows, clearSelection })}
                >
                  {action.label}
                </Button>
              )
            )}
            {toolbarStart}
          </div>
          {toolbarEnd ? <div className="flex flex-wrap items-center gap-2 lg:justify-end">{toolbarEnd}</div> : null}
        </div>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full border-collapse" aria-label={ariaLabel}>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as { headerClassName?: string } | undefined;

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={cn('px-3 py-3', meta?.headerClassName)}
                      aria-sort={header.column.getCanSort() ? getAriaSort(header.column.getIsSorted()) : undefined}
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
              <tr key={row.id} className="border-t border-border text-sm text-foreground">
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
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {table.getRowModel().rows.map((row) => (
          <article key={row.id} className="rounded-lg border border-border bg-card p-3 text-sm text-foreground shadow-shell">
            {selectionMode === 'multiple' ? (
              <div className="mb-3 flex justify-end">
                <Checkbox
                  aria-label={(labels.selectMobileRow ?? labels.selectRow)({ label: ariaLabel, rowId: row.id })}
                  checked={row.getIsSelected()}
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

                const meta = cell.column.columnDef.meta as { mobileClassName?: string; mobileLabel?: React.ReactNode } | undefined;

                return (
                  <div key={cell.id} className={cn('grid gap-1', meta?.mobileClassName)}>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{meta?.mobileLabel}</span>
                    <div>{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
