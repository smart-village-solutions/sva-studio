import React from 'react';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteSchadstoffmobilAssignmentDialog } from '../src/waste-management.scheduling-schadstoffmobil-dialog.js';
import { WasteSchadstoffmobilAssignmentsList } from '../src/waste-management.scheduling-schadstoffmobil-list.js';
import { useWasteSchedulingViewModel } from '../src/use-waste-scheduling-view-model.js';

const apiMocks = vi.hoisted(() => ({
  getWasteManagementSchedulingOverview: vi.fn(),
  getWasteManagementToursOverview: vi.fn(),
  getWasteManagementMasterDataOverview: vi.fn(),
}));
const useWasteSchedulingStateMock = vi.hoisted(() => vi.fn());
const useWasteSchedulingOverviewMock = vi.hoisted(() => vi.fn());
const schedulingActionsMock = vi.hoisted(() => vi.fn(() => ({ openCreate: vi.fn() })));
const schedulingMutationsMock = vi.hoisted(() => vi.fn(() => ({ saveRow: vi.fn() })));
const schedulingTableEntriesMock = vi.hoisted(() => vi.fn(() => [{ id: 'row-1' }]));
const filterSchedulingTableEntriesMock = vi.hoisted(() => vi.fn((entries: unknown) => entries));
const assignmentFormSpy = vi.fn();

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Dialog: ({
    open,
    children,
  }: {
    readonly open: boolean;
    readonly children: React.ReactNode;
    readonly onOpenChange?: (open: boolean) => void;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  Checkbox: ({ indeterminate, ...props }: React.ComponentProps<'input'> & { readonly indeterminate?: boolean }) => {
    void indeterminate;
    return <input type="checkbox" {...props} />;
  },
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
    readonly title: React.ReactNode;
    readonly description: React.ReactNode;
    readonly confirmLabel: React.ReactNode;
    readonly cancelLabel: React.ReactNode;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
  }) =>
    open ? (
      <div>
        <div>{title}</div>
        <div>{description}</div>
        <button type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  StatusNotice: ({ message }: { readonly message: { text: string } | null }) => (message ? <div>{message.text}</div> : null),
  resolveApiErrorCode: (error: unknown) => (error instanceof Error ? error.message : null),
}));

vi.mock('../src/waste-management.api.js', () => apiMocks);

vi.mock('../src/waste-management.scheduling-schadstoffmobil-form.js', () => ({
  WasteSchadstoffmobilAssignmentForm: (props: Record<string, unknown>) => {
    assignmentFormSpy(props);
    return (
      <button type="button" onClick={() => (props.onChange as (patch: Record<string, unknown>) => void)({ note: 'Aktualisiert' })}>
        edit-schadstoff-form
      </button>
    );
  },
}));

vi.mock('../src/use-waste-scheduling-state.js', () => ({
  useWasteSchedulingState: () => useWasteSchedulingStateMock(),
}));

vi.mock('../src/use-waste-scheduling-overview.js', () => ({
  useWasteSchedulingOverview: (...args: unknown[]) => useWasteSchedulingOverviewMock(...args),
}));

vi.mock('../src/waste-management.scheduling.actions.js', () => ({
  createWasteSchedulingActions: (...args: unknown[]) => schedulingActionsMock(...args),
}));

vi.mock('../src/waste-management.scheduling-mutations.js', () => ({
  createWasteSchedulingMutationHandlers: (...args: unknown[]) => schedulingMutationsMock(...args),
}));

vi.mock('../src/waste-management.scheduling.shared.js', () => ({
  createSchedulingTableEntries: (...args: unknown[]) => schedulingTableEntriesMock(...args),
  filterSchedulingTableEntries: (...args: unknown[]) => filterSchedulingTableEntriesMock(...args),
}));

