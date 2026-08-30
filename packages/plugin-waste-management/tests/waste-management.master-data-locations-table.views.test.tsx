import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

afterEach(() => {
  cleanup();
  linkSpy.mockReset();
});
describe('waste-management master-data location table views', () => {
  it('opens the create menu, reacts to outside interactions, and forwards filter controls', async () => {
    const onOpenCreateCity = vi.fn();
    const onTourFilterChange = vi.fn();
    const onToggleSelectAll = vi.fn();
    const onSortModeChange = vi.fn();
    const onSortDirectionChange = vi.fn();

    render(
      <WasteMasterDataLocationsTableToolbar
        selectedCollectionLocationsCount={1}
        availableTours={[
          {
            id: 'tour-1',
            name: 'Tour Nord',
            wasteFractionIds: [],
            active: true,
            createdAt: '',
            updatedAt: '',
          },
        ]}
        filtersOpen
        selectedTourId=""
        allFilteredLocationsSelected={false}
        onOpenCreateRegion={vi.fn()}
        onOpenCreateCity={onOpenCreateCity}
        onOpenCreateStreet={vi.fn()}
        onOpenCreateHouseNumber={vi.fn()}
        onOpenCreateLocation={vi.fn()}
        onOpenBulkAssignments={vi.fn()}
        onTourFilterChange={onTourFilterChange}
        onToggleSelectAll={onToggleSelectAll}
        sortMode="address"
        sortDirection="asc"
        onSortModeChange={onSortModeChange}
        onSortDirectionChange={onSortDirectionChange}
        onRequestDeleteSelected={vi.fn()}
        onToggleFiltersOpen={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.filters.tour'), {
      target: { value: 'tour-1' },
    });
    expect(onTourFilterChange).toHaveBeenCalledWith('tour-1');

    fireEvent.click(
      screen.getByLabelText('masterData.collectionLocations.bulk.actions.selectAllFiltered')
    );
    expect(onToggleSelectAll).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByText('masterData.locationsWorkspace.sorting.includeRegion'));
    expect(onSortModeChange).toHaveBeenCalledWith('addressWithRegion');
    expect(
      screen.getByRole('group', { name: 'masterData.locationsWorkspace.sorting.label' })
    ).toBeTruthy();
    const directionButton = screen.getByRole('button', {
      name: /masterData\.locationsWorkspace\.sorting\.directionLabel/,
    });
    expect(directionButton.getAttribute('type')).toBe('button');
    fireEvent.click(directionButton);
    expect(onSortDirectionChange).toHaveBeenCalledWith('desc');

    const createMenuTrigger = screen.getByRole('button', {
      name: /masterData\.locationsWorkspace\.actions\.createMenu/,
    });
    fireEvent.click(createMenuTrigger);
    await screen.findByRole('menuitem', {
      name: /masterData\.locationsWorkspace\.actions\.createCity/,
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await waitFor(() => {
      expect(
        screen.queryByRole('menuitem', {
          name: /masterData\.locationsWorkspace\.actions\.createCity/,
        })
      ).toBeNull();
    });

    fireEvent.click(createMenuTrigger);
    await screen.findByRole('menuitem', {
      name: /masterData\.locationsWorkspace\.actions\.createCity/,
    });
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await waitFor(() => {
      expect(
        screen.queryByRole('menuitem', {
          name: /masterData\.locationsWorkspace\.actions\.createCity/,
        })
      ).toBeNull();
    });

    fireEvent.click(createMenuTrigger);
    fireEvent.click(
      await screen.findByRole('menuitem', {
        name: /masterData\.locationsWorkspace\.actions\.createCity/,
      })
    );
    expect(onOpenCreateCity).toHaveBeenCalledTimes(1);
  });

  it('renders plain server-ordered headers and forwards select-all', () => {
    const onToggleSelectAll = vi.fn();

    render(
      <table>
        <WasteMasterDataLocationsHeader
          allFilteredLocationsSelected={false}
          someFilteredLocationsSelected
          onToggleSelectAll={onToggleSelectAll}
        />
      </table>
    );

    fireEvent.click(screen.getByLabelText(/masterData\.locationsWorkspace\.table\.selectAllRows/));
    expect(onToggleSelectAll).toHaveBeenCalledWith(true);

    expect(
      screen.getByRole('columnheader', { name: 'masterData.locationsWorkspace.table.region' })
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /masterData\.locationsWorkspace\.table\.region/ })
    ).toBeNull();
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
});
