import * as React from 'react';
import { type RowData, type RowSelectionState, type SortingState } from '@tanstack/react-table';
import {
  getCoreRowModel,
  getSortedRowModel,
  useLegacyTable,
} from '@tanstack/react-table/legacy';

import { createStudioDataTableColumns } from './studio-data-table-columns.js';
import {
  StudioDataTableMobileSorting,
  StudioDataTableToolbar,
} from './studio-data-table-toolbar.js';
import { StudioDataTableView } from './studio-data-table-view.js';
import type { StudioColumnDef, StudioDataTableProps } from './studio-data-table-types.js';

export type {
  StudioDataTableLabels,
  StudioBulkAction,
  StudioColumnDef,
  StudioDataTableSortingLabels,
  StudioDataTableSorting,
  StudioDataTableProps,
} from './studio-data-table-types.js';

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

  const coreColumns = React.useMemo(
    () => createStudioDataTableColumns({ columns, selectionMode, ariaLabel, labels, rowActions }),
    [ariaLabel, columns, labels, rowActions, selectionMode]
  );

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
  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);
  const toolbarContent = (
    <StudioDataTableToolbar
      bulkActions={bulkActions}
      selectedRows={selectedRows}
      clearSelection={clearSelection}
      toolbarStart={toolbarStart}
      toolbarCenter={toolbarCenter}
      toolbarEnd={toolbarEnd}
    />
  );
  const mobileSortingControls = (
    <StudioDataTableMobileSorting
      sortingConfig={sortingConfig}
      sorting={sorting}
      sortableColumns={sortableColumns}
      handleSortingChange={handleSortingChange}
    />
  );
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
    <StudioDataTableView
      table={table}
      containerRef={containerRef}
      ariaLabel={ariaLabel}
      caption={caption}
      labels={labels}
      selectionMode={selectionMode}
      isCompact={isCompact}
      selectedRowCount={selectedRowCount}
      toolbarContent={toolbarContent}
      mobileSortingControls={mobileSortingControls}
      footerContent={footerContent}
    />
  );
}
