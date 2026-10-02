import * as React from 'react';
import type { SortingState } from '@tanstack/react-table';

import { Button } from './button.js';
import { Select } from './select.js';
import { SortIcon } from './studio-data-table-cells.js';
import type {
  StudioBulkAction,
  StudioColumnDef,
  StudioDataTableSorting,
} from './studio-data-table-types.js';

type StudioDataTableToolbarProps<TData> = Readonly<{
  bulkActions: readonly StudioBulkAction<TData>[];
  selectedRows: TData[];
  clearSelection: () => void;
  toolbarStart?: React.ReactNode;
  toolbarCenter?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
}>;

export function StudioDataTableToolbar<TData>({
  bulkActions,
  selectedRows,
  clearSelection,
  toolbarStart,
  toolbarCenter,
  toolbarEnd,
}: StudioDataTableToolbarProps<TData>) {
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
  return toolbarContent;
}

type StudioDataTableMobileSortingProps<TData> = Readonly<{
  sortingConfig: StudioDataTableSorting;
  sorting: SortingState;
  sortableColumns: readonly (StudioColumnDef<TData> & { sortable: true })[];
  handleSortingChange: (sorting: SortingState) => void;
}>;

export function StudioDataTableMobileSorting<TData>({
  sortingConfig,
  sorting,
  sortableColumns,
  handleSortingChange,
}: StudioDataTableMobileSortingProps<TData>) {
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
  return mobileSortingControls;
}
