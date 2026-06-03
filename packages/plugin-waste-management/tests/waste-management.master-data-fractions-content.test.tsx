import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteMasterDataFractionsContent } from '../src/waste-management.master-data-fractions-content.js';

const dataTableMock = vi.hoisted(() => vi.fn());

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('|')}` : key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Select: (props: React.ComponentProps<'select'>) => <select {...props} />,
  Dialog: ({ open, children }: { readonly open?: boolean; readonly children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  StudioConfirmDialog: ({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
  }: {
    readonly open: boolean;
    readonly title: string;
    readonly description: string;
    readonly confirmLabel: string;
    readonly cancelLabel: string;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
  }) =>
    open ? (
      <div>
        <p>{title}</p>
        <p>{description}</p>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    ) : null,
  StudioDataTable: (props: Record<string, unknown>) => {
    dataTableMock(props);
    return (
      <div>
        {props.toolbarStart as React.ReactNode}
        {props.toolbarEnd as React.ReactNode}
        <button
          type="button"
          onClick={() =>
            (props.onSortingChange as (sorting: Array<{ id: string; desc: boolean }>) => void)([{ id: 'color', desc: true }])
          }
        >
          sort-color
        </button>
        <button
          type="button"
          onClick={() =>
            (props.onSortingChange as (sorting: Array<{ id: string; desc: boolean }>) => void)([
              { id: 'description', desc: false },
            ])
          }
        >
          sort-description
        </button>
        <button
          type="button"
          onClick={() =>
            (props.onSortingChange as (sorting: Array<{ id: string; desc: boolean }>) => void)([{ id: 'status', desc: true }])
          }
        >
          sort-status
        </button>
        <button type="button" onClick={() => (props.rowActions as (row: unknown) => React.ReactNode)((props.data as unknown[])[0])}>
          render-row-actions
        </button>
      </div>
    );
  },
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}));

vi.mock('../src/waste-management.tab-panel-actions.js', () => ({
  useWasteTabPanelActions: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

describe('WasteMasterDataFractionsContent', () => {
  it('maps fractions into a selectable sortable data table with icon actions and delete confirmation', () => {
    const onOpenCreateFraction = vi.fn();
    const onOpenEditFraction = vi.fn();
    const onOpenDeleteFraction = vi.fn();
    const onDeleteFractions = vi.fn();
    const onToggleFractionStatus = vi.fn();
    const onFractionsSortChange = vi.fn();
    const onFractionsStatusChange = vi.fn();
    const fraction = {
      id: 'fraction-1',
      name: 'Biotonne',
      description: 'Baseline-Fraktion für Seed-Daten',
      color: '#16A34A',
      containerSize: '120l',
      active: true,
    };

    render(
      <WasteMasterDataFractionsContent
        fractions={[fraction] as never}
        fractionsSortBy="name"
        fractionsSortDirection="asc"
        fractionsStatus="active"
        onOpenCreateFraction={onOpenCreateFraction}
        onOpenEditFraction={onOpenEditFraction}
        onOpenDeleteFraction={onOpenDeleteFraction}
        onDeleteFractions={onDeleteFractions}
        onToggleFractionStatus={onToggleFractionStatus}
        onFractionsSortChange={onFractionsSortChange}
        onFractionsStatusChange={onFractionsStatusChange}
        page={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const tableProps = dataTableMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(tableProps.ariaLabel).toBe('masterData.fractions.table.ariaLabel');
    expect(tableProps.selectionMode).toBe('multiple');
    expect(tableProps.toolbarStart).toBeTruthy();
    expect(tableProps.toolbarEnd).toBeTruthy();
    expect(tableProps.sorting).toEqual([{ id: 'nameWithContainerSize', desc: false }]);
    expect((tableProps.columns as Array<{ id: string; sortable?: boolean }>).map((column) => column.id)).toEqual([
      'nameWithContainerSize',
      'color',
      'description',
      'status',
    ]);
    expect((tableProps.columns as Array<{ id: string; sortable?: boolean }>).every((column) => column.sortable === true)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'sort-color' }));
    const updatedTableProps = dataTableMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(updatedTableProps.sorting).toEqual([{ id: 'color', desc: true }]);
    expect(onFractionsSortChange).toHaveBeenCalledWith('color', 'desc');

    const [nameColumn, colorColumn, descriptionColumn, statusColumn] = tableProps.columns as Array<{
      id: string;
      cell: (row: typeof fraction) => React.ReactNode;
    }>;
    expect(nameColumn.cell(fraction)).toBeTruthy();
    expect(colorColumn.cell(fraction)).toBeTruthy();
    expect(descriptionColumn.cell(fraction)).toBeTruthy();
    expect(statusColumn.cell(fraction)).toBeTruthy();

    const rowActions = tableProps.rowActions as (row: typeof fraction) => React.ReactNode;
    render(
      <div>
        {statusColumn.cell(fraction)}
        {rowActions(fraction)}
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.actions.edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.actions.delete' }));

    expect(onOpenCreateFraction).toHaveBeenCalledTimes(0);
    expect(onOpenEditFraction).toHaveBeenCalledWith(fraction);
    expect(screen.getByRole('button', { name: 'masterData.fractions.filters.reset' })).toBeTruthy();
    expect(screen.getByText('masterData.fractions.deleteDialog.title')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.deleteDialog.confirm' }));
    expect(onOpenDeleteFraction).toHaveBeenCalledWith(fraction);

    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.filters.reset' }));
    expect(onFractionsStatusChange).toHaveBeenCalledWith('all');

    fireEvent.click(
      screen.getByRole('switch', {
        name: 'masterData.fractions.actions.deactivateStatus:Biotonne',
      })
    );
    expect(screen.getByText('masterData.fractions.statusDialog.deactivateTitle')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.statusDialog.confirm' }));
    expect(onToggleFractionStatus).toHaveBeenCalledWith(fraction, false);

    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.filters.open' }));
    fireEvent.change(screen.getByLabelText('masterData.fractions.filters.statusLabel'), {
      target: { value: 'inactive' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.filters.apply' }));
    expect(onFractionsStatusChange).toHaveBeenCalledWith('inactive');

    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.actions.openCreate' }));
    expect(onOpenCreateFraction).toHaveBeenCalledTimes(1);
  });

  it('covers additional sort branches and closes the delete dialog on cancel', () => {
    const onToggleFractionStatus = vi.fn();
    const fractions = [
      {
        id: 'fraction-1',
        name: 'Biotonne',
        description: 'Bio',
        color: '#16A34A',
        containerSize: '240l',
        active: true,
      },
      {
        id: 'fraction-2',
        name: 'Papier',
        description: undefined,
        color: '#2563EB',
        containerSize: undefined,
        active: false,
      },
    ];

    render(
      <WasteMasterDataFractionsContent
        fractions={fractions as never}
        fractionsSortBy="containerSize"
        fractionsSortDirection="asc"
        fractionsStatus="all"
        onOpenCreateFraction={vi.fn()}
        onOpenEditFraction={vi.fn()}
        onOpenDeleteFraction={vi.fn()}
        onDeleteFractions={vi.fn()}
        onToggleFractionStatus={onToggleFractionStatus}
        onFractionsSortChange={vi.fn()}
        onFractionsStatusChange={vi.fn()}
        page={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    let tableProps = dataTableMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect((tableProps.data as Array<{ id: string }>).map((fraction) => fraction.id)).toEqual(['fraction-2', 'fraction-1']);

    fireEvent.click(screen.getByRole('button', { name: 'sort-description' }));
    tableProps = dataTableMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect((tableProps.data as Array<{ id: string }>).map((fraction) => fraction.id)).toEqual(['fraction-2', 'fraction-1']);

    fireEvent.click(screen.getByRole('button', { name: 'sort-status' }));
    tableProps = dataTableMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect((tableProps.data as Array<{ id: string }>).map((fraction) => fraction.id)).toEqual(['fraction-2', 'fraction-1']);
    expect(screen.queryByRole('button', { name: 'masterData.fractions.filters.reset' })).toBeNull();

    const [, , , statusColumn] = tableProps.columns as Array<{
      id: string;
      cell: (row: (typeof fractions)[number]) => React.ReactNode;
    }>;
    const rowActions = tableProps.rowActions as (row: (typeof fractions)[number]) => React.ReactNode;
    render(
      <div>
        {statusColumn.cell(fractions[1]!)}
        {rowActions(fractions[0]!)}
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.actions.delete' }));
    expect(screen.getByText('masterData.fractions.deleteDialog.title')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.deleteDialog.cancel' }));
    expect(screen.queryByText('masterData.fractions.deleteDialog.title')).toBeNull();

    fireEvent.click(
      screen.getByRole('switch', {
        name: 'masterData.fractions.actions.activateStatus:Papier',
      })
    );
    expect(screen.getByText('masterData.fractions.statusDialog.activateTitle')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.statusDialog.cancel' }));
    expect(screen.queryByText('masterData.fractions.statusDialog.activateTitle')).toBeNull();
    expect(onToggleFractionStatus).not.toHaveBeenCalled();
  });
});
