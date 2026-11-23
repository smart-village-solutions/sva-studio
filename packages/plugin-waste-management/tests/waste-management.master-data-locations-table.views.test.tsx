import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  WasteMasterDataLocationsHeader,
  WasteMasterDataLocationsRow,
  WasteMasterDataLocationsTableToolbar,
} from '../src/waste-management.master-data-locations-table.views.js';

const linkSpy = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, search, to, ...props }: Record<string, unknown>) => {
    linkSpy({ search, to, ...props });
    return (
      <a href={String(to)} {...props}>
        {children as React.ReactNode}
      </a>
    );
  },
}));

vi.mock('@sva/plugin-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/plugin-sdk')>()),
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

afterEach(() => {
  cleanup();
  linkSpy.mockReset();
});
describe('waste-management master-data location table views', () => {
  it('applies address and tour filters together with the global sorting', () => {
    const onOpenCreateLocation = vi.fn();
    const onApplyFilters = vi.fn();
    const onToggleSelectAll = vi.fn();
    const onQueryChange = vi.fn();

    render(
      <WasteMasterDataLocationsTableToolbar
        {...({} as Parameters<typeof WasteMasterDataLocationsTableToolbar>[0])}
        search={{ q: '', status: 'all' } as never}
        regions={[
          { id: 'region-1', name: 'Nord', createdAt: '', updatedAt: '' },
          { id: 'region-2', name: 'Süd', createdAt: '', updatedAt: '' },
        ]}
        cities={[
          {
            id: 'city-1',
            name: 'Perleberg',
            postalCode: '19348',
            regionId: 'region-1',
            createdAt: '',
            updatedAt: '',
          },
        ]}
        streets={[
          { id: 'street-1', cityId: 'city-1', name: 'Hauptstraße', createdAt: '', updatedAt: '' },
        ]}
        houseNumbers={[
          { id: 'house-2', streetId: 'street-1', number: '2', createdAt: '', updatedAt: '' },
        ]}
        onQueryChange={onQueryChange}
        onApplyFilters={onApplyFilters}
        selectedCollectionLocationsCount={1}
        availableTours={[
          {
            id: 'tour-1',
            name: 'Tour Nord',
            wasteFractionIds: [],
            status: 'published',
            active: true,
            createdAt: '',
            updatedAt: '',
          },
        ]}
        allFilteredLocationsSelected={false}
        onOpenCreateLocation={onOpenCreateLocation}
        onOpenBulkAssignments={vi.fn()}
        onToggleSelectAll={onToggleSelectAll}
        sortMode="address"
        sortDirection="asc"
        onRequestDeleteSelected={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'masterData.locationsWorkspace.actions.createLocation' })
    );
    expect(onOpenCreateLocation).toHaveBeenCalledOnce();
    const locationSearch = screen.getByRole('searchbox', {
      name: 'masterData.locationsWorkspace.filters.locationSearch',
    });
    fireEvent.change(locationSearch, { target: { value: 'Perleberg' } });
    fireEvent.blur(locationSearch);
    expect(onQueryChange).toHaveBeenCalledWith('Perleberg');
    fireEvent.click(
      screen.getByLabelText('masterData.collectionLocations.bulk.actions.selectAllFiltered')
    );
    expect(onToggleSelectAll).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: 'filters.open' }));
    expect(
      screen.getByRole('option', { name: '2 · Hauptstraße · Perleberg · 19348 · Nord' })
    ).toBeTruthy();
    for (const [label, value] of [
      ['masterData.collectionLocations.fields.streetId', 'street-1'],
      ['masterData.collectionLocations.fields.houseNumberId', 'house-2'],
      ['masterData.collectionLocations.fields.regionId', 'region-1'],
      ['masterData.locationsWorkspace.filters.tourYear', '2026'],
      ['masterData.locationsWorkspace.filters.tourStatus', 'published'],
      ['masterData.locationsWorkspace.filters.tour', 'tour-1'],
      ['masterData.locationsWorkspace.sorting.label', 'addressWithRegion'],
      ['filters.sortDirection', 'desc'],
    ]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    const region = screen.getByLabelText('masterData.collectionLocations.fields.regionId');
    const street = screen.getByLabelText('masterData.collectionLocations.fields.streetId');
    const houseNumber = screen.getByLabelText(
      'masterData.collectionLocations.fields.houseNumberId'
    );
    expect(street).toHaveProperty('value', 'street-1');
    expect(houseNumber).toHaveProperty('value', 'house-2');
    fireEvent.change(region, { target: { value: 'region-2' } });
    expect(street).toHaveProperty('value', '');
    expect(houseNumber).toHaveProperty('value', '');
    fireEvent.change(region, { target: { value: 'region-1' } });
    fireEvent.change(street, { target: { value: 'street-1' } });
    fireEvent.change(houseNumber, { target: { value: 'house-2' } });
    expect(onApplyFilters).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'filters.apply' }));
    expect(onApplyFilters).toHaveBeenCalledOnce();
    expect(onApplyFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        locationStreetId: 'street-1',
        locationHouseNumberId: 'house-2',
        tourId: 'tour-1',
        locationYear: 2026,
        locationTourStatus: 'published',
        locationSortMode: 'addressWithRegion',
        locationSortDirection: 'desc',
      })
    );
  });

  it('requests single-column server ordering and forwards select-all', () => {
    const onToggleSelectAll = vi.fn();
    const onSort = vi.fn();

    render(
      <table>
        <WasteMasterDataLocationsHeader
          allFilteredLocationsSelected={false}
          someFilteredLocationsSelected
          sortMode="city"
          sortDirection="asc"
          onSort={onSort}
          onToggleSelectAll={onToggleSelectAll}
        />
      </table>
    );

    fireEvent.click(screen.getByLabelText(/masterData\.locationsWorkspace\.table\.selectAllRows/));
    expect(onToggleSelectAll).toHaveBeenCalledWith(true);
    const city = screen.getByRole('columnheader', {
      name: 'masterData.locationsWorkspace.table.city',
    });
    expect(city.getAttribute('aria-sort')).toBe('ascending');
    fireEvent.click(
      screen.getByRole('button', { name: 'masterData.locationsWorkspace.table.city' })
    );
    expect(onSort).toHaveBeenCalledWith({
      locationSortMode: 'city',
      locationSortDirection: 'desc',
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'masterData.locationsWorkspace.table.houseNumbers' })
    );
    expect(onSort).toHaveBeenCalledWith({
      locationSortMode: 'houseNumber',
      locationSortDirection: 'asc',
    });
  });

  it('renders fallback location values and forwards row actions', () => {
    const onOpenEditLocation = vi.fn();
    const onCopyLocation = vi.fn();
    const onDeleteLocation = vi.fn(async () => undefined);

    render(
      <table>
        <tbody>
          <WasteMasterDataLocationsRow
            search={{ tab: 'locations' } as never}
            location={{
              id: 'location-1',
              regionId: undefined,
              cityId: 'city-missing',
              streetId: undefined,
              houseNumberId: undefined,
              active: false,
              createdAt: '',
              updatedAt: '',
            }}
            maps={{
              regionsById: new Map(),
              citiesById: new Map(),
              streetsById: new Map(),
              houseNumbersById: new Map(),
              toursById: new Map(),
              locationTourNamesByLocationId: new Map(),
              locationToursByLocationId: new Map(),
            }}
            selectedLocationIds={[]}
            onToggleLocation={vi.fn()}
            onCopyLocation={onCopyLocation}
            onDeleteLocation={onDeleteLocation}
            onOpenEditLocation={onOpenEditLocation}
          />
        </tbody>
      </table>
    );

    expect(screen.getByText('masterData.locationsWorkspace.table.regionUnavailable')).toBeTruthy();
    expect(screen.getByText('masterData.locationsWorkspace.table.cityUnavailable')).toBeTruthy();
    expect(screen.getByText('masterData.locationsWorkspace.table.streetUnavailable')).toBeTruthy();
    expect(
      screen.getByText('masterData.locationsWorkspace.table.houseNumbersUnavailable')
    ).toBeTruthy();
    expect(screen.getByText('masterData.locationsWorkspace.table.noTours')).toBeTruthy();
    expect(screen.getByText('common.inactive')).toBeTruthy();

    expect(
      screen.getByRole('link', { name: 'masterData.collectionLocations.actions.edit' })
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'masterData.collectionLocations.actions.copy' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'masterData.collectionLocations.actions.delete' })
    );

    expect(onOpenEditLocation).not.toHaveBeenCalled();
    expect(onCopyLocation).toHaveBeenCalledWith(expect.objectContaining({ id: 'location-1' }));
    expect(onDeleteLocation).toHaveBeenCalledWith(expect.objectContaining({ id: 'location-1' }));
  });

  it('renders resolved location values without the removed studio PDF column', () => {
    const onOpenEditTour = vi.fn();
    render(
      <table>
        <tbody>
          <WasteMasterDataLocationsRow
            search={{ tab: 'locations' } as never}
            location={{
              id: 'location-1',
              regionId: 'region-1',
              cityId: 'city-1',
              streetId: 'street-1',
              houseNumberId: 'house-1',
              active: true,
              createdAt: '',
              updatedAt: '',
            }}
            maps={{
              regionsById: new Map([['region-1', { id: 'region-1', name: 'Region' }]]),
              citiesById: new Map([['city-1', { id: 'city-1', name: 'Stadt' }]]),
              streetsById: new Map([['street-1', { id: 'street-1', name: 'Straße' }]]),
              houseNumbersById: new Map([['house-1', { id: 'house-1', number: '12' }]]),
              toursById: new Map(),
              locationTourNamesByLocationId: new Map([['location-1', ['Tour Nord']]]),
              locationToursByLocationId: new Map([
                ['location-1', [{ id: 'tour-1', name: 'Tour Nord' } as never]],
              ]),
            }}
            selectedLocationIds={[]}
            onToggleLocation={vi.fn()}
            onCopyLocation={vi.fn()}
            onDeleteLocation={vi.fn(async () => undefined)}
            onOpenEditLocation={vi.fn()}
            onOpenEditTour={onOpenEditTour}
          />
        </tbody>
      </table>
    );

    expect(screen.getByText('Region')).toBeTruthy();
    expect(screen.getByText('Stadt')).toBeTruthy();
    expect(screen.getByText('Straße')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Tour Nord' })).toBeTruthy();
    expect(onOpenEditTour).not.toHaveBeenCalled();
  });

  it('renders address and tour names from the paginated server projection', () => {
    const onOpenEditTour = vi.fn();

    render(
      <table>
        <tbody>
          <WasteMasterDataLocationsRow
            location={{
              id: 'location-1',
              regionId: 'region-1',
              regionName: 'Projektionsregion',
              cityId: 'city-1',
              cityName: 'Projektionsort',
              streetId: 'street-1',
              streetName: 'Projektionsstraße',
              houseNumberId: 'house-1',
              houseNumber: '27b',
              tours: [{ id: 'tour-1', name: 'Projektionstour' }],
              active: true,
              createdAt: '',
              updatedAt: '',
            }}
            maps={{
              regionsById: new Map(),
              citiesById: new Map(),
              streetsById: new Map(),
              houseNumbersById: new Map(),
              toursById: new Map(),
              locationTourNamesByLocationId: new Map(),
              locationToursByLocationId: new Map(),
            }}
            selectedLocationIds={[]}
            onToggleLocation={vi.fn()}
            onCopyLocation={vi.fn()}
            onDeleteLocation={vi.fn(async () => undefined)}
            onOpenEditLocation={vi.fn()}
            onOpenEditTour={onOpenEditTour}
          />
        </tbody>
      </table>
    );

    expect(screen.getByText('Projektionsregion')).toBeTruthy();
    expect(screen.getByText('Projektionsort')).toBeTruthy();
    expect(screen.getByText('Projektionsstraße')).toBeTruthy();
    expect(screen.getByText('27b')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Projektionstour' }));
    expect(onOpenEditTour).toHaveBeenCalledWith('tour-1');
  });

  it('keeps a paginated location visible but hides tours outside the selected year', () => {
    render(
      <table>
        <tbody>
          <WasteMasterDataLocationsRow
            location={
              {
                id: 'location-1',
                cityId: 'city-1',
                cityName: 'Musterort',
                active: true,
                tours: [
                  { id: 'old', name: 'Tour 2026' },
                  { id: 'next', name: 'Tour 2027' },
                ],
                createdAt: '',
                updatedAt: '',
              } as never
            }
            maps={{
              regionsById: new Map(),
              citiesById: new Map(),
              streetsById: new Map(),
              houseNumbersById: new Map(),
              locationYear: 2027,
              toursById: new Map([['next', { id: 'next', name: 'Tour 2027' } as never]]),
              locationTourNamesByLocationId: new Map(),
              locationToursByLocationId: new Map(),
            }}
            selectedLocationIds={[]}
            onToggleLocation={vi.fn()}
            onCopyLocation={vi.fn()}
            onDeleteLocation={vi.fn(async () => undefined)}
            onOpenEditLocation={vi.fn()}
          />
        </tbody>
      </table>
    );
    expect(screen.getByText('Musterort')).toBeTruthy();
    expect(screen.getByText('Tour 2027')).toBeTruthy();
    expect(screen.queryByText('Tour 2026')).toBeNull();
  });

  it('labels an empty year view without hiding its Abholort', () => {
    render(
      <table>
        <tbody>
          <WasteMasterDataLocationsRow
            location={
              {
                id: 'location-2',
                cityId: 'city-2',
                cityName: 'Andersdorf',
                tours: [{ id: 'old', name: 'Tour 2026' }],
                active: true,
                createdAt: '',
                updatedAt: '',
              } as never
            }
            maps={{
              regionsById: new Map(),
              citiesById: new Map(),
              streetsById: new Map(),
              houseNumbersById: new Map(),
              toursById: new Map(),
              locationYear: 2027,
              locationTourNamesByLocationId: new Map(),
              locationToursByLocationId: new Map(),
            }}
            selectedLocationIds={[]}
            onToggleLocation={vi.fn()}
            onCopyLocation={vi.fn()}
            onDeleteLocation={vi.fn(async () => undefined)}
            onOpenEditLocation={vi.fn()}
          />
        </tbody>
      </table>
    );
    expect(screen.getByText('Andersdorf')).toBeTruthy();
    expect(screen.getByText('masterData.locationsWorkspace.table.noToursForFilters')).toBeTruthy();
  });

  it('filters the paginated tour projection by status while keeping the Abholort', () => {
    render(
      <table>
        <tbody>
          <WasteMasterDataLocationsRow
            location={
              {
                id: 'location-3',
                cityId: 'city-3',
                cityName: 'Dorf',
                active: true,
                tours: [
                  { id: 'draft', name: 'Entwurf' },
                  { id: 'published', name: 'Veröffentlicht' },
                ],
                createdAt: '',
                updatedAt: '',
              } as never
            }
            maps={{
              regionsById: new Map(),
              citiesById: new Map(),
              streetsById: new Map(),
              houseNumbersById: new Map(),
              locationTourStatus: 'draft',
              toursById: new Map([['draft', { id: 'draft', name: 'Entwurf' } as never]]),
              locationTourNamesByLocationId: new Map(),
              locationToursByLocationId: new Map(),
            }}
            selectedLocationIds={[]}
            onToggleLocation={vi.fn()}
            onCopyLocation={vi.fn()}
            onDeleteLocation={vi.fn(async () => undefined)}
            onOpenEditLocation={vi.fn()}
          />
        </tbody>
      </table>
    );
    expect(screen.getByText('Dorf')).toBeTruthy();
    expect(screen.getByText('Entwurf')).toBeTruthy();
    expect(screen.queryByText('Veröffentlicht')).toBeNull();
  });
});
