import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteToursDialogs } from '../src/waste-management.tours-dialogs-panel.js';
import { TourAssignmentsDialog } from '../src/waste-management.tours-assignments-dialog.js';
import { WasteToursFormView } from '../src/waste-management.tours-form-view.js';
import { WasteToursTableHeader } from '../src/waste-management.tours.table.parts.js';
import { WasteToursTourFields } from '../src/waste-management.tours-tour-fields.js';

const navigateMock = vi.fn();
const dialogSpy = vi.hoisted(() => ({
  tour: vi.fn(),
  assignments: vi.fn(),
  calendar: vi.fn(),
}));
const fractionSelectionSpy = vi.fn();
const customDatesSpy = vi.fn();
const formSwitchSpy = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, variables?: Record<string, string | number>) =>
    variables ? `${key}:${JSON.stringify(variables)}` : key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Badge: ({ children }: { readonly children: React.ReactNode }) => <span>{children}</span>,
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Checkbox: ({ indeterminate, ...props }: React.ComponentProps<'input'> & { readonly indeterminate?: boolean }) => {
    void indeterminate;
    return <input type="checkbox" {...props} />;
  },
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
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
  Select: (props: React.ComponentProps<'select'>) => <select {...props} />,
  StudioPageHeader: ({
    title,
    description,
    actions,
  }: {
    readonly title: React.ReactNode;
    readonly description: React.ReactNode;
    readonly actions?: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </div>
  ),
  StudioField: ({
    id,
    label,
    children,
  }: {
    readonly id: string;
    readonly label: React.ReactNode;
    readonly children: React.ReactNode;
  }) => (
    <label htmlFor={id}>
      <span>{label}</span>
      {children}
    </label>
  ),
  StudioFieldGroup: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  Textarea: (props: React.ComponentProps<'textarea'>) => <textarea {...props} />,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  StatusNotice: ({ message }: { readonly message: { text: string } | null }) => (message ? <div>{message.text}</div> : null),
}));

vi.mock('../src/waste-management.tours.dialogs.js', () => ({
  TourDialog: (props: Record<string, unknown>) => {
    dialogSpy.tour(props);
    return props.open ? <button onClick={() => (props.onOpenChange as (open: boolean) => void)(false)}>close-tour</button> : null;
  },
  TourAssignmentsDialog: (props: Record<string, unknown>) => {
    dialogSpy.assignments(props);
    return props.open ? <button onClick={() => (props.onOpenChange as (open: boolean) => void)(false)}>close-assignments</button> : null;
  },
  TourYearCalendarDialog: (props: Record<string, unknown>) => {
    dialogSpy.calendar(props);
    return props.open ? <div>calendar-open</div> : null;
  },
}));

vi.mock('../src/waste-management.tours.fractions.js', () => ({
  WasteToursFractionSelection: (props: Record<string, unknown>) => {
    fractionSelectionSpy(props);
    return (
      <button type="button" onClick={() => (props.onChange as (ids: string[]) => void)(['fraction-2'])}>
        change-fractions
      </button>
    );
  },
}));

vi.mock('../src/waste-management.tours-custom-dates.js', () => ({
  WasteToursCustomDatesField: (props: Record<string, unknown>) => {
    customDatesSpy(props);
    return (
      <button
        type="button"
        onClick={() => {
          (props.onChange as (dates: Array<{ date: string }>) => void)([{ date: '2026-08-22' }]);
          (props.onAssignmentsChange as (assignments: Array<{ id: string; pickupDate: string; locationId: string; note: string }>) => void)([
            { id: 'assignment-1', pickupDate: '2026-08-22', locationId: 'location-1', note: '08:00' },
          ]);
        }}
      >
        change-custom-dates
      </button>
    );
  },
}));

vi.mock('../src/waste-management.form-switch.js', () => ({
  WasteManagementFormSwitch: (props: { readonly checked: boolean; readonly ariaLabel: string; readonly onChange: (checked: boolean) => void }) => {
    formSwitchSpy(props);
    return (
      <button type="button" aria-label={props.ariaLabel} onClick={() => props.onChange(!props.checked)}>
        {String(props.checked)}
      </button>
    );
  },
}));

