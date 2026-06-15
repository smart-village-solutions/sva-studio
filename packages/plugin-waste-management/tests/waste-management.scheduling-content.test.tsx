import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteSchedulingContent, WasteSchedulingEmptyState } from '../src/waste-management.scheduling-content.js';

const shiftsTableMock = vi.hoisted(() => vi.fn());

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  StatusNotice: ({ message }: { readonly message: { text: string } | null }) => (message ? <div>{message.text}</div> : null),
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Dialog: ({
    open,
    children,
  }: {
    readonly open: boolean;
    readonly children: React.ReactNode;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { readonly children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { readonly children: React.ReactNode }) => <h2>{children}</h2>,
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
  Select: (props: React.ComponentProps<'select'>) => <select {...props} />,
  StudioEmptyState: ({ children }: { readonly children: React.ReactNode }) => <div data-testid="empty-state">{children}</div>,
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
        <h2>{title}</h2>
        <p>{description}</p>
        <button onClick={onConfirm}>{confirmLabel}</button>
        <button onClick={onCancel}>{cancelLabel}</button>
      </div>
    ) : null,
  StudioField: ({
    id,
    label,
    children,
  }: {
    readonly id: string;
    readonly label: string;
    readonly children: React.ReactNode;
  }) => (
    <label htmlFor={id}>
      {label}
      {children}
    </label>
  ),
  StudioFieldGroup: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  Textarea: (props: React.ComponentProps<'textarea'>) => <textarea {...props} />,
}));

vi.mock('../src/waste-management.scheduling-shifts-table.js', () => ({
  WasteSchedulingShiftsTable: (props: Record<string, unknown>) => {
    shiftsTableMock(props);
    return <div data-testid="shifts-table" />;
  },
}));

vi.mock('../src/waste-management.tab-panel-actions.js', () => ({
  useWasteTabPanelActions: vi.fn(),
}));

afterEach(() => {
  cleanup();
  shiftsTableMock.mockReset();
});

