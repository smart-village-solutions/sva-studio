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
        <button type="button" onClick={() => (props.rowActions as (row: unknown) => React.ReactNode)((props.data as unknown[])[0])}>
          render-row-actions
        </button>
      </div>
    );
  },
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
    const onFractionsSortChange = vi.fn();
    const fraction = {
      id: 'fraction-1',
      name: 'Biotonne',
      description: 'Baseline-Fraktion für Seed-Daten',
      color: '#16A34A',
      containerSize: '120l',
      translations: {
        de: 'Biotonne',
        en: 'Organic waste',
      },
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
        onFractionsSortChange={onFractionsSortChange}
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
    render(<div>{rowActions(fraction)}</div>);

    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.actions.edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.actions.delete' }));

    expect(onOpenCreateFraction).toHaveBeenCalledTimes(0);
    expect(onOpenEditFraction).toHaveBeenCalledWith(fraction);
    expect(screen.getByText('masterData.fractions.deleteDialog.title')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.deleteDialog.confirm' }));
    expect(onOpenDeleteFraction).toHaveBeenCalledWith(fraction);
  });
});
