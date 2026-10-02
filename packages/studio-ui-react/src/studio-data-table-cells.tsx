import * as React from 'react';
import { ArrowDownAZ, ArrowUpDown, ArrowUpZA } from 'lucide-react';
import { flexRender, type RowData } from '@tanstack/react-table';
import type { LegacyHeader, LegacyRow, LegacyTable } from '@tanstack/react-table/legacy';

import { Button } from './button.js';
import { Checkbox } from './checkbox.js';
import type { StudioDataTableLabels } from './studio-data-table-types.js';

export const getAriaSort = (sorting: false | 'asc' | 'desc') => {
  if (sorting === 'asc') {
    return 'ascending';
  }
  if (sorting === 'desc') {
    return 'descending';
  }
  return 'none';
};

export const SortIcon = ({ direction }: { direction: false | 'asc' | 'desc' }) => {
  if (direction === 'asc') {
    return <ArrowDownAZ className="h-4 w-4" aria-hidden="true" />;
  }
  if (direction === 'desc') {
    return <ArrowUpZA className="h-4 w-4" aria-hidden="true" />;
  }
  return <ArrowUpDown className="h-4 w-4" aria-hidden="true" />;
};
export const renderSelectionHeader = <TData extends RowData>(
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

export const renderSelectionCell = <TData extends RowData>(
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

export const renderActionsCell = <TData extends RowData>(
  row: LegacyRow<TData>,
  rowActions: (row: TData) => React.ReactNode
) => <div className="flex justify-end gap-2">{rowActions(row.original)}</div>;

export const renderHeaderCellContent = <TData extends RowData>(header: LegacyHeader<TData>) => {
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
