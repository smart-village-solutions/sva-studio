import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteToursDialogs } from '../src/waste-management.tours-dialogs-panel.js';
import { TourAssignmentsPage } from '../src/waste-management.tours-assignments-page.js';
import { TourAssignmentsTable } from '../src/waste-management.tours-assignments-table.js';
import { WasteToursFormView } from '../src/waste-management.tours-form-view.js';
import { WasteToursTableHeader } from '../src/waste-management.tours.table.parts.js';
import { WasteToursTourFields } from '../src/waste-management.tours-tour-fields.js';

const navigateMock = vi.fn();
const dialogSpy = vi.hoisted(() => ({
  tour: vi.fn(),
  calendar: vi.fn(),
}));
const fractionSelectionSpy = vi.fn();
const customDatesSpy = vi.fn();
const formSwitchSpy = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useBlocker: () => ({ status: 'idle' }),
  useNavigate: () => navigateMock,
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, variables?: Record<string, string | number>) =>
    variables ? `${key}:${JSON.stringify(variables)}` : key,
}));

vi.mock('@sva/studio-ui-react', async () => ({
  ...(await vi.importActual<typeof import('@sva/studio-ui-react')>('@sva/studio-ui-react')),
  Badge: ({ children }: { readonly children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ loading, ...props }: React.ComponentProps<'button'> & { loading?: boolean }) => {
    void loading;
    return <button {...props} />;
  },
  Checkbox: ({
    indeterminate,
    ...props
  }: React.ComponentProps<'input'> & { readonly indeterminate?: boolean }) => {
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
  DialogDescription: ({ children }: { readonly children: React.ReactNode }) => (
    <div>{children}</div>
  ),
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
  StudioFieldGroup: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  Textarea: (props: React.ComponentProps<'textarea'>) => <textarea {...props} />,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  StatusNotice: ({ message }: { readonly message: { text: string } | null }) =>
    message ? <div>{message.text}</div> : null,
}));

vi.mock('../src/waste-management.tours.dialogs.js', () => ({
  TourDialog: (props: Record<string, unknown>) => {
    dialogSpy.tour(props);
    return props.open ? (
      <button onClick={() => (props.onOpenChange as (open: boolean) => void)(false)}>
        close-tour
      </button>
    ) : null;
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
      <button
        type="button"
        onClick={() => (props.onChange as (ids: string[]) => void)(['fraction-2'])}
      >
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
          (
            props.onAssignmentsChange as (
              assignments: Array<{
                id: string;
                pickupDate: string;
                locationId: string;
                note: string;
              }>
            ) => void
          )([
            {
              id: 'assignment-1',
              pickupDate: '2026-08-22',
              locationId: 'location-1',
              note: '08:00',
            },
          ]);
        }}
      >
        change-custom-dates
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
      status: 'published',
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
    overview: { tours: [{ id: 'tour-1', name: 'Schadstoffmobil' }] },
    assignmentContextLoading: false,
    onSubmitAssignments: vi.fn(),
    calendarOpen: true,
    schedulingOverview: { locationTourPickupDates: [] },
    schedulingLoadState: 'loading',
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
    dialogSpy.calendar.mockReset();
  });

  it('resets the tour form when the dialogs close', () => {
    const controller = createController();

    render(<WasteToursDialogs controller={controller} />);

    fireEvent.click(screen.getByRole('button', { name: 'close-tour' }));

    expect(controller.setDialogOpen).toHaveBeenCalledWith(false);
    expect(controller.setTourForm).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String) })
    );
    expect(controller.setSelectedTour).toHaveBeenCalledWith(null);
    expect(dialogSpy.calendar).toHaveBeenCalledWith(
      expect.objectContaining({ open: true, schedulingLoadState: 'loading' })
    );
  });

  it('bridges dialog patch handlers back into the controller state updaters', () => {
    const controller = createController();

    render(<WasteToursDialogs controller={controller} />);

    const tourProps = dialogSpy.tour.mock.calls[0]?.[0] as {
      onChange: (patch: Record<string, unknown>) => void;
    };

    tourProps.onChange({ name: 'Geaendert' });

    const nextTourForm = controller.setTourForm.mock.calls[0]?.[0](controller.tourForm);

    expect(nextTourForm).toEqual(expect.objectContaining({ name: 'Geaendert' }));
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
      search: expect.objectContaining({
        toursView: 'list',
        tourId: undefined,
        duplicateFromTourId: undefined,
      }),
    });

    const form = document.getElementById('waste-tour-form');
    if (!form) {
      throw new Error('missing waste-tour-form');
    }
    fireEvent.submit(form);
    expect(controller.onSubmitTour).toHaveBeenCalledWith(expect.anything(), 'create', 'tour-1');
  });

  it('finds a city and street beyond the first 100 of 718 assignment options without losing search focus', () => {
    const locations = Array.from({ length: 718 }, (_, index) => ({
      id: `location-${index}`,
      label: `Location ${index}`,
      regionId: 'region',
      regionName: 'Region',
      cityId: `city-${index}`,
      cityName: index === 717 ? 'Zielort' : `Ort ${index}`,
      streetId: `street-${index}`,
      streetName: index === 717 ? 'Zielstraße' : `Straße ${index}`,
      houseNumberId: '',
      houseNumberName: '1',
      active: true,
      ...(index === 717 ? { assignedLinkId: 'existing-link' } : {}),
    }));
    render(
      <TourAssignmentsPage
        tour={{ id: 'tour', name: 'Testtour' } as never}
        locations={locations}
        saving={false}
        message={null}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(101);
    // Existing assignments lead the complete selection, rather than changing the location list ordering.
    expect(within(table).getAllByRole('row')[1]?.textContent).toContain('Zielort');
    const input = screen.getByLabelText('filters.searchLabel');
    input.focus();
    for (const value of ['Z', 'Zi', 'Zie', 'Zielstraße'])
      fireEvent.change(input, { target: { value } });
    expect(document.activeElement).toBe(input);
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('Zielort')).toBeTruthy();
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('masterData.collectionLocations.fields.cityId'), {
      target: { value: 'city-717' },
    });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('Zielstraße')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'tours.assignments.actions.resetFilters' }));
    expect(within(table).getAllByRole('row')).toHaveLength(101);
  });

  it('combines alphabetic address filters and keeps child selections while they still fit', () => {
    const entry = (regionName: string, cityName: string, streetName: string) => ({
      id: `${regionName}-${cityName}-${streetName}`,
      label: `${regionName} / ${cityName} / ${streetName}`,
      regionId: regionName,
      regionName,
      cityId: cityName,
      cityName,
      streetId: streetName,
      streetName,
      houseNumberId: '',
      houseNumberName: '',
    });
    render(
      <TourAssignmentsPage
        tour={{ id: 'tour', name: 'Testtour' } as never}
        locations={[
          entry('Zossen', 'Zossen', 'Zielstraße'),
          entry('Perleberg', 'Ziegelberg', 'Zielstraße'),
          entry('Perleberg', 'Sükow', 'Birkenweg'),
          entry('Perleberg', 'Sükow', ''),
          entry('Perleberg', 'Perleberg', 'Am Markt'),
          entry('Altes Amt', 'Berge', 'Perleberger Straße'),
        ]}
        saving={false}
        message={null}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const search = screen.getByLabelText('filters.searchLabel');
    fireEvent.change(search, { target: { value: 'perleberg' } });
    const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows()).toHaveLength(2);
    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('Perleberger Straße'),
      expect.stringContaining('Am Markt'),
    ]);
    fireEvent.change(search, { target: { value: '' } });

    const region = screen.getByLabelText('masterData.collectionLocations.fields.regionId');
    const city = screen.getByLabelText('masterData.collectionLocations.fields.cityId');
    const street = screen.getByLabelText('masterData.collectionLocations.fields.streetId');
    const options = (select: HTMLElement) =>
      within(select).getAllByRole('option').slice(1).map((option) => option.textContent);
    expect(options(region)).toEqual(['Altes Amt', 'Perleberg', 'Zossen']);
    fireEvent.change(street, { target: { value: 'Birkenweg' } });
    fireEvent.change(city, { target: { value: 'Sükow' } });
    fireEvent.change(region, { target: { value: 'Perleberg' } });
    expect(options(city)).toEqual(['Perleberg', 'Sükow', 'Ziegelberg']);
    expect(options(street)).toEqual(['Birkenweg']);
    expect(city).toHaveProperty('value', 'Sükow');
    expect(street).toHaveProperty('value', 'Birkenweg');
    expect(rows()).toHaveLength(1);
    expect(rows()[0]?.textContent).toContain('Sükow');

    fireEvent.change(region, { target: { value: '' } });
    expect(city).toHaveProperty('value', 'Sükow');
    expect(street).toHaveProperty('value', 'Birkenweg');
    fireEvent.change(region, { target: { value: 'Zossen' } });
    expect(city).toHaveProperty('value', '');
    expect(street).toHaveProperty('value', '');
    expect(rows()[0]?.textContent).toContain('Zossen');
  });

  it('sorts the full filter result before paging and selects all its pages without losing hidden selections', () => {
    const locations = Array.from({ length: 23 }, (_, index) => ({
      id: String(index),
      label: `Abholpunkt ${index}`,
      regionId: 'region',
      regionName: 'Prignitz',
      cityId: index === 22 ? 'hidden' : 'filtered',
      cityName: index === 22 ? 'Berge' : 'Perleberg',
      streetId: 'street',
      streetName: 'Markt',
      houseNumberId: String(index),
      houseNumberName: String(index + 1),
    }));
    const onSubmit = vi.fn();
    render(
      <TourAssignmentsPage
        tour={{ id: 'tour', name: 'Testtour' } as never}
        locations={locations.toReversed()}
        saving={false}
        message={null}
        onBack={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'tours.assignments.workspace.selectLocation:{"value":"Abholpunkt 22"}',
      })
    );
    fireEvent.change(screen.getByLabelText('meta.pagination.pageSizeLabel'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('filters.searchLabel'), {
      target: { value: 'Perleberg' },
    });
    const table = screen.getByRole('table');
    const sort = within(table).getByRole('button', {
      name: 'masterData.locationsWorkspace.table.houseNumbers',
    });
    fireEvent.click(sort);
    fireEvent.click(sort);
    const addressNumbers = () =>
      within(table).getAllByRole('row').slice(1).map((row) => row.lastElementChild?.textContent);
    expect(addressNumbers()).toEqual(['22', '21', '20', '19', '18', '17', '16', '15', '14', '13']);
    fireEvent.click(screen.getByRole('button', { name: 'meta.pagination.next' }));
    expect(addressNumbers()).toEqual(['12', '11', '10', '9', '8', '7', '6', '5', '4', '3']);
    fireEvent.click(screen.getByRole('button', { name: 'meta.pagination.next' }));
    expect(addressNumbers()).toEqual(['2', '1']);

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'masterData.collectionLocations.bulk.actions.selectAllFiltered',
      })
    );
    const save = screen.getByRole('button', { name: 'tours.assignments.actions.save' });
    fireEvent.submit(save.closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith(new Map(locations.map(({ id }) => [id, true])));
  });

  it('keeps the selected row and its focus on the same page', () => {
    const locations = Array.from({ length: 101 }, (_, index) => {
      const id = String(index).padStart(3, '0');
      return {
        id,
        label: id,
        regionId: '',
        regionName: '',
        cityId: 'city',
        cityName: 'Perleberg',
        streetId: '',
        streetName: '',
        houseNumberId: '',
        houseNumberName: '',
      };
    });
    render(
      <TourAssignmentsPage
        tour={{ id: 'tour', name: 'Testtour' } as never}
        locations={locations}
        saving={false}
        message={null}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'meta.pagination.next' }));
    const checkbox = screen.getByRole('checkbox', {
      name: 'tours.assignments.workspace.selectLocation:{"value":"100"}',
    });
    checkbox.focus();

    fireEvent.click(checkbox);

    expect(checkbox.isConnected).toBe(true);
    expect(checkbox).toHaveProperty('checked', true);
    expect(document.activeElement).toBe(checkbox);
  });

  it('keeps assignment changes through an empty loading result for the same tour', () => {
    const locations = ['location-1', 'location-2'].map((id, index) => ({
      id,
      label: id,
      regionId: 'region-1',
      regionName: 'Prignitz',
      cityId: 'city-1',
      cityName: 'Perleberg',
      streetId: '',
      streetName: '',
      houseNumberId: '',
      houseNumberName: '',
      ...(index === 0 ? { assignedLinkId: 'link-1' } : {}),
    }));
    const onSubmit = vi.fn();
    const renderDialog = (options: typeof locations, loading = false) => (
      <TourAssignmentsPage
        tour={{ id: 'tour-1', name: 'Tour 1' } as never}
        locations={options}
        saving={false}
        loading={loading}
        message={null}
        onBack={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    const { rerender } = render(renderDialog(locations));
    const location = (id: string) =>
      screen.getByRole<HTMLInputElement>('checkbox', {
        name: `tours.assignments.workspace.selectLocation:{"value":"${id}"}`,
      });
    const save = () =>
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'tours.assignments.actions.save',
      });

    fireEvent.click(location('location-1'));
    fireEvent.click(location('location-2'));
    rerender(renderDialog([], true));
    expect(save().disabled).toBe(true);
    fireEvent.submit(save().closest('form')!);
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(renderDialog(locations.map((entry) => ({ ...entry }))));
    expect(location('location-1').checked).toBe(false);
    expect(location('location-2').checked).toBe(true);
    fireEvent.submit(save().closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith(
      new Map([
        ['location-1', false],
        ['location-2', true],
      ])
    );
  });

  it('renders the assignment page while loading', () => {
    render(
      <TourAssignmentsPage
        tour={{ id: 'tour-1', name: 'Tour 1' } as never}
        locations={[]}
        saving
        loading
        message={{ kind: 'info', text: 'assignment-message' }}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Tour 1' })).toBeTruthy();
    expect(screen.getByText('tours.table.loadingAssignments')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'tours.assignments.actions.saving' })).toHaveProperty(
      'disabled',
      true
    );
  });

  it('filters assignment locations, tracks hidden selections, resets filters, and submits the selected ids', () => {
    const onSubmit = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <TourAssignmentsPage
        tour={{ id: 'tour-1', name: 'Schadstoffmobil' } as never}
        locations={
          [
            {
              id: 'location-1',
              label: 'Albertplatz',
              regionId: 'region-1',
              regionName: 'Prignitz',
              cityId: 'city-1',
              cityName: 'Perleberg',
              streetId: 'street-1',
              streetName: 'Ackerstrasse',
              houseNumberId: 'house-1',
              houseNumberName: '10',
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
              houseNumberId: '',
              houseNumberName: 'Alle Hausnummern',
              active: false,
            },
          ] as never
        }
        saving={false}
        message={null}
        onBack={onOpenChange}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText('tours.assignments.workspace.selectedCount:{"value":1}')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('masterData.collectionLocations.fields.regionId'), {
      target: { value: 'region-2' },
    });
    expect(
      screen.getByText('tours.assignments.workspace.hiddenSelectedCount:{"value":1}')
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('masterData.collectionLocations.fields.cityId'), {
      target: { value: 'city-2' },
    });
    fireEvent.change(screen.getByLabelText('masterData.collectionLocations.fields.streetId'), {
      target: { value: 'street-2' },
    });

    fireEvent.click(
      screen.getByLabelText('masterData.collectionLocations.bulk.actions.selectAllFiltered')
    );
    fireEvent.submit(
      screen.getByRole('button', { name: 'tours.assignments.actions.save' }).closest('form')!
    );
    expect(onSubmit).toHaveBeenCalledWith(new Map([['location-2', true]]));

    fireEvent.click(screen.getByRole('button', { name: 'tours.assignments.actions.resetFilters' }));
    expect(screen.getByText('tours.assignments.workspace.visibleCount:{"value":2}')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('filters.searchLabel'), {
      target: { value: 'kein treffer' },
    });
    expect(screen.getByText('tours.assignments.workspace.noLocations')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'tours.assignments.actions.cancel' }));
    expect(onOpenChange).toHaveBeenCalledOnce();
  });

  it('renders address values with multi-column sorting while keeping selected locations first', () => {
    render(
      <TourAssignmentsPage
        tour={{ id: 'tour-1', name: 'Bio.10.A.2' } as never}
        locations={
          [
            {
              id: 'selected',
              label: 'Amt Z / C-Ort / Z-Straße / 20',
              regionId: 'region-z',
              regionName: 'Amt Z',
              cityId: 'city-c',
              cityName: 'C-Ort',
              streetId: 'street-z',
              streetName: 'Z-Straße',
              houseNumberId: 'house-20',
              houseNumberName: '20',
              active: true,
              assignedLinkId: 'link-1',
            },
            {
              id: 'alpha',
              label: 'Amt Meyenburg / A-Ort / Alle Straßen / Alle Hausnummern',
              regionId: 'region-m',
              regionName: 'Amt Meyenburg',
              cityId: 'city-a',
              cityName: 'A-Ort',
              streetId: '',
              streetName: 'Alle Straßen',
              houseNumberId: '',
              houseNumberName: 'Alle Hausnummern',
              active: true,
            },
            {
              id: 'beta',
              label: 'Amt A / B-Ort / Bahnhofstraße / 2',
              regionId: 'region-a',
              regionName: 'Amt A',
              cityId: 'city-b',
              cityName: 'B-Ort',
              streetId: 'street-b',
              streetName: 'Bahnhofstraße',
              houseNumberId: 'house-2',
              houseNumberName: '2',
              active: false,
            },
          ] as never
        }
        saving={false}
        loading={false}
        message={null}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const table = screen.getByRole('table', {
      name: 'tours.assignments.workspace.tableLabel',
    });
    expect(
      screen.getByRole('columnheader', { name: /masterData\.locationsWorkspace\.table\.region/ })
    ).toBeTruthy();
    expect(
      screen.getByRole('columnheader', { name: /masterData\.locationsWorkspace\.table\.city/ })
    ).toBeTruthy();
    expect(
      screen.getByRole('columnheader', { name: /masterData\.locationsWorkspace\.table\.street/ })
    ).toBeTruthy();
    expect(
      screen.getByRole('columnheader', {
        name: /masterData\.locationsWorkspace\.table\.houseNumbers/,
      })
    ).toBeTruthy();
    expect(within(table).getByText('Alle Straßen')).toBeTruthy();
    expect(within(table).getByText('Alle Hausnummern')).toBeTruthy();

    const getRowIds = () =>
      Array.from(table.querySelectorAll('tbody tr')).map((row) =>
        row.querySelector('input')?.getAttribute('aria-label')
      );
    expect(getRowIds()).toEqual([
      expect.stringContaining('Amt Z'),
      expect.stringContaining('A-Ort'),
      expect.stringContaining('B-Ort'),
    ]);

    const regionSort = within(table).getByRole('button', {
      name: 'masterData.locationsWorkspace.table.region',
    });
    fireEvent.click(regionSort);
    expect(getRowIds()).toEqual([
      expect.stringContaining('Amt Z'),
      expect.stringContaining('Amt A'),
      expect.stringContaining('A-Ort'),
    ]);

    fireEvent.click(regionSort);

    expect(getRowIds()).toEqual([
      expect.stringContaining('Amt Z'),
      expect.stringContaining('A-Ort'),
      expect.stringContaining('Amt A'),
    ]);
  });

  it('renders and updates weekly tour field branches for date ranges, fractions, and status', () => {
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
          status: 'published',
        }}
        fractions={[{ id: 'fraction-1', name: 'Restmüll' } as never]}
        locations={[{ id: 'location-1', label: 'Rathausplatz' }]}
        customRecurrencePresets={[
          { id: 'preset-1', label: 'Alle 10 Tage', intervalDays: 10 } as never,
        ]}
        pt={(key) => key}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText('tours.fields.name'), { target: { value: 'Bio Nord' } });
    expect(screen.getByText('tours.fields.wasteFractions')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'change-fractions' }));
    const longDescription = 'Ausführliche Tourbeschreibung '.repeat(20);
    const descriptionField = screen.getByLabelText('tours.fields.description');
    expect(descriptionField.getAttribute('maxlength')).toBeNull();
    fireEvent.change(descriptionField, { target: { value: longDescription } });
    expect(screen.getByLabelText('tours.fields.firstDate')).toBeTruthy();
    expect(screen.getByLabelText('tours.fields.endDate')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('tours.fields.firstDate'), {
      target: { value: '2026-08-01' },
    });
    fireEvent.change(screen.getByLabelText('tours.fields.endDate'), {
      target: { value: '2026-08-31' },
    });
    fireEvent.change(screen.getByLabelText('tours.fields.status'), {
      target: { value: 'archived' },
    });

    expect(onChange).toHaveBeenCalledWith({ name: 'Bio Nord' });
    expect(onChange).toHaveBeenCalledWith({ wasteFractionIds: ['fraction-2'] });
    expect(onChange).toHaveBeenCalledWith({ description: longDescription });
    expect(onChange).toHaveBeenCalledWith({ firstDate: '2026-08-01' });
    expect(onChange).toHaveBeenCalledWith({ endDate: '2026-08-31' });
    expect(onChange).toHaveBeenCalledWith({ status: 'archived' });
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
          status: 'draft',
        }}
        fractions={[]}
        locations={[{ id: 'location-1', label: 'Rathausplatz' }]}
        customRecurrencePresets={[]}
        pt={(key) => key}
        onChange={onChange}
      />
    );

    expect(screen.getByText('tours.fields.customDates')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'change-custom-dates' }));

    expect(customDatesSpy).toHaveBeenCalledWith(expect.objectContaining({ disabled: false }));
    expect(onChange).toHaveBeenCalledWith({ customDates: [{ date: '2026-08-22' }] });
    expect(onChange).toHaveBeenCalledWith({
      dateLocationAssignments: [
        { id: 'assignment-1', pickupDate: '2026-08-22', locationId: 'location-1', note: '08:00' },
      ],
    });
  });

  it('filters assignment locations, manages hidden selections, and submits the selected ids', () => {
    const onSubmit = vi.fn();

    render(
      <TourAssignmentsPage
        tour={{ id: 'tour-1', name: 'Schadstoffmobil' } as never}
        locations={
          [
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
          ] as never
        }
        saving={false}
        loading={false}
        message={{ kind: 'info', text: 'assignment-message' }}
        onBack={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText('assignment-message')).toBeTruthy();
    fireEvent.click(screen.getByRole('cell', { name: 'Nord' }));
    expect(screen.getByRole('checkbox', { name: /Schulhof/ })).toHaveProperty('checked', true);
    expect(screen.getAllByRole('row')[2]?.textContent).toContain('Nord');
    fireEvent.click(screen.getByRole('cell', { name: 'Nord' }));
    expect(screen.getByRole('checkbox', { name: /Schulhof/ })).toHaveProperty('checked', false);
    fireEvent.change(screen.getByLabelText('filters.searchLabel'), { target: { value: 'Nord' } });
    expect(
      screen.getByText('tours.assignments.workspace.hiddenSelectedCount:{"value":1}')
    ).toBeTruthy();
    fireEvent.click(
      screen.getByLabelText('masterData.collectionLocations.bulk.actions.selectAllFiltered')
    );
    fireEvent.click(screen.getByRole('button', { name: 'tours.assignments.actions.resetFilters' }));

    const form = screen
      .getByRole('button', { name: 'tours.assignments.actions.save' })
      .closest('form');
    if (!form) {
      throw new Error('missing assignments form');
    }
    fireEvent.submit(form);

    expect(onSubmit).toHaveBeenCalledWith(new Map([['location-2', true]]));
  });

  it('exposes all address sort buttons and puts aria-sort on the active column', () => {
    const onSortChange = vi.fn();

    render(
      <TourAssignmentsTable
        locations={
          [
            {
              id: 'location-1',
              label: 'Rathausplatz',
              regionName: 'Prignitz',
              cityName: 'Perleberg',
              streetName: 'Großer Markt',
              houseNumberName: '1',
            },
          ] as never
        }
        selectedLocationIds={[]}
        allVisibleSelected={false}
        someVisibleSelected={false}
        sortField="cityName"
        sortDirection="desc"
        onSortChange={onSortChange}
        onToggleSelectAll={vi.fn()}
        onToggleLocation={vi.fn()}
      />
    );

    expect(
      screen.getByRole('columnheader', { name: 'masterData.locationsWorkspace.table.city' })
        .getAttribute('aria-sort')
    ).toBe('descending');
    for (const [label, field] of [
      ['region', 'regionName'],
      ['street', 'streetName'],
      ['houseNumbers', 'houseNumberName'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: `masterData.locationsWorkspace.table.${label}` }));
      expect(onSortChange).toHaveBeenCalledWith(field);
    }
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
    expect(
      screen.getByRole('columnheader', { name: 'tours.table.status' }).getAttribute('aria-sort')
    ).toBe('descending');
    expect(
      screen.getByRole('columnheader', { name: 'tours.table.name' }).getAttribute('aria-sort')
    ).toBe('none');
  });
});
