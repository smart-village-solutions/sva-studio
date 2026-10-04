import type * as React from 'react';
import type { RowData } from '@tanstack/react-table';
import type { LegacyColumnDef } from '@tanstack/react-table/legacy';

import {
  renderActionsCell,
  renderSelectionCell,
  renderSelectionHeader,
} from './studio-data-table-cells.js';
import type { StudioColumnDef, StudioDataTableLabels } from './studio-data-table-types.js';

type StudioDataTableColumnsOptions<TData> = Readonly<{
  columns: readonly StudioColumnDef<TData>[];
  selectionMode: 'none' | 'multiple';
  ariaLabel: string;
  labels: StudioDataTableLabels;
  rowActions?: (row: TData) => React.ReactNode;
}>;

export function createStudioDataTableColumns<TData extends RowData>({
  columns,
  selectionMode,
  ariaLabel,
  labels,
  rowActions,
}: StudioDataTableColumnsOptions<TData>): LegacyColumnDef<TData>[] {
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
}
