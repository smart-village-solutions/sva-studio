import * as React from 'react';
import { flexRender, type RowData } from '@tanstack/react-table';
import type { LegacyTable } from '@tanstack/react-table/legacy';

import { Checkbox } from './checkbox.js';
import { getAriaSort, renderHeaderCellContent } from './studio-data-table-cells.js';
import type { StudioDataTableLabels } from './studio-data-table-types.js';
import { StudioTableLayoutProvider } from './studio-table-layout-context.js';
import { cn } from './utils.js';

type StudioDataTableViewProps<TData extends RowData> = Readonly<{
  table: LegacyTable<TData>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  hasRows: boolean;
  emptyState: React.ReactNode;
  ariaLabel: string;
  caption?: string;
  labels: StudioDataTableLabels;
  selectionMode: 'none' | 'multiple';
  isCompact: boolean;
  selectedRowCount: number;
  toolbarContent: React.ReactNode;
  mobileSortingControls: React.ReactNode;
  footerContent: React.ReactNode;
}>;

function StudioDataTableWide<TData extends RowData>({
  table,
  ariaLabel,
  caption,
  isCompact,
}: Pick<StudioDataTableViewProps<TData>, 'table' | 'ariaLabel' | 'caption' | 'isCompact'>) {
  return (
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
  );
}

function StudioDataTableCompact<TData extends RowData>({
  table,
  ariaLabel,
  labels,
  selectionMode,
  isCompact,
  mobileSortingControls,
}: Pick<
  StudioDataTableViewProps<TData>,
  'table' | 'ariaLabel' | 'labels' | 'selectionMode' | 'isCompact' | 'mobileSortingControls'
>) {
  return (
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
  );
}

export function StudioDataTableView<TData extends RowData>({
  table,
  containerRef,
  hasRows,
  emptyState,
  ariaLabel,
  caption,
  labels,
  selectionMode,
  isCompact,
  selectedRowCount,
  toolbarContent,
  mobileSortingControls,
  footerContent,
}: StudioDataTableViewProps<TData>) {
  return (
    <div
      ref={hasRows ? containerRef : undefined}
      className={cn(
        'rounded-xl border border-border bg-card shadow-shell',
        hasRows && 'overflow-hidden'
      )}
      aria-busy={hasRows ? 'false' : undefined}
      data-selected-rows={hasRows ? selectedRowCount : undefined}
      data-layout={hasRows ? (isCompact ? 'compact' : 'wide') : undefined}
    >
      {toolbarContent}
      {hasRows ? (
        <>
          <StudioDataTableWide
            table={table}
            ariaLabel={ariaLabel}
            caption={caption}
            isCompact={isCompact}
          />
          <StudioDataTableCompact
            table={table}
            ariaLabel={ariaLabel}
            labels={labels}
            selectionMode={selectionMode}
            isCompact={isCompact}
            mobileSortingControls={mobileSortingControls}
          />
        </>
      ) : (
        <div className="p-6" role="status" aria-live="polite">
          {emptyState}
        </div>
      )}
      {footerContent}
    </div>
  );
}
