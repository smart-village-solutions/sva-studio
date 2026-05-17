import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteMasterDataLocationsWorkspace } from '../src/waste-management.master-data-locations-workspace.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, variables?: Record<string, string | number>) =>
    variables ? `${key}:${JSON.stringify(variables)}` : key,
}));

afterEach(() => {
  cleanup();
});

describe('WasteMasterDataLocationsWorkspace', () => {
  it('shows the active tour filter summary and clears it explicitly', () => {
    const onTourFilterChange = vi.fn();

    render(
      <WasteMasterDataLocationsWorkspace
        regions={[{ id: 'region-1', name: 'Nord', createdAt: '2026-05-09T10:00:00.000Z', updatedAt: '2026-05-09T10:00:00.000Z' }]}
        cities={[
          {
            id: 'city-1',
            name: 'Musterstadt',
            regionId: 'region-1',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ]}
        streets={[
          {
            id: 'street-1',
            name: 'Hauptstraße',
            cityId: 'city-1',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ]}
        houseNumbers={[
          {
            id: 'house-1',
            number: '12',
            streetId: 'street-1',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ]}
        collectionLocations={[
          {
            id: 'location-1',
            regionId: 'region-1',
            cityId: 'city-1',
            streetId: 'street-1',
            houseNumberId: 'house-1',
            active: true,
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ]}
        locationTourLinks={[
          {
            id: 'link-1',
            locationId: 'location-1',
            tourId: 'tour-1',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ]}
        selectedLocationIds={[]}
        allFilteredLocationsSelected={false}
        selectedCollectionLocationsCount={0}
        availableTours={[
          {
            id: 'tour-1',
            name: 'Tour Nord',
            wasteFractionIds: [],
            active: true,
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ]}
        page={1}
        pageSize={25}
        selectedTourId="tour-1"
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onTourFilterChange={onTourFilterChange}
        onToggleSelectAll={vi.fn()}
        onToggleLocation={vi.fn()}
        onOpenCreateRegion={vi.fn()}
        onOpenCreateCity={vi.fn()}
        onOpenCreateStreet={vi.fn()}
        onOpenCreateHouseNumber={vi.fn()}
        onOpenCreateLocation={vi.fn()}
        onOpenEditRegion={vi.fn()}
        onOpenEditCity={vi.fn()}
        onOpenEditStreet={vi.fn()}
        onOpenEditHouseNumber={vi.fn()}
        onOpenEditLocation={vi.fn()}
        onOpenBulkAssignments={vi.fn()}
        getLocationLabel={() => 'Nord / Musterstadt / Hauptstraße / 12'}
      />
    );

    expect(screen.getAllByText('Tour Nord').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'masterData.locationsWorkspace.filters.clearTour' }));

    expect(onTourFilterChange).toHaveBeenCalledWith('');
  });

  it('renders address context and linked-tour counts directly in the dense location table', () => {
    render(
      <WasteMasterDataLocationsWorkspace
        regions={[{ id: 'region-1', name: 'Nord', createdAt: '2026-05-09T10:00:00.000Z', updatedAt: '2026-05-09T10:00:00.000Z' }]}
        cities={[
          {
            id: 'city-1',
            name: 'Musterstadt',
            regionId: 'region-1',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ]}
        streets={[
          {
            id: 'street-1',
            name: 'Hauptstraße',
            cityId: 'city-1',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ]}
        houseNumbers={[
          {
            id: 'house-1',
            number: '12',
            streetId: 'street-1',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ]}
        collectionLocations={[
          {
            id: 'location-1',
            regionId: 'region-1',
            cityId: 'city-1',
            streetId: 'street-1',
            houseNumberId: 'house-1',
            active: true,
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ]}
        locationTourLinks={[
          {
            id: 'link-1',
            locationId: 'location-1',
            tourId: 'tour-1',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
          {
            id: 'link-2',
            locationId: 'location-1',
            tourId: 'tour-2',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ]}
        selectedLocationIds={[]}
        allFilteredLocationsSelected={false}
        selectedCollectionLocationsCount={0}
        availableTours={[
          {
            id: 'tour-1',
            name: 'Tour Nord',
            wasteFractionIds: [],
            active: true,
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
          {
            id: 'tour-2',
            name: 'Tour West',
            wasteFractionIds: [],
            active: true,
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ]}
        page={1}
        pageSize={25}
        selectedTourId={undefined}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onTourFilterChange={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onToggleLocation={vi.fn()}
        onOpenCreateRegion={vi.fn()}
        onOpenCreateCity={vi.fn()}
        onOpenCreateStreet={vi.fn()}
        onOpenCreateHouseNumber={vi.fn()}
        onOpenCreateLocation={vi.fn()}
        onOpenEditRegion={vi.fn()}
        onOpenEditCity={vi.fn()}
        onOpenEditStreet={vi.fn()}
        onOpenEditHouseNumber={vi.fn()}
        onOpenEditLocation={vi.fn()}
        onOpenBulkAssignments={vi.fn()}
        getLocationLabel={() => 'Nord / Musterstadt / Hauptstraße / 12'}
      />
    );

    expect(screen.getAllByRole('table', { name: 'masterData.collectionLocations.title' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('masterData.locationsWorkspace.table.region').length).toBeGreaterThan(0);
    expect(screen.getAllByText('masterData.locationsWorkspace.table.city').length).toBeGreaterThan(0);
    expect(screen.getAllByText('masterData.locationsWorkspace.table.address').length).toBeGreaterThan(0);
    expect(screen.getAllByText('masterData.locationsWorkspace.table.tours').length).toBeGreaterThan(0);
    expect(screen.getAllByText('masterData.locationsWorkspace.table.status').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nord').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Musterstadt').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hauptstraße 12').length).toBeGreaterThan(0);
    expect(screen.getAllByText('masterData.locationsWorkspace.table.tourCount:{"value":2}').length).toBeGreaterThan(0);
    expect(screen.getAllByText('common.active').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('badge')).toHaveLength(0);
  });

  it('shows the real collection-location count in the overview cards', () => {
    render(
      <WasteMasterDataLocationsWorkspace
        regions={[{ id: 'region-1', name: 'Nord', createdAt: '2026-05-09T10:00:00.000Z', updatedAt: '2026-05-09T10:00:00.000Z' }]}
        cities={[]}
        streets={[]}
        houseNumbers={[]}
        collectionLocations={[
          {
            id: 'location-1',
            regionId: 'region-1',
            cityId: 'city-1',
            streetId: 'street-1',
            houseNumberId: 'house-1',
            active: true,
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
          {
            id: 'location-2',
            regionId: 'region-1',
            cityId: 'city-1',
            streetId: 'street-1',
            houseNumberId: 'house-2',
            active: true,
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ]}
        locationTourLinks={[]}
        selectedLocationIds={[]}
        allFilteredLocationsSelected={false}
        selectedCollectionLocationsCount={0}
        availableTours={[]}
        page={1}
        pageSize={25}
        selectedTourId={undefined}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onTourFilterChange={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onToggleLocation={vi.fn()}
        onOpenCreateRegion={vi.fn()}
        onOpenCreateCity={vi.fn()}
        onOpenCreateStreet={vi.fn()}
        onOpenCreateHouseNumber={vi.fn()}
        onOpenCreateLocation={vi.fn()}
        onOpenEditRegion={vi.fn()}
        onOpenEditCity={vi.fn()}
        onOpenEditStreet={vi.fn()}
        onOpenEditHouseNumber={vi.fn()}
        onOpenEditLocation={vi.fn()}
        onOpenBulkAssignments={vi.fn()}
        getLocationLabel={() => 'Nord / Musterstadt / Hauptstraße / 12'}
      />
    );

    expect(document.body.textContent).toContain('masterData.locationsWorkspace.overview.collectionLocationCount:{"value":2}');
  });
});