describe('WasteSchedulingContent', () => {
  it('passes the scheduling state into the combined shifts table', () => {
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
    const onDeleteSchedulingRows = vi.fn(async () => undefined);
    const holidayRule = {
      id: 'holiday-rule-1',
      holidayDate: '2026-01-01',
      holidayName: 'Neujahr',
      year: 2026,
      stateCode: 'NW',
      sourceStatus: 'confirmed',
      configurationStatus: 'draft',
      conflictStatus: 'none',
      createdAt: '2026-05-10T10:00:00.000Z',
      updatedAt: '2026-05-10T10:00:00.000Z',
    };

    render(
      <WasteSchedulingContent
        message={{ tone: 'info', text: 'shift message' } as never}
        schedulingEntries={[
          {
            id: 'holiday-rule-1',
            entryType: 'holiday-rule',
            kind: 'holiday',
            originalDate: '2026-01-01',
            actualDate: undefined,
            contextLabel: 'Neujahr',
            sortLabel: 'Neujahr',
            canDelete: true,
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
        schadstoffmobilTour={null}
        schadstoffmobilAssignments={[]}
        schadstoffmobilLocationOptions={[]}
        onOpenCreateShiftDialog={vi.fn()}
        onEditHolidayRule={vi.fn()}
        onEditGlobalShiftDialog={vi.fn()}
        onEditTourShiftDialog={vi.fn()}
        onDeleteSchedulingRows={onDeleteSchedulingRows}
        onSaveLocationTourPickupDate={vi.fn(async () => undefined)}
        onDeleteLocationTourPickupDate={vi.fn(async () => undefined)}
        saving={false}
        page={2}
        pageSize={25}
        onPageChange={vi.fn()}
        onSyncPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByText('shift message')).toBeTruthy();
    expect(screen.getByTestId('shifts-table')).toBeTruthy();
    expect(shiftsTableMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        entries: [
          expect.objectContaining({ kind: 'holiday', id: 'holiday-rule-1' }),
          expect.objectContaining({ kind: 'global', id: 'global-1' }),
          expect.objectContaining({ kind: 'tour', id: 'tour-shift-1' }),
        ],
        onDeleteSchedulingRows,
        page: 2,
        pageSize: 25,
      })
    );
  });

  it('renders the unified create action in the empty state', () => {
    const onOpenCreateShiftDialog = vi.fn();

    render(<WasteSchedulingEmptyState onOpenCreateShiftDialog={onOpenCreateShiftDialog} />);

    expect(screen.getByTestId('empty-state')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'scheduling.actions.openCreate' }));
    expect(onOpenCreateShiftDialog).toHaveBeenCalledTimes(1);
  });

  it('renders schadstoffmobil assignments and saves edited free text notes', async () => {
    const onSaveLocationTourPickupDate = vi.fn(async () => undefined);

    render(
      <WasteSchedulingContent
        message={null}
        schedulingEntries={[]}
        schadstoffmobilTour={{ id: 'tour-sm', name: 'Schadstoffmobil' } as never}
        schadstoffmobilAssignments={[
          {
            id: 'pickup-1',
            tourId: 'tour-sm',
            locationId: 'location-1',
            pickupDate: '2026-07-01',
            note: 'Dienstag 14:00-16:30 Uhr, Parkplatz am Rathaus',
          },
        ] as never}
        schadstoffmobilLocationOptions={[
          { id: 'location-1', label: 'Musterhausen / Mitte / Rathausplatz / alle Hausnummern' },
          { id: 'location-2', label: 'Musterhausen / Nord / Schulhof / alle Hausnummern' },
        ]}
        onOpenCreateShiftDialog={vi.fn()}
        onEditHolidayRule={vi.fn()}
        onEditGlobalShiftDialog={vi.fn()}
        onEditTourShiftDialog={vi.fn()}
        onDeleteSchedulingRows={vi.fn(async () => undefined)}
        onSaveLocationTourPickupDate={onSaveLocationTourPickupDate}
        onDeleteLocationTourPickupDate={vi.fn(async () => undefined)}
        saving={false}
        page={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onSyncPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByText('2026-07-01')).toBeTruthy();
    expect(screen.getByText('Musterhausen / Mitte / Rathausplatz / alle Hausnummern')).toBeTruthy();
    expect(screen.getByText('Dienstag 14:00-16:30 Uhr, Parkplatz am Rathaus')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'scheduling.schadstoffmobil.actions.edit' }));
    fireEvent.change(screen.getByLabelText('scheduling.schadstoffmobil.fields.note'), {
      target: { value: 'Mittwoch 10:00-12:00 Uhr, Parkplatz am Rathaus' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'scheduling.schadstoffmobil.actions.save' }));

    expect(onSaveLocationTourPickupDate).toHaveBeenCalledWith(
      {
        id: 'pickup-1',
        locationId: 'location-1',
        tourId: 'tour-sm',
        pickupDate: '2026-07-01',
        note: 'Mittwoch 10:00-12:00 Uhr, Parkplatz am Rathaus',
      },
      'edit'
    );
  });

  it('blocks empty schadstoffmobil notes and confirms deletion', async () => {
    const onDeleteLocationTourPickupDate = vi.fn(async () => undefined);
    const onSaveLocationTourPickupDate = vi.fn(async () => undefined);

    render(
      <WasteSchedulingContent
        message={null}
        schedulingEntries={[]}
        schadstoffmobilTour={{ id: 'tour-sm', name: 'Schadstoffmobil' } as never}
        schadstoffmobilAssignments={[
          {
            id: 'pickup-1',
            tourId: 'tour-sm',
            locationId: 'location-1',
            pickupDate: '2026-07-01',
            note: 'Dienstag 14:00-16:30 Uhr, Parkplatz am Rathaus',
          },
        ] as never}
        schadstoffmobilLocationOptions={[
          { id: 'location-1', label: 'Musterhausen / Mitte / Rathausplatz / alle Hausnummern' },
        ]}
        onOpenCreateShiftDialog={vi.fn()}
        onEditHolidayRule={vi.fn()}
        onEditGlobalShiftDialog={vi.fn()}
        onEditTourShiftDialog={vi.fn()}
        onDeleteSchedulingRows={vi.fn(async () => undefined)}
        onSaveLocationTourPickupDate={onSaveLocationTourPickupDate}
        onDeleteLocationTourPickupDate={onDeleteLocationTourPickupDate}
        saving={false}
        page={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onSyncPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'scheduling.schadstoffmobil.actions.openCreate' }));
    fireEvent.change(screen.getByLabelText('scheduling.schadstoffmobil.fields.pickupDate'), {
      target: { value: '2026-07-02' },
    });
    fireEvent.change(screen.getByLabelText('scheduling.schadstoffmobil.fields.location'), {
      target: { value: 'location-1' },
    });
    fireEvent.change(screen.getByLabelText('scheduling.schadstoffmobil.fields.note'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'scheduling.schadstoffmobil.actions.create' }));

    expect(screen.getByText('scheduling.schadstoffmobil.validation.noteRequired')).toBeTruthy();
    expect(onSaveLocationTourPickupDate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'scheduling.schadstoffmobil.actions.delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'scheduling.schadstoffmobil.actions.confirmDelete' }));

    expect(onDeleteLocationTourPickupDate).toHaveBeenCalledWith('pickup-1');
  });

  it('creates schadstoffmobil assignments with trimmed notes and resets the dialog form after closing', async () => {
    const onSaveLocationTourPickupDate = vi.fn(async () => undefined);

    render(
      <WasteSchedulingContent
        message={null}
        schedulingEntries={[]}
        schadstoffmobilTour={{ id: 'tour-sm', name: 'Schadstoffmobil' } as never}
        schadstoffmobilAssignments={[]}
        schadstoffmobilLocationOptions={[{ id: 'location-1', label: 'Musterhausen / Mitte / Rathausplatz' }]}
        onOpenCreateShiftDialog={vi.fn()}
        onEditHolidayRule={vi.fn()}
        onEditGlobalShiftDialog={vi.fn()}
        onEditTourShiftDialog={vi.fn()}
        onDeleteSchedulingRows={vi.fn(async () => undefined)}
        onSaveLocationTourPickupDate={onSaveLocationTourPickupDate}
        onDeleteLocationTourPickupDate={vi.fn(async () => undefined)}
        saving={false}
        page={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onSyncPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'scheduling.schadstoffmobil.actions.openCreate' }));
    fireEvent.change(screen.getByLabelText('scheduling.schadstoffmobil.fields.pickupDate'), {
      target: { value: '2026-07-03' },
    });
    fireEvent.change(screen.getByLabelText('scheduling.schadstoffmobil.fields.location'), {
      target: { value: 'location-1' },
    });
    fireEvent.change(screen.getByLabelText('scheduling.schadstoffmobil.fields.note'), {
      target: { value: '  Freitag 09:00-11:00 Uhr  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'scheduling.schadstoffmobil.actions.create' }));

    expect(onSaveLocationTourPickupDate).toHaveBeenCalledWith(
      {
        id: expect.any(String),
        locationId: 'location-1',
        tourId: 'tour-sm',
        pickupDate: '2026-07-03',
        note: 'Freitag 09:00-11:00 Uhr',
      },
      'create'
    );

    fireEvent.click(screen.getByRole('button', { name: 'scheduling.schadstoffmobil.actions.openCreate' }));
    expect((screen.getByLabelText('scheduling.schadstoffmobil.fields.pickupDate') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('scheduling.schadstoffmobil.fields.location') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('scheduling.schadstoffmobil.fields.note') as HTMLTextAreaElement).value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'scheduling.schadstoffmobil.actions.cancel' }));
    expect(screen.queryByRole('button', { name: 'scheduling.schadstoffmobil.actions.create' })).toBeNull();
  });
});