vi.mock('../src/waste-management.tours.locations.js', () => ({
  formatCollectionLocationLabel: (_pt: unknown, _overview: unknown, location: { id: string; name?: string }) => location.name ?? location.id,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('waste-management scheduling low coverage views', () => {
  beforeEach(() => {
    apiMocks.getWasteManagementSchedulingOverview.mockReset();
    apiMocks.getWasteManagementToursOverview.mockReset();
    apiMocks.getWasteManagementMasterDataOverview.mockReset();
  });

  it('renders create and edit schadstoffmobil dialog copy, forwards form changes, and closes on cancel', () => {
    const onOpenChange = vi.fn();
    const onChange = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());

    const { rerender } = render(
      <WasteSchadstoffmobilAssignmentDialog
        open
        mode="create"
        form={{ id: 'pickup-1', pickupDate: '2026-07-01', locationId: 'location-1', note: 'Dienstag' }}
        locationOptions={[{ id: 'location-1', label: 'Rathausplatz' }]}
        saving={false}
        message={{ kind: 'info', text: 'dialog-message' }}
        validationMessage="validation-error"
        onOpenChange={onOpenChange}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText('scheduling.schadstoffmobil.dialog.createTitle')).toBeTruthy();
    expect(screen.getByText('dialog-message')).toBeTruthy();
    expect(screen.getByText('validation-error')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'edit-schadstoff-form' }));
    fireEvent.click(screen.getByRole('button', { name: 'scheduling.schadstoffmobil.actions.cancel' }));
    const form = screen.getByRole('button', { name: 'scheduling.schadstoffmobil.actions.create' }).closest('form');
    if (!form) {
      throw new Error('missing schadstoffmobil form');
    }
    fireEvent.submit(form);

    expect(onChange).toHaveBeenCalledWith({ note: 'Aktualisiert' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    rerender(
      <WasteSchadstoffmobilAssignmentDialog
        open
        mode="edit"
        form={{ id: 'pickup-1', pickupDate: '2026-07-01', locationId: 'location-1', note: 'Dienstag' }}
        locationOptions={[{ id: 'location-1', label: 'Rathausplatz' }]}
        saving
        message={null}
        validationMessage={null}
        onOpenChange={onOpenChange}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText('scheduling.schadstoffmobil.dialog.editTitle')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'scheduling.schadstoffmobil.actions.save' })).toHaveProperty('disabled', true);
  });

  it('sorts schadstoffmobil list rows, opens create/edit flows, and confirms deletion', async () => {
    const onCreate = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn(async () => undefined);

    render(
      <WasteSchadstoffmobilAssignmentsList
        entries={[
          { id: 'pickup-2', pickupDate: '2026-07-01', locationId: 'location-2', note: 'B' },
          { id: 'pickup-1', pickupDate: '2026-07-01', locationId: 'location-1', note: 'A' },
        ] as never}
        locationLabels={new Map([
          ['location-1', 'Albertplatz'],
          ['location-2', 'Ziegelhof'],
        ])}
        onCreate={onCreate}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    const rows = screen.getAllByRole('row');
    expect(rows[1]?.textContent).toContain('Albertplatz');
    fireEvent.click(screen.getByRole('button', { name: 'scheduling.schadstoffmobil.actions.openCreate' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'scheduling.schadstoffmobil.actions.edit' })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'scheduling.schadstoffmobil.actions.delete' })[0]!);

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'pickup-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'scheduling.schadstoffmobil.actions.confirmDelete' }));
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'pickup-1' }));
    });
  });

  it('sorts schadstoffmobil rows by pickup date first and closes the delete dialog through cancel', () => {
    const onDelete = vi.fn(async () => undefined);

    render(
      <WasteSchadstoffmobilAssignmentsList
        entries={[
          { id: 'pickup-early', pickupDate: '2026-06-01', locationId: 'location-2', note: 'B' },
          { id: 'pickup-late', pickupDate: '2026-07-01', locationId: 'location-1', note: 'A' },
        ] as never}
        locationLabels={new Map([['location-1', 'Albertplatz']])}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />
    );

    const rows = screen.getAllByRole('row');
    expect(rows[1]?.textContent).toContain('2026-06-01');
    expect(rows[1]?.textContent).toContain('location-2');

    fireEvent.click(screen.getAllByRole('button', { name: 'scheduling.schadstoffmobil.actions.delete' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'scheduling.schadstoffmobil.actions.cancel' }));

    expect(onDelete).not.toHaveBeenCalled();
  });

  it('shows the empty schadstoffmobil list state', () => {
    render(
      <WasteSchadstoffmobilAssignmentsList
        entries={[]}
        locationLabels={new Map()}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn(async () => undefined)}
      />
    );

    expect(screen.getByText('scheduling.schadstoffmobil.empty')).toBeTruthy();
  });

  it('loads scheduling overview plus background tours and locations successfully', async () => {
    const { useWasteSchedulingOverview: actualUseWasteSchedulingOverview } =
      await vi.importActual<typeof import('../src/use-waste-scheduling-overview.js')>(
        '../src/use-waste-scheduling-overview.js'
      );
    apiMocks.getWasteManagementSchedulingOverview.mockResolvedValue({ holidayRules: [], globalDateShifts: [], tourDateShifts: [] });
    apiMocks.getWasteManagementToursOverview.mockResolvedValue({ tours: [{ id: 'tour-1', name: 'Tour 1' }] });
    apiMocks.getWasteManagementMasterDataOverview.mockResolvedValue({ collectionLocations: [{ id: 'location-1', name: 'Rathausplatz' }] });

    const state = {
      setAvailableTours: vi.fn(),
      setError: vi.fn(),
      setLoading: vi.fn(),
      setLocationOverview: vi.fn(),
      setOverview: vi.fn(),
    } as never;

    renderHook(() => actualUseWasteSchedulingOverview(state, (key) => key));

    await waitFor(() => {
      expect(state.setOverview).toHaveBeenCalledWith({ holidayRules: [], globalDateShifts: [], tourDateShifts: [] });
    });
    await waitFor(() => {
      expect(state.setAvailableTours).toHaveBeenCalledWith([{ id: 'tour-1', name: 'Tour 1' }]);
      expect(state.setLocationOverview).toHaveBeenCalledWith({ collectionLocations: [{ id: 'location-1', name: 'Rathausplatz' }] });
    });
  });

  it('maps scheduling overview failures to translated errors and clears dependent state', async () => {
    const { useWasteSchedulingOverview: actualUseWasteSchedulingOverview } =
      await vi.importActual<typeof import('../src/use-waste-scheduling-overview.js')>(
        '../src/use-waste-scheduling-overview.js'
      );
    apiMocks.getWasteManagementSchedulingOverview.mockRejectedValue(new Error('forbidden'));

    const state = {
      setAvailableTours: vi.fn(),
      setError: vi.fn(),
      setLoading: vi.fn(),
      setLocationOverview: vi.fn(),
      setOverview: vi.fn(),
    } as never;

    renderHook(() => actualUseWasteSchedulingOverview(state, (key) => key));

    await waitFor(() => {
      expect(state.setError).toHaveBeenCalledWith('scheduling.messages.loadForbidden');
      expect(state.setAvailableTours).toHaveBeenCalledWith([]);
      expect(state.setLocationOverview).toHaveBeenCalledWith(null);
      expect(state.setLoading).toHaveBeenLastCalledWith(false);
    });
  });

  it('falls back to empty tours and locations when the background Promise.allSettled step itself fails', async () => {
    const { useWasteSchedulingOverview: actualUseWasteSchedulingOverview } =
      await vi.importActual<typeof import('../src/use-waste-scheduling-overview.js')>(
        '../src/use-waste-scheduling-overview.js'
      );
    apiMocks.getWasteManagementSchedulingOverview.mockResolvedValue({ holidayRules: [], globalDateShifts: [], tourDateShifts: [] });
    const allSettledSpy = vi.spyOn(Promise, 'allSettled').mockRejectedValueOnce(new Error('boom'));

    const state = {
      setAvailableTours: vi.fn(),
      setError: vi.fn(),
      setLoading: vi.fn(),
      setLocationOverview: vi.fn(),
      setOverview: vi.fn(),
    } as never;

    renderHook(() => actualUseWasteSchedulingOverview(state, (key) => key));

    await waitFor(() => {
      expect(state.setOverview).toHaveBeenCalledWith({ holidayRules: [], globalDateShifts: [], tourDateShifts: [] });
      expect(state.setAvailableTours).toHaveBeenCalledWith([]);
      expect(state.setLocationOverview).toHaveBeenCalledWith(null);
    });

    allSettledSpy.mockRestore();
  });

  it('builds scheduling view model data for schadstoffmobil tour assignments and sorted location labels', () => {
    const state = {
      overview: {
        holidayRules: [],
        globalDateShifts: [],
        tourDateShifts: [],
        locationTourPickupDates: [
          { id: 'pickup-1', tourId: 'tour-1', locationId: 'location-1', pickupDate: '2026-07-01', note: '08:00' },
          { id: 'pickup-2', tourId: 'tour-2', locationId: 'location-2', pickupDate: '2026-07-02', note: '09:00' },
        ],
      },
      availableTours: [
        { id: 'tour-1', name: 'Schadstoffmobil' },
        { id: 'tour-2', name: 'Restmüll' },
      ],
      locationOverview: {
        collectionLocations: [
          { id: 'location-2', name: 'Ziegelhof' },
          { id: 'location-1', name: 'Albertplatz' },
        ],
      },
    };
    useWasteSchedulingStateMock.mockReturnValue(state);
    useWasteSchedulingOverviewMock.mockReturnValue(vi.fn());

    const search = {
      tab: 'scheduling' as const,
      masterDataTab: 'fractions' as const,
      fractionsView: 'list' as const,
      toursView: 'list' as const,
      locationsView: 'list' as const,
      schedulingView: 'list' as const,
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all' as const,
      shiftContext: 'all' as const,
      fractionsSortBy: 'name' as const,
      fractionsSortDirection: 'asc' as const,
    };

    const { result } = renderHook(() => useWasteSchedulingViewModel((key) => key, search));

    expect(result.current.schadstoffmobilTour).toEqual({ id: 'tour-1', name: 'Schadstoffmobil' });
    expect(result.current.schadstoffmobilAssignments).toEqual([
      { id: 'pickup-1', tourId: 'tour-1', locationId: 'location-1', pickupDate: '2026-07-01', note: '08:00' },
    ]);
    expect(result.current.schadstoffmobilLocationOptions).toEqual([
      { id: 'location-1', label: 'Albertplatz' },
      { id: 'location-2', label: 'Ziegelhof' },
    ]);
    expect(schedulingTableEntriesMock).toHaveBeenCalled();
    expect(filterSchedulingTableEntriesMock).toHaveBeenCalledWith([{ id: 'row-1' }], search);
  });
});
