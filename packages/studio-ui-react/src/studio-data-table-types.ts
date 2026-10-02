import type * as React from 'react';
import type { SortingState } from '@tanstack/react-table';

import type { ButtonProps } from './button.js';

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
