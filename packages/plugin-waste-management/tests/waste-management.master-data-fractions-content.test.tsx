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
        onOpenCreateFraction={onOpenCreateFraction}
        onOpenEditFraction={onOpenEditFraction}
        onOpenDeleteFraction={onOpenDeleteFraction}
        onDeleteFractions={onDeleteFractions}
        onToggleFractionStatus={onToggleFractionStatus}
        onFractionsSortChange={onFractionsSortChange}
        page={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const tableProps = dataTableMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(tableProps.ariaLabel).toBe('masterData.fractions.table.ariaLabel');
    expect(tableProps.selectionMode).toBe('multiple');
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
    expect(onFractionsSortChange).not.toHaveBeenCalled();

    const [nameColumn, colorColumn, descriptionColumn, statusColumn] = tableProps.columns as Array<{
      id: string;
      cell: (row: typeof fraction) => React.ReactNode;
    }>;
    expect(nameColumn.cell(fraction)).toBeTruthy();
    expect(colorColumn.cell(fraction)).toBeTruthy();
    expect(descriptionColumn.cell(fraction)).toBeTruthy();
    expect(statusColumn.cell(fraction)).toBeTruthy();

    const rowActions = tableProps.rowActions as (row: typeof fraction) => React.ReactNode;
    render(<div>{rowActions(fraction)}</div>);

    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.actions.edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.actions.delete' }));

    expect(onOpenCreateFraction).toHaveBeenCalledTimes(0);
    expect(onOpenEditFraction).toHaveBeenCalledWith(fraction);
    expect(screen.getByText('masterData.fractions.deleteDialog.title')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.deleteDialog.confirm' }));
    expect(onOpenDeleteFraction).toHaveBeenCalledWith(fraction);
  });

  it('covers additional sort branches and closes the delete dialog on cancel', () => {
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
        onOpenCreateFraction={vi.fn()}
        onOpenEditFraction={vi.fn()}
        onOpenDeleteFraction={vi.fn()}
        onDeleteFractions={vi.fn()}
        onToggleFractionStatus={vi.fn()}
        onFractionsSortChange={vi.fn()}
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

    const rowActions = tableProps.rowActions as (row: (typeof fractions)[number]) => React.ReactNode;
    render(<div>{rowActions(fractions[0]!)}</div>);
    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.actions.delete' }));
    expect(screen.getByText('masterData.fractions.deleteDialog.title')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.deleteDialog.cancel' }));
    expect(screen.queryByText('masterData.fractions.deleteDialog.title')).toBeNull();
  });
});