const createController = () =>
  ({
    dialogOpen: true,
    dialogMode: 'edit' as const,
    tourForm: {
      id: 'tour-1',
      name: 'Schadstoffmobil',
      description: '',
      wasteFractionIds: ['fraction-1'],
      recurrence: 'custom' as const,
      customRecurrenceId: '',
      firstDate: '',
      endDate: '',
      customDates: [],
      dateLocationAssignments: [],
      active: true,
    },
    availableFractions: [{ id: 'fraction-1', name: 'Restmüll' }],
    locationOptions: [{ id: 'location-1', label: 'Rathausplatz' }],
    customRecurrencePresets: [{ id: 'preset-1', label: 'Alle 10 Tage', intervalDays: 10 }],
    saving: false,
    message: { kind: 'info', text: 'tour-message' },
    setDialogOpen: vi.fn(),
    setTourForm: vi.fn(),
    setSelectedTour: vi.fn(),
    onSubmitTour: vi.fn(),
    assignmentsDialogOpen: true,
    assignmentsDialogMode: 'create' as const,
    linkForm: { id: 'link-1', tourId: 'tour-1' },
    overview: { tours: [{ id: 'tour-1', name: 'Schadstoffmobil' }] },
    assignmentLocationOptions: [],
    assignmentContextLoading: false,
    setAssignmentsDialogOpen: vi.fn(),
    setLinkForm: vi.fn(),
    onSubmitAssignments: vi.fn(),
    calendarOpen: true,
    schedulingOverview: { locationTourPickupDates: [] },
    setCalendarOpen: vi.fn(),
    resetTourForm: vi.fn(),
    setMessage: vi.fn(),
  }) as never;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('waste-management tours low coverage views', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    dialogSpy.tour.mockReset();
    dialogSpy.assignments.mockReset();
    dialogSpy.calendar.mockReset();
  });

  it('resets tour and assignment forms when the dialogs close', () => {
    const controller = createController();

    render(<WasteToursDialogs controller={controller} />);

    fireEvent.click(screen.getByRole('button', { name: 'close-tour' }));
    fireEvent.click(screen.getByRole('button', { name: 'close-assignments' }));

    expect(controller.setDialogOpen).toHaveBeenCalledWith(false);
    expect(controller.setTourForm).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String) }));
    expect(controller.setSelectedTour).toHaveBeenCalledWith(null);
    expect(controller.setAssignmentsDialogOpen).toHaveBeenCalledWith(false);
    expect(controller.setLinkForm).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        locationId: '',
        tourId: '',
        startDate: '',
        endDate: '',
      })
    );
    expect(dialogSpy.calendar).toHaveBeenCalledWith(expect.objectContaining({ open: true }));
  });

  it('bridges dialog patch handlers back into the controller state updaters', () => {
    const controller = createController();

    render(<WasteToursDialogs controller={controller} />);

    const tourProps = dialogSpy.tour.mock.calls[0]?.[0] as {
      onChange: (patch: Record<string, unknown>) => void;
    };
    const assignmentProps = dialogSpy.assignments.mock.calls[0]?.[0] as {
      onChange: (patch: Record<string, unknown>) => void;
    };

    tourProps.onChange({ name: 'Geaendert' });
    assignmentProps.onChange({ locationId: 'location-2' });

    const nextTourForm = controller.setTourForm.mock.calls[0]?.[0](controller.tourForm);
    const nextLinkForm = controller.setLinkForm.mock.calls[0]?.[0]({
      id: 'link-1',
      locationId: '',
      tourId: 'tour-1',
      startDate: '',
      endDate: '',
    });

    expect(nextTourForm).toEqual(expect.objectContaining({ name: 'Geaendert' }));
    expect(nextLinkForm).toEqual(expect.objectContaining({ locationId: 'location-2' }));
  });

  it('renders the form view with duplication metadata, cancels back to the list, and submits create mode', () => {
    const controller = createController();
    const search = {
      tab: 'tours' as const,
      masterDataTab: 'fractions' as const,
      fractionsView: 'list' as const,
      toursView: 'create' as const,
      locationsView: 'list' as const,
      schedulingView: 'list' as const,
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all' as const,
      shiftContext: 'all' as const,
      fractionsSortBy: 'name' as const,
      fractionsSortDirection: 'asc' as const,
      duplicateFromTourId: 'tour-1',
    };

    render(<WasteToursFormView controller={controller} search={search} />);

    expect(screen.getByText(/tours\.messages\.duplicateHint/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'tours.actions.cancel' })[0]!);
    expect(controller.setDialogOpen).toHaveBeenCalledWith(false);
    expect(controller.resetTourForm).toHaveBeenCalledTimes(1);
    expect(controller.setSelectedTour).toHaveBeenCalledWith(null);
    expect(controller.setMessage).toHaveBeenCalledWith(null);
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({ toursView: 'list', tourId: undefined, duplicateFromTourId: undefined }),
    });

    const form = document.getElementById('waste-tour-form');
    if (!form) {
      throw new Error('missing waste-tour-form');
    }
    fireEvent.submit(form);
    expect(controller.onSubmitTour).toHaveBeenCalledWith(expect.anything(), 'create', 'tour-1');
  });

  it('renders assignment dialog loading and fallback description branches', () => {
    render(
      <TourAssignmentsDialog
        open
        mode="edit"
        form={{ id: 'link-1', locationId: '', tourId: 'tour-1', startDate: '', endDate: '' } as never}
        tour={null}
        tours={[]}
        locations={[]}
        saving
        loading
        message={{ kind: 'info', text: 'assignment-message' }}
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('tours.assignments.dialog.descriptionFallback')).toBeTruthy();
    expect(screen.getByText('tours.table.loadingAssignments')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'tours.assignments.actions.saving' })).toHaveProperty('disabled', true);
  });

  it('filters assignment locations, tracks hidden selections, resets filters, and submits the selected ids', () => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const onOpenChange = vi.fn();

    render(
      <TourAssignmentsDialog
        open
        mode="create"
        form={{ id: 'link-1', locationId: '', tourId: 'tour-1', startDate: '', endDate: '' } as never}
        tour={{ id: 'tour-1', name: 'Schadstoffmobil' } as never}
        tours={[{ id: 'tour-1', name: 'Schadstoffmobil' } as never]}
        locations={[
          {
            id: 'location-1',
            label: 'Albertplatz',
            regionId: 'region-1',
            regionName: 'Prignitz',
            cityId: 'city-1',
            cityName: 'Perleberg',
            streetId: 'street-1',
            streetName: 'Ackerstrasse',
            active: true,
            assignedLinkId: 'link-old',
          },
          {
            id: 'location-2',
            label: 'Bahnhof',
            regionId: 'region-2',
            regionName: 'Ostprignitz',
            cityId: 'city-2',
            cityName: 'Wittenberge',
            streetId: 'street-2',
            streetName: 'Bahnweg',
            active: false,
          },
        ] as never}
        saving={false}
        message={null}
        onOpenChange={onOpenChange}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText('tours.assignments.workspace.selectedCount:{"value":1}')).toBeTruthy();
    expect(screen.getByText('tours.assignments.workspace.assigned')).toBeTruthy();
    expect(screen.getByText('filters.status.inactive')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('masterData.collectionLocations.fields.regionId'), {
      target: { value: 'region-2' },
    });
    expect(screen.getByText('tours.assignments.workspace.hiddenSelectedCount:{"value":1}')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('masterData.collectionLocations.fields.cityId'), {
      target: { value: 'city-2' },
    });
    fireEvent.change(screen.getByLabelText('masterData.collectionLocations.fields.streetId'), {
      target: { value: 'street-2' },
    });

    fireEvent.click(screen.getByLabelText('masterData.collectionLocations.bulk.actions.selectAllFiltered'));
    fireEvent.submit(screen.getByRole('button', { name: 'tours.assignments.actions.create' }).closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith(expect.anything(), ['location-1', 'location-2']);

    fireEvent.click(screen.getByRole('button', { name: 'tours.assignments.actions.resetFilters' }));
    expect(screen.getByText('tours.assignments.workspace.visibleCount:{"value":2}')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('filters.searchLabel'), {
      target: { value: 'kein treffer' },
    });
    expect(screen.getByText('tours.assignments.workspace.noLocations')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'tours.assignments.actions.cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders and updates weekly tour field branches for date ranges, fractions, and active state', () => {
    const onChange = vi.fn();

    render(
      <WasteToursTourFields
        form={{
          id: 'tour-1',
          name: 'Restmüll Nord',
          description: 'Beschreibung',
          wasteFractionIds: ['fraction-1'],
          recurrence: 'weekly',
          customRecurrenceId: '',
          firstDate: '',
          endDate: '',
          customDates: [],
          dateLocationAssignments: [],
          active: true,
        }}
        fractions={[{ id: 'fraction-1', name: 'Restmüll' } as never]}
        locations={[{ id: 'location-1', label: 'Rathausplatz' }]}
        customRecurrencePresets={[{ id: 'preset-1', label: 'Alle 10 Tage', intervalDays: 10 } as never]}
        pt={(key) => key}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText('tours.fields.name'), { target: { value: 'Bio Nord' } });
    fireEvent.click(screen.getByRole('button', { name: 'tours.fields.wasteFractions' }));
    fireEvent.change(screen.getByLabelText('tours.fields.description'), { target: { value: 'Neue Beschreibung' } });
    expect(screen.getByLabelText('tours.fields.firstDate')).toBeTruthy();
    expect(screen.getByLabelText('tours.fields.endDate')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('tours.fields.firstDate'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('tours.fields.endDate'), { target: { value: '2026-08-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'tours.fields.active' }));

    expect(onChange).toHaveBeenCalledWith({ name: 'Bio Nord' });
    expect(onChange).toHaveBeenCalledWith({ wasteFractionIds: ['fraction-2'] });
    expect(onChange).toHaveBeenCalledWith({ description: 'Neue Beschreibung' });
    expect(onChange).toHaveBeenCalledWith({ firstDate: '2026-08-01' });
    expect(onChange).toHaveBeenCalledWith({ endDate: '2026-08-31' });
    expect(onChange).toHaveBeenCalledWith({ active: false });
  });

  it('shows custom date controls for custom tours and forwards custom date assignment patches', () => {
    const onChange = vi.fn();

    render(
      <WasteToursTourFields
        form={{
          id: 'tour-2',
          name: 'Schadstoffmobil',
          description: '',
          wasteFractionIds: [],
          recurrence: 'custom',
          customRecurrenceId: '',
          firstDate: '',
          endDate: '',
          customDates: [],
          dateLocationAssignments: [],
          active: false,
        }}
        fractions={[]}
        locations={[{ id: 'location-1', label: 'Rathausplatz' }]}
        customRecurrencePresets={[]}
        pt={(key) => key}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'tours.fields.customDates' }));

    expect(customDatesSpy).toHaveBeenCalledWith(expect.objectContaining({ disabled: false }));
    expect(onChange).toHaveBeenCalledWith({ customDates: [{ date: '2026-08-22' }] });
    expect(onChange).toHaveBeenCalledWith({
      dateLocationAssignments: [{ id: 'assignment-1', pickupDate: '2026-08-22', locationId: 'location-1', note: '08:00' }],
    });
  });

  it('filters assignment locations, manages hidden selections, and submits the selected ids', () => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());

    render(
      <TourAssignmentsDialog
        open
        mode="edit"
        form={{ id: 'link-1', tourId: 'tour-1' } as never}
        tour={{ id: 'tour-1', name: 'Schadstoffmobil' } as never}
        tours={[]}
        locations={[
          {
            id: 'location-1',
            label: 'Rathausplatz',
            regionId: 'region-1',
            regionName: 'Prignitz',
            cityId: 'city-1',
            cityName: 'Perleberg',
            streetId: 'street-1',
            streetName: 'Mitte',
            assignedLinkId: 'link-1',
            active: true,
          },
          {
            id: 'location-2',
            label: 'Schulhof',
            regionId: 'region-2',
            regionName: 'Ostprignitz',
            cityId: 'city-2',
            cityName: 'Wittenberge',
            streetId: 'street-2',
            streetName: 'Nord',
            assignedLinkId: undefined,
            active: false,
          },
        ] as never}
        saving={false}
        loading={false}
        message={{ kind: 'info', text: 'assignment-message' }}
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText('assignment-message')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('filters.searchLabel'), { target: { value: 'Schul' } });
    expect(screen.getByText('tours.assignments.workspace.hiddenSelectedCount:{"value":1}')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('masterData.collectionLocations.bulk.actions.selectAllFiltered'));
    fireEvent.click(screen.getByRole('button', { name: 'tours.assignments.actions.resetFilters' }));

    const form = screen.getByRole('button', { name: 'tours.assignments.actions.save' }).closest('form');
    if (!form) {
      throw new Error('missing assignments form');
    }
    fireEvent.submit(form);

    expect(onSubmit).toHaveBeenCalledWith(expect.anything(), ['location-1', 'location-2']);
    expect(screen.getByText('filters.status.inactive')).toBeTruthy();
    expect(screen.getByText('tours.assignments.workspace.assigned')).toBeTruthy();
  });

  it('renders the tours table header controls and forwards select-all plus sort interactions', () => {
    const onToggleSelectAllVisible = vi.fn();
    const onSortChange = vi.fn();

    render(
      <table>
        <WasteToursTableHeader
          allVisibleSelected={false}
          someVisibleSelected
          onToggleSelectAllVisible={onToggleSelectAllVisible}
          sortField="status"
          sortDirection="desc"
          onSortChange={onSortChange}
        />
      </table>
    );

    fireEvent.click(screen.getByLabelText('tours.table.selectAll'));
    fireEvent.click(screen.getByRole('button', { name: /tours.table.name/ }));
    fireEvent.click(screen.getByRole('button', { name: /tours.table.recurrence/ }));
    fireEvent.click(screen.getByRole('button', { name: /tours.table.dateRange/ }));
    fireEvent.click(screen.getByRole('button', { name: /tours.table.locations/ }));
    fireEvent.click(screen.getByRole('button', { name: /tours.table.status/ }));

    expect(onToggleSelectAllVisible).toHaveBeenCalledWith(true);
    expect(onSortChange).toHaveBeenCalledWith('name');
    expect(onSortChange).toHaveBeenCalledWith('recurrence');
    expect(onSortChange).toHaveBeenCalledWith('dateRange');
    expect(onSortChange).toHaveBeenCalledWith('locations');
    expect(onSortChange).toHaveBeenCalledWith('status');
    expect(screen.getByText('desc')).toBeTruthy();
  });
});
