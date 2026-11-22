import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  publishSessionAccessSnapshot,
  resetSessionAccessSnapshot,
} from '@sva/plugin-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteLocationFractionCoverageCheck } from '../src/waste-management.location-fraction-coverage-check.js';
import { CoverageResults } from '../src/waste-management.location-fraction-coverage-check.parts.js';

const loadScheduling = vi.hoisted(() => vi.fn(async () => ({
  locationTourPickupDates: [],
  tourDateShifts: [],
  globalDateShifts: [],
  holidayRules: [],
})));

vi.mock('../src/waste-management.api.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/waste-management.api.js')>()),
  getWasteManagementSchedulingOverview: loadScheduling,
}));

vi.mock('@sva/plugin-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/plugin-sdk')>()),
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const timestamp = '2026-08-09T10:00:00.000Z';
const locations = [
  { id: 'missing', cityId: 'city-1', active: true, createdAt: timestamp, updatedAt: timestamp },
  { id: 'partial', cityId: 'city-1', active: true, createdAt: timestamp, updatedAt: timestamp },
  { id: 'covered', cityId: 'city-1', active: true, createdAt: timestamp, updatedAt: timestamp },
  { id: 'inactive', cityId: 'city-1', active: false, createdAt: timestamp, updatedAt: timestamp },
];
const fractions = [
  {
    id: 'paper',
    name: 'Papier, Pappe, Kartonagen',
    color: '#000000',
    status: 'published',
    reminderConfig: { enabled: false, channels: [], slots: [] },
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];
const tours = [
  {
    id: 'partial-paper-tour',
    name: 'Papiertour erstes Halbjahr',
    wasteFractionIds: ['paper'],
    firstDate: '2027-01-01',
    endDate: '2027-06-30',
    status: 'published',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 'covered-paper-tour',
    name: 'Papiertour ganzjährig',
    wasteFractionIds: ['paper'],
    status: 'published',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];
const links = [
  {
    id: 'partial-link',
    locationId: 'partial',
    tourId: 'partial-paper-tour',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 'covered-link',
    locationId: 'covered',
    tourId: 'covered-paper-tour',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];

afterEach(() => {
  cleanup();
  loadScheduling.mockClear();
  resetSessionAccessSnapshot();
});

describe('WasteLocationFractionCoverageCheck', () => {
  it('excludes exactly Schadstoffmobil for Prignitz and clears a stale selection', () => {
    const setTenant = (instanceId: string) => publishSessionAccessSnapshot({
      instanceId,
      assignedModules: ['waste-management'],
      isResolved: true,
      permissionActions: ['waste-management.read'],
      roles: [],
    });
    setTenant('other-tenant');
    const availableFractions = [
      { ...fractions[0]!, id: 'hazard', name: 'Schadstoffmobil' },
      { ...fractions[0]!, id: 'reserve', name: 'Schadstoffmobil Reserve' },
      { ...fractions[0]!, id: 'residual', name: 'Hausmüll' },
    ];
    render(
      <WasteLocationFractionCoverageCheck
        locations={locations}
        fractions={availableFractions}
        tours={tours as never}
        links={links}
        onReplaceLocationSelection={vi.fn()}
        onOpenBulkAssignments={vi.fn()}
        onOpenEditLocation={vi.fn()}
        getLocationLabel={(point) => point.id}
      />
    );
    const prefix = 'masterData.locationsWorkspace.coverage';
    const select = screen.getByLabelText<HTMLSelectElement>(`${prefix}.fraction`);
    expect(screen.getByRole('option', { name: 'Schadstoffmobil', exact: true })).toBeTruthy();
    fireEvent.change(select, { target: { value: 'hazard' } });
    fireEvent.change(screen.getByLabelText(`${prefix}.year`), { target: { value: '2027' } });
    expect(select.value).toBe('hazard');

    act(() => setTenant('bb-prignitz'));
    expect(select.value).toBe('');
    expect(screen.queryByRole('option', { name: 'Schadstoffmobil', exact: true })).toBeNull();
    expect(screen.getByRole('option', { name: 'Schadstoffmobil Reserve' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Hausmüll' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `${prefix}.check` }));
    expect(screen.getByRole('alert').textContent).toBe(`${prefix}.required`);
    expect(loadScheduling).not.toHaveBeenCalled();

    act(() => setTenant('other-tenant'));
    expect(screen.getByRole('option', { name: 'Schadstoffmobil', exact: true })).toBeTruthy();
    expect(select.value).toBe('');
  });

  it('checks a full planning year with draft tours and allows a published-only comparison', async () => {
    const draftTour = {
      ...tours[0],
      id: 'draft-paper-2027',
      firstDate: '2027-01-07',
      endDate: '2027-12-31',
      recurrence: 'biweekly' as const,
      status: 'draft' as const,
    };
    render(
      <WasteLocationFractionCoverageCheck
        locations={[locations[2]]}
        fractions={fractions}
        tours={[draftTour]}
        links={[{ ...links[1], tourId: draftTour.id }]}
        onReplaceLocationSelection={vi.fn()}
        onOpenBulkAssignments={vi.fn()}
        onOpenEditLocation={vi.fn()}
        getLocationLabel={(location) => location.id}
      />
    );
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.fraction'), {
      target: { value: 'paper' },
    });
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.year'), {
      target: { value: '2027' },
    });
    expect(
      (
        screen.getByLabelText(
          'masterData.locationsWorkspace.coverage.startDate'
        ) as HTMLInputElement
      ).value
    ).toBe('01.01.2027');
    expect(
      (screen.getByLabelText('masterData.locationsWorkspace.coverage.endDate') as HTMLInputElement)
        .value
    ).toBe('31.12.2027');
    fireEvent.click(
      screen.getByRole('button', { name: 'masterData.locationsWorkspace.coverage.check' })
    );
    expect(await screen.findByText('masterData.locationsWorkspace.coverage.complete:{"value":1}')).toBeTruthy();
    expect(loadScheduling).toHaveBeenCalledOnce();
    expect(screen.getByText('masterData.locationsWorkspace.coverage.planningNotice')).toBeTruthy();
    expect(
      screen.getByText('masterData.locationsWorkspace.coverage.assignmentNotice')
    ).toBeTruthy();

    fireEvent.click(screen.getByLabelText('masterData.locationsWorkspace.coverage.includeDrafts'));
    fireEvent.click(
      screen.getByRole('button', { name: 'masterData.locationsWorkspace.coverage.check' })
    );
    expect(screen.getByText('masterData.locationsWorkspace.coverage.missing')).toBeTruthy();
    expect(loadScheduling).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.year'), {
      target: { value: '202' },
    });
    expect(
      (
        screen.getByLabelText(
          'masterData.locationsWorkspace.coverage.startDate'
        ) as HTMLInputElement
      ).value
    ).toBe('');
    expect(
      (screen.getByLabelText('masterData.locationsWorkspace.coverage.endDate') as HTMLInputElement)
        .value
    ).toBe('');
  });

  it('withholds a January coverage result when the effective schedule cannot be read', async () => {
    loadScheduling.mockRejectedValueOnce(new Error('schedule unavailable'));
    render(
      <WasteLocationFractionCoverageCheck
        locations={locations}
        fractions={fractions}
        tours={[{ ...tours[0], recurrence: 'biweekly' }] as never}
        links={links}
        onReplaceLocationSelection={vi.fn()}
        onOpenBulkAssignments={vi.fn()}
        onOpenEditLocation={vi.fn()}
        getLocationLabel={(location) => location.id}
      />
    );
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.fraction'), {
      target: { value: 'paper' },
    });
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.year'), {
      target: { value: '2027' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'masterData.locationsWorkspace.coverage.check' }));
    expect(await screen.findByText('masterData.locationsWorkspace.coverage.schedulingLoadError')).toBeTruthy();
    expect(screen.queryByText('masterData.locationsWorkspace.coverage.assignmentNotice')).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'masterData.locationsWorkspace.coverage.check' }).disabled).toBe(false);
  });

  it('groups by locality ID and lists only missing assignments in expandable locality rows', () => {
    const recordTimestamp = { createdAt: timestamp, updatedAt: timestamp };
    const cities = [
      { id: 'complete', name: 'Neustadt', regionId: 'north', ...recordTimestamp },
      { id: 'partial', name: 'Neustadt', regionId: 'south', ...recordTimestamp },
      { id: 'unserved', name: 'Waldow', regionId: 'south', ...recordTimestamp },
    ];
    const regions = [
      { id: 'north', name: 'Nord', ...recordTimestamp },
      { id: 'south', name: 'Süd', ...recordTimestamp },
    ];
    const localPoints = [
      { ...locations[2]!, cityId: 'complete', id: 'Dorfmitte' },
      { ...locations[1]!, cityId: 'partial', id: 'Bahnhofstraße' },
      { ...locations[0]!, cityId: 'partial', id: 'Schulstraße' },
      { ...locations[3]!, cityId: 'unserved', id: 'Inaktiver Abholpunkt' },
    ];
    render(
      <WasteLocationFractionCoverageCheck
        locations={localPoints}
        cities={cities}
        regions={regions}
        fractions={fractions}
        tours={tours as never}
        links={[
          { ...links[0]!, locationId: 'Bahnhofstraße' },
          { ...links[1]!, locationId: 'Dorfmitte' },
        ]}
        onReplaceLocationSelection={vi.fn()}
        onOpenBulkAssignments={vi.fn()}
        onOpenEditLocation={vi.fn()}
        getLocationLabel={(point) => point.id}
      />
    );
    const prefix = 'masterData.locationsWorkspace.coverage';
    fireEvent.change(screen.getByLabelText(`${prefix}.fraction`), { target: { value: 'paper' } });
    fireEvent.change(screen.getByLabelText(`${prefix}.year`), { target: { value: '2027' } });
    fireEvent.click(screen.getByRole('button', { name: `${prefix}.check` }));
    const region = screen.getByRole('region', { name: `${prefix}.localityTitle` });
    const localities = within(region);
    expect(region.querySelector(':scope > ul')?.children).toHaveLength(3);
    expect(localities.getByText('Neustadt · Nord')).toBeTruthy();
    expect(localities.getByText(`${prefix}.localityComplete:{"assigned":1,"total":1}`)).toBeTruthy();
    expect(localities.getByText(`${prefix}.localityMissing:{"assigned":0,"total":0}`)).toBeTruthy();

    const summary = localities.getByText('Neustadt · Süd').closest('summary')!;
    expect(within(summary).getByText(`${prefix}.localityPartial:{"assigned":1,"total":2}`)).toBeTruthy();
    summary.focus();
    expect(document.activeElement).toBe(summary);
    fireEvent.click(summary);
    const details = summary.closest('details')!;
    expect(details.open).toBe(true);
    expect(within(details).getByText('Schulstraße')).toBeTruthy();
    expect(within(details).queryByText('Bahnhofstraße')).toBeNull();
    expect(within(screen.getByRole('region', { name: `${prefix}.incomplete` })).getByText('Bahnhofstraße')).toBeTruthy();
    expect(region.closest('[aria-live]')).toBeNull();
  });

  it('reports an empty scope without claiming full coverage', () => {
    render(
      <CoverageResults
        result={{ issues: [], checkedLocationCount: 0, includeDrafts: true }}
        locationsById={new Map()}
        onAssign={vi.fn()}
        onEdit={vi.fn()}
        getLocationLabel={(location) => location.id}
      />
    );
    expect(screen.getByText('masterData.locationsWorkspace.coverage.noActiveLocations').getAttribute('aria-live')).toBe('polite');
  });
  it.each([
    ['loading', 'masterData.locationsWorkspace.coverage.fractionsLoading'],
    ['error', 'masterData.locationsWorkspace.coverage.fractionsLoadError'],
    ['ready', 'masterData.locationsWorkspace.coverage.fractionsEmpty'],
  ] as const)(
    'shows the %s fraction state without enabling the check',
    (fractionsStatus, message) => {
      render(
        <WasteLocationFractionCoverageCheck
          locations={locations}
          fractions={[]}
          fractionsStatus={fractionsStatus}
          tours={tours}
          links={links}
          onReplaceLocationSelection={vi.fn()}
          onOpenBulkAssignments={vi.fn()}
          onOpenEditLocation={vi.fn()}
          getLocationLabel={(location) => location.id}
        />
      );

      expect(screen.getByText(message)).toBeTruthy();
      expect(
        (
          screen.getByLabelText(
            'masterData.locationsWorkspace.coverage.fraction'
          ) as HTMLSelectElement
        ).disabled
      ).toBe(true);
      expect(
        (
          screen.getByRole('button', {
            name: 'masterData.locationsWorkspace.coverage.check',
          }) as HTMLButtonElement
        ).disabled
      ).toBe(true);
    }
  );

  it.each([
    ['loading', 'masterData.locationsWorkspace.coverage.toursLoading'],
    ['error', 'masterData.locationsWorkspace.coverage.toursLoadError'],
  ] as const)('shows the %s tours state without enabling the check', (toursStatus, message) => {
    render(
      <WasteLocationFractionCoverageCheck
        locations={locations}
        fractions={fractions}
        fractionsStatus="ready"
        toursStatus={toursStatus}
        tours={[]}
        links={links}
        onReplaceLocationSelection={vi.fn()}
        onOpenBulkAssignments={vi.fn()}
        onOpenEditLocation={vi.fn()}
        getLocationLabel={(location) => location.id}
      />
    );

    expect(screen.getByText(message)).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: 'masterData.locationsWorkspace.coverage.check',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it('shows missing and incomplete assignments separately and opens bulk assignment for all issues', () => {
    const onReplaceLocationSelection = vi.fn();
    const onOpenBulkAssignments = vi.fn();

    render(
      <WasteLocationFractionCoverageCheck
        locations={locations}
        fractions={fractions}
        tours={tours}
        links={links}
        onReplaceLocationSelection={onReplaceLocationSelection}
        onOpenBulkAssignments={onOpenBulkAssignments}
        onOpenEditLocation={vi.fn()}
        getLocationLabel={(location) => `Ort ${location.id}`}
      />
    );

    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.fraction'), {
      target: { value: 'paper' },
    });
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.startDate'), {
      target: { value: '2027-01-01' },
    });
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.endDate'), {
      target: { value: '2027-12-31' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'masterData.locationsWorkspace.coverage.check' })
    );

    expect(screen.getByText('masterData.locationsWorkspace.coverage.missing')).toBeTruthy();
    expect(screen.getByText('masterData.locationsWorkspace.coverage.incomplete')).toBeTruthy();
    expect(screen.getByText('Ort missing')).toBeTruthy();
    expect(screen.getByText('Ort partial')).toBeTruthy();
    expect(screen.queryByText('Ort covered')).toBeNull();
    expect(screen.queryByText('Ort inactive')).toBeNull();
    expect(
      screen.getByText(
        'masterData.locationsWorkspace.coverage.gap:{"startDate":"01.07.2027","endDate":"31.12.2027"}'
      )
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'masterData.locationsWorkspace.coverage.selectAndAssign:{"value":2}',
      })
    );

    expect(onReplaceLocationSelection).toHaveBeenCalledWith(['missing', 'partial']);
    expect(onReplaceLocationSelection).toHaveBeenCalledTimes(1);
    expect(onOpenBulkAssignments).toHaveBeenCalledTimes(1);
  });

  it('clears stale results when the coverage data reloads', () => {
    const { rerender } = render(
      <WasteLocationFractionCoverageCheck
        locations={locations}
        fractions={fractions}
        fractionsStatus="ready"
        toursStatus="ready"
        tours={tours}
        links={links}
        onReplaceLocationSelection={vi.fn()}
        onOpenBulkAssignments={vi.fn()}
        onOpenEditLocation={vi.fn()}
        getLocationLabel={(location) => `Ort ${location.id}`}
      />
    );

    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.fraction'), {
      target: { value: 'paper' },
    });
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.startDate'), {
      target: { value: '2027-01-01' },
    });
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.endDate'), {
      target: { value: '2027-12-31' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'masterData.locationsWorkspace.coverage.check' })
    );

    expect(screen.getByText('Ort missing')).toBeTruthy();

    rerender(
      <WasteLocationFractionCoverageCheck
        locations={locations}
        fractions={fractions}
        fractionsStatus="loading"
        toursStatus="loading"
        tours={[]}
        links={[]}
        onReplaceLocationSelection={vi.fn()}
        onOpenBulkAssignments={vi.fn()}
        onOpenEditLocation={vi.fn()}
        getLocationLabel={(location) => `Ort ${location.id}`}
      />
    );

    expect(screen.queryByText('Ort missing')).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: 'masterData.locationsWorkspace.coverage.selectAndAssign:{"value":2}',
      })
    ).toBeNull();
  });

  it('rejects an end date before the start date without running the check', () => {
    render(
      <WasteLocationFractionCoverageCheck
        locations={locations}
        fractions={fractions}
        tours={tours}
        links={links}
        onReplaceLocationSelection={vi.fn()}
        onOpenBulkAssignments={vi.fn()}
        onOpenEditLocation={vi.fn()}
        getLocationLabel={(location) => location.id}
      />
    );

    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.fraction'), {
      target: { value: 'paper' },
    });
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.startDate'), {
      target: { value: '2027-12-31' },
    });
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.coverage.endDate'), {
      target: { value: '2027-01-01' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'masterData.locationsWorkspace.coverage.check' })
    );

    expect(screen.getByRole('alert').textContent).toBe(
      'masterData.locationsWorkspace.coverage.invalidDateRange'
    );
    expect(screen.queryByText('Ort missing')).toBeNull();
  });
});
