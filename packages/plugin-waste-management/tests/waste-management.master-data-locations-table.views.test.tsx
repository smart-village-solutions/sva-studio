import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  WasteMasterDataLocationsHeader,
  WasteMasterDataLocationsRow,
  WasteMasterDataLocationsTableToolbar,
} from '../src/waste-management.master-data-locations-table.views.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

afterEach(() => {
  cleanup();
});

describe('waste-management master-data location table views', () => {
  it('opens the create menu, reacts to outside interactions, and forwards filter controls', async () => {
    const onOpenCreateCity = vi.fn();
    const onTourFilterChange = vi.fn();
    const onToggleSelectAll = vi.fn();

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
        onRequestDeleteSelected={vi.fn()}
        onToggleFiltersOpen={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.filters.tour'), {
      target: { value: 'tour-1' },
    });
    expect(onTourFilterChange).toHaveBeenCalledWith('tour-1');

    fireEvent.click(screen.getByLabelText('masterData.collectionLocations.bulk.actions.selectAllFiltered'));
    expect(onToggleSelectAll).toHaveBeenCalledWith(true);

    const createMenuTrigger = screen.getByRole('button', { name: /masterData\.locationsWorkspace\.actions\.createMenu/ });
    fireEvent.click(createMenuTrigger);
    await screen.findByRole('menuitem', { name: /masterData\.locationsWorkspace\.actions\.createCity/ });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: /masterData\.locationsWorkspace\.actions\.createCity/ })).toBeNull();
    });

    fireEvent.click(createMenuTrigger);
    await screen.findByRole('menuitem', { name: /masterData\.locationsWorkspace\.actions\.createCity/ });
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: /masterData\.locationsWorkspace\.actions\.createCity/ })).toBeNull();
    });

    fireEvent.click(createMenuTrigger);
    fireEvent.click(await screen.findByRole('menuitem', { name: /masterData\.locationsWorkspace\.actions\.createCity/ }));
    expect(onOpenCreateCity).toHaveBeenCalledTimes(1);
  });

  it('renders sortable headers and forwards select-all plus sort interactions', () => {
    const onToggleSelectAll = vi.fn();
    const onSortChange = vi.fn();

    render(
      <table>
        <WasteMasterDataLocationsHeader
          allFilteredLocationsSelected={false}
          someFilteredLocationsSelected
          onToggleSelectAll={onToggleSelectAll}
          sortField="region"
          sortDirection="desc"
          onSortChange={onSortChange}
        />
      </table>
    );

    fireEvent.click(screen.getByLabelText(/masterData\.locationsWorkspace\.table\.selectAllRows/));
    expect(onToggleSelectAll).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: /masterData\.locationsWorkspace\.table\.region/ }));
    fireEvent.click(screen.getByRole('button', { name: /masterData\.locationsWorkspace\.table\.city/ }));
    expect(onSortChange).toHaveBeenNthCalledWith(1, 'region');
    expect(onSortChange).toHaveBeenNthCalledWith(2, 'city');
  });

  it('renders fallback location values and forwards row actions', () => {
    const onOpenEditLocation = vi.fn();
    const onCopyLocation = vi.fn();
    const onDeleteLocation = vi.fn(async () => undefined);

    render(
      <table>
        <tbody>
          <WasteMasterDataLocationsRow
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
    expect(screen.getByText('masterData.locationsWorkspace.table.houseNumbersUnavailable')).toBeTruthy();
    expect(screen.getByText('masterData.locationsWorkspace.table.noTours')).toBeTruthy();
    expect(screen.getByText('common.inactive')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'masterData.collectionLocations.actions.edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'masterData.collectionLocations.actions.copy' }));
    fireEvent.click(screen.getByRole('button', { name: 'masterData.collectionLocations.actions.delete' }));

    expect(onOpenEditLocation).toHaveBeenCalledWith(expect.objectContaining({ id: 'location-1' }));
    expect(onCopyLocation).toHaveBeenCalledWith(expect.objectContaining({ id: 'location-1' }));
    expect(onDeleteLocation).toHaveBeenCalledWith(expect.objectContaining({ id: 'location-1' }));
  });

  it('renders resolved location values without the removed studio PDF column', () => {
    render(
      <table>
        <tbody>
          <WasteMasterDataLocationsRow
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
              locationTourNamesByLocationId: new Map(),
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

    expect(screen.getByText('Region')).toBeTruthy();
    expect(screen.getByText('Stadt')).toBeTruthy();
    expect(screen.getByText('Straße')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });
});
