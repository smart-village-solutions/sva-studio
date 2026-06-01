import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteSchedulingShiftsTable } from '../src/waste-management.scheduling-shifts-table.js';

const dataTableMock = vi.hoisted(() => vi.fn());
const confirmDialogMock = vi.hoisted(() => vi.fn());

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('|')}` : key,
}));

vi.mock('@tabler/icons-react', () => ({
  IconEdit: (props: React.ComponentProps<'svg'>) => <svg {...props} />,
  IconTrash: (props: React.ComponentProps<'svg'>) => <svg {...props} />,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Badge: ({ children }: { readonly children: React.ReactNode }) => <span>{children}</span>,
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  StudioConfirmDialog: ({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    onCancel,
    onConfirm,
  }: {
    readonly open: boolean;
    readonly title: string;
    readonly description: string;
    readonly confirmLabel: string;
    readonly cancelLabel: string;
    readonly onCancel: () => void;
    readonly onConfirm: () => void;
  }) => {
    confirmDialogMock({ open, title, description, confirmLabel, cancelLabel });
    return open ? (
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
    ) : null;
  },
  StudioDataTable: (props: Record<string, unknown>) => {
    dataTableMock(props);

    return (
      <div>
        <p>{props.ariaLabel as string}</p>
        <p>{props.caption as string}</p>
        {props.toolbarEnd as React.ReactNode}
      </div>
    );
  },
}));

vi.mock('../src/waste-management.table-frame.js', () => ({
  createPagedItems: ({
    items,
    page,
    pageSize,
  }: {
    readonly items: readonly unknown[];
    readonly page: number;
    readonly pageSize: number;
  }) => ({
    items,
    safePage: page,
    pageCount: Math.max(1, Math.ceil(items.length / pageSize)),
    totalItems: items.length,
  }),
  usePagedRouteSync: vi.fn(),
  WastePanelTableBottomBar: () => <div data-testid="bottom-bar" />,
}));

afterEach(() => {
  cleanup();
  dataTableMock.mockReset();
  confirmDialogMock.mockReset();
});

describe('WasteSchedulingShiftsTable', () => {
  it('builds one combined scheduling table with sorted global and tour rows', () => {
    const onEditHolidayRule = vi.fn();
    const onEditGlobalShiftDialog = vi.fn();
    const onEditTourShiftDialog = vi.fn();
    const onOpenCreateShiftDialog = vi.fn();
    const onDeleteSchedulingRows = vi.fn(async () => undefined);
    const holidayRule = {
      id: 'holiday-rule-1',
      holidayDate: '2025-12-25',
      holidayName: 'Weihnachten',
      year: 2025,
      stateCode: 'BB',
      sourceStatus: 'confirmed',
      configurationStatus: 'draft',
      conflictStatus: 'none',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    };
    const globalShift = {
      id: 'global-1',
      originalDate: '2026-01-01',
      actualDate: '2026-01-02',
      description: 'Neujahr',
      hasYear: true,
      reasonType: 'holiday',
      reasonKey: 'holiday.new-year',
      tourIds: ['tour-1'],
    };
    const tourShift = {
      id: 'tour-shift-1',
      tourId: 'tour-1',
      originalDate: '2026-02-01',
      actualDate: '2026-02-03',
      description: 'Baustelle',
      hasYear: false,
      reasonType: 'operational-disruption',
      reasonKey: 'ops.roadwork',
      followUpMode: 'propagate-series',
    };

    render(
      <WasteSchedulingShiftsTable
        entries={[
          {
            id: 'holiday-rule-1',
            entryType: 'holiday-rule',
            kind: 'holiday',
            originalDate: '2025-12-25',
            actualDate: undefined,
            contextLabel: 'Weihnachten',
            sortLabel: 'Weihnachten',
            canDelete: false,
            rule: holidayRule,
          },
          {
            id: 'global-1',
            entryType: 'global-shift',
            kind: 'global',
            originalDate: '2026-01-01',
            actualDate: '2026-01-02',
            contextLabel: 'Restmüll Nord',
            sortLabel: 'Restmüll Nord',
            canDelete: true,
            shift: globalShift,
          },
          {
            id: 'tour-shift-1',
            entryType: 'tour-shift',
            kind: 'tour',
            originalDate: '2026-02-01',
            actualDate: '2026-02-03',
            contextLabel: 'Restmüll Nord',
            sortLabel: 'Restmüll Nord',
            canDelete: true,
            shift: tourShift,
          },
        ] as never}
        onOpenCreateShiftDialog={onOpenCreateShiftDialog}
        onEditHolidayRule={onEditHolidayRule}
        onEditGlobalShiftDialog={onEditGlobalShiftDialog}
        onEditTourShiftDialog={onEditTourShiftDialog}
        onDeleteSchedulingRows={onDeleteSchedulingRows}
        saving={false}
        page={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onSyncPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const tableProps = dataTableMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const data = tableProps.data as Array<{
      readonly kind: 'holiday' | 'global' | 'tour';
      readonly id: string;
      readonly contextLabel: string;
    }>;
    expect(tableProps.ariaLabel).toBe('scheduling.table.ariaLabel');
    expect(tableProps.caption).toBe('scheduling.table.caption');
    expect(data).toEqual([
      expect.objectContaining({ kind: 'holiday', id: 'holiday-rule-1', contextLabel: 'Weihnachten' }),
      expect.objectContaining({ kind: 'global', id: 'global-1', contextLabel: 'Restmüll Nord' }),
      expect.objectContaining({ kind: 'tour', id: 'tour-shift-1', contextLabel: 'Restmüll Nord' }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'scheduling.actions.openCreate' }));
    expect(onOpenCreateShiftDialog).toHaveBeenCalledTimes(1);

    const rowActions = tableProps.rowActions as (row: (typeof data)[number]) => React.ReactNode;
    render(<div>{rowActions(data[0]!)}</div>);
    fireEvent.click(screen.getByRole('button', { name: 'scheduling.holidayRules.editAction' }));
    expect(onEditHolidayRule).toHaveBeenCalledWith(holidayRule);

    cleanup();

    render(<div>{rowActions(data[1]!)}</div>);
    fireEvent.click(screen.getByRole('button', { name: 'scheduling.global.actions.edit' }));
    expect(onEditGlobalShiftDialog).toHaveBeenCalledWith(globalShift);

    cleanup();

    render(<div>{rowActions(data[2]!)}</div>);
    fireEvent.click(screen.getByRole('button', { name: 'scheduling.tour.actions.edit' }));
    expect(onEditTourShiftDialog).toHaveBeenCalledWith(tourShift);
  });

  it('renders the original date column in explicit German date format', () => {
    render(
      <WasteSchedulingShiftsTable
        entries={[
          {
            id: 'global-1',
            entryType: 'global-shift',
            kind: 'global',
            originalDate: '2026-01-01',
            actualDate: '2026-01-02',
            contextLabel: 'Alle Touren',
            sortLabel: 'Alle Touren',
            canDelete: true,
            shift: {
              id: 'global-1',
              originalDate: '2026-01-01',
              actualDate: '2026-01-02',
              description: 'Neujahr',
              hasYear: true,
              reasonType: 'holiday',
              reasonKey: 'holiday.new-year',
              tourIds: [],
            },
          },
        ] as never}
        onOpenCreateShiftDialog={vi.fn()}
        onEditHolidayRule={vi.fn()}
        onEditGlobalShiftDialog={vi.fn()}
        onEditTourShiftDialog={vi.fn()}
        onDeleteSchedulingRows={vi.fn(async () => undefined)}
        saving={false}
        page={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onSyncPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const tableProps = dataTableMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const columns = tableProps.columns as Array<{ id: string; cell: (row: Record<string, unknown>) => React.ReactNode }>;
    const originalDateColumn = columns.find((column) => column.id === 'originalDate');
    const row = (tableProps.data as Array<Record<string, unknown>>)[0];

    expect(originalDateColumn).toBeTruthy();
    render(<div>{originalDateColumn?.cell(row!)}</div>);

    expect(screen.getByText('01.01.2026')).toBeTruthy();
  });

  it('opens the delete confirmation and forwards the selected row', async () => {
    const onDeleteSchedulingRows = vi.fn(async () => undefined);

    render(
      <WasteSchedulingShiftsTable
        entries={[
          {
            id: 'global-1',
            entryType: 'global-shift',
            kind: 'global',
            originalDate: '2026-01-01',
            actualDate: '2026-01-02',
            contextLabel: 'Alle Touren',
            sortLabel: 'Alle Touren',
            canDelete: true,
            shift: {
              id: 'global-1',
              originalDate: '2026-01-01',
              actualDate: '2026-01-02',
              description: 'Neujahr',
              hasYear: true,
              reasonType: 'holiday',
              reasonKey: 'holiday.new-year',
              tourIds: [],
            },
          },
        ] as never}
        onOpenCreateShiftDialog={vi.fn()}
        onEditHolidayRule={vi.fn()}
        onEditGlobalShiftDialog={vi.fn()}
        onEditTourShiftDialog={vi.fn()}
        onDeleteSchedulingRows={onDeleteSchedulingRows}
        saving={false}
        page={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onSyncPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const tableProps = dataTableMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const data = tableProps.data as Array<Record<string, unknown>>;
    const rowActions = tableProps.rowActions as (row: (typeof data)[number]) => React.ReactNode;

    render(<div>{rowActions(data[0]!)}</div>);
    fireEvent.click(screen.getByRole('button', { name: 'scheduling.actions.delete' }));
    expect(screen.getByText('scheduling.bulkDeleteDialog.title')).toBeTruthy();
    expect(screen.getByText('scheduling.bulkDeleteDialog.description:1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'scheduling.bulkDeleteDialog.confirm' }));

    expect(onDeleteSchedulingRows).toHaveBeenCalledWith([
      expect.objectContaining({ kind: 'global', id: 'global-1' }),
    ]);
  });
});
