import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteMasterDataTabContent } from '../src/waste-management.master-data-tab-content.js';

const navigateMock = vi.fn();
const fractionsContentMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../src/waste-management.master-data-fractions-content.js', () => ({
  WasteMasterDataFractionsContent: (props: Record<string, unknown>) => {
    fractionsContentMock(props);
    return (
      <div>
        <button
          type="button"
          onClick={() => (props.onFractionsSortChange as (sortBy: string, sortDirection: string) => void)('color', 'desc')}
        >
          sort-color-desc
        </button>
      </div>
    );
  },
}));

vi.mock('../src/waste-management.master-data-fraction-create-content.js', () => ({
  WasteMasterDataFractionCreateContent: () => <div>fraction-form</div>,
}));

vi.mock('../src/waste-management.master-data-locations-workspace.js', () => ({
  WasteMasterDataLocationsWorkspace: () => <div>locations-workspace</div>,
}));

describe('WasteMasterDataTabContent', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    fractionsContentMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes persistent fraction sort state into the fractions content and writes sort changes back into search params', () => {
    const controller = {
      filteredFractions: [
        {
          id: 'fraction-1',
          name: 'Bio',
          color: '#00AA00',
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      deleteFraction: vi.fn(),
      filteredRegions: [],
      filteredCities: [],
      filteredStreets: [],
      filteredHouseNumbers: [],
      filteredCollectionLocations: [],
      overview: null,
      selectedLocationIds: [],
      allFilteredLocationsSelected: false,
      selectedCollectionLocations: [],
      availableTours: [],
      toggleSelectAllFilteredLocations: vi.fn(),
      toggleLocationSelection: vi.fn(),
      openCreateRegionDialog: vi.fn(),
      openCreateCityDialog: vi.fn(),
      openCreateStreetDialog: vi.fn(),
      openCreateHouseNumberDialog: vi.fn(),
      openCreateLocationDialog: vi.fn(),
      openEditRegionDialog: vi.fn(),
      openEditCityDialog: vi.fn(),
      openEditStreetDialog: vi.fn(),
      openEditHouseNumberDialog: vi.fn(),
      openBulkAssignmentsDialog: vi.fn(),
      openEditLocationDialog: vi.fn(),
      getLocationLabel: vi.fn(),
      fractionForm: { id: 'fraction-form-1' },
      locationForm: { id: 'location-form-1' },
      setDialogOpen: vi.fn(),
      resetFractionForm: vi.fn(),
      setLastOutcome: vi.fn(),
      setDialogMode: vi.fn(),
      setFractionForm: vi.fn(),
      setMessage: vi.fn(),
      setLocationDialogMode: vi.fn(),
      setLocationForm: vi.fn(),
      setLocationDialogOpen: vi.fn(),
      resetLocationForm: vi.fn(),
    } as never;

    const search = {
      tab: 'fractions',
      masterDataTab: 'fractions',
      fractionsView: 'list',
      toursView: 'list',
      locationsView: 'list',
      schedulingView: 'list',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
      fractionsSortBy: 'name',
      fractionsSortDirection: 'asc',
      regionId: undefined,
      cityId: undefined,
      wasteFractionId: undefined,
      tourId: undefined,
      tourDateShiftId: undefined,
      globalDateShiftId: undefined,
    } as const;

    render(<WasteMasterDataTabContent controller={controller} search={search} tab="fractions" />);

    expect(fractionsContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fractionsSortBy: 'name',
        fractionsSortDirection: 'asc',
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'sort-color-desc' }));

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: {
        ...search,
        fractionsSortBy: 'color',
        fractionsSortDirection: 'desc',
      },
    });
  });

  it('hydrates the fraction edit form from the route waste fraction id after a reload', () => {
    const controller = {
      filteredFractions: [],
      filteredRegions: [],
      filteredCities: [],
      filteredStreets: [],
      filteredHouseNumbers: [],
      filteredCollectionLocations: [],
      overview: {
        fractions: [
          {
            id: 'fraction-99',
            name: 'Papier',
            color: '#123456',
            description: 'Altpapier',
            containerSize: '240L',
            active: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        regions: [],
        cities: [],
        streets: [],
        houseNumbers: [],
        collectionLocations: [],
        locationTourLinks: [],
      },
      fractionForm: { id: 'stale-form-id' },
      locationForm: { id: 'location-form-1' },
      selectedLocationIds: [],
      allFilteredLocationsSelected: false,
      selectedCollectionLocations: [],
      availableTours: [],
      toggleSelectAllFilteredLocations: vi.fn(),
      toggleLocationSelection: vi.fn(),
      openCreateRegionDialog: vi.fn(),
      openCreateCityDialog: vi.fn(),
      openCreateStreetDialog: vi.fn(),
      openCreateHouseNumberDialog: vi.fn(),
      openCreateLocationDialog: vi.fn(),
      openEditRegionDialog: vi.fn(),
      openEditCityDialog: vi.fn(),
      openEditStreetDialog: vi.fn(),
      openEditHouseNumberDialog: vi.fn(),
      openBulkAssignmentsDialog: vi.fn(),
      openEditLocationDialog: vi.fn(),
      getLocationLabel: vi.fn(),
      setDialogOpen: vi.fn(),
      resetFractionForm: vi.fn(),
      setLastOutcome: vi.fn(),
      setDialogMode: vi.fn(),
      setFractionForm: vi.fn(),
      setMessage: vi.fn(),
      setLocationDialogMode: vi.fn(),
      setLocationForm: vi.fn(),
      setLocationDialogOpen: vi.fn(),
      resetLocationForm: vi.fn(),
    } as never;

    render(
      <WasteMasterDataTabContent
        controller={controller}
        search={{
          tab: 'fractions',
          masterDataTab: 'fractions',
          fractionsView: 'edit',
          toursView: 'list',
          locationsView: 'list',
          schedulingView: 'list',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'all',
          fractionsSortBy: 'name',
          fractionsSortDirection: 'asc',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: 'fraction-99',
          tourId: undefined,
          tourDateShiftId: undefined,
          globalDateShiftId: undefined,
        }}
        tab="fractions"
      />
    );

    expect(controller.setDialogMode).toHaveBeenCalledWith('edit');
    expect(controller.setFractionForm).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'fraction-99',
        name: 'Papier',
        color: '#123456',
        containerSize: '240L',
      })
    );
  });

  it('redirects stale fraction edit routes back to the list', () => {
    const controller = {
      filteredFractions: [],
      filteredRegions: [],
      filteredCities: [],
      filteredStreets: [],
      filteredHouseNumbers: [],
      filteredCollectionLocations: [],
      overview: {
        fractions: [],
        regions: [],
        cities: [],
        streets: [],
        houseNumbers: [],
        collectionLocations: [],
        locationTourLinks: [],
      },
      fractionForm: { id: 'stale-form-id' },
      locationForm: { id: 'location-form-1' },
      selectedLocationIds: [],
      allFilteredLocationsSelected: false,
      selectedCollectionLocations: [],
      availableTours: [],
      toggleSelectAllFilteredLocations: vi.fn(),
      toggleLocationSelection: vi.fn(),
      openCreateRegionDialog: vi.fn(),
      openCreateCityDialog: vi.fn(),
      openCreateStreetDialog: vi.fn(),
      openCreateHouseNumberDialog: vi.fn(),
      openCreateLocationDialog: vi.fn(),
      openEditRegionDialog: vi.fn(),
      openEditCityDialog: vi.fn(),
      openEditStreetDialog: vi.fn(),
      openEditHouseNumberDialog: vi.fn(),
      openBulkAssignmentsDialog: vi.fn(),
      openEditLocationDialog: vi.fn(),
      getLocationLabel: vi.fn(),
      setDialogOpen: vi.fn(),
      resetFractionForm: vi.fn(),
      setLastOutcome: vi.fn(),
      setDialogMode: vi.fn(),
      setFractionForm: vi.fn(),
      setMessage: vi.fn(),
      setLocationDialogMode: vi.fn(),
      setLocationForm: vi.fn(),
      setLocationDialogOpen: vi.fn(),
      resetLocationForm: vi.fn(),
    } as never;

    render(
      <WasteMasterDataTabContent
        controller={controller}
        search={{
          tab: 'fractions',
          masterDataTab: 'fractions',
          fractionsView: 'edit',
          toursView: 'list',
          locationsView: 'list',
          schedulingView: 'list',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'all',
          fractionsSortBy: 'name',
          fractionsSortDirection: 'asc',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: 'fraction-missing',
          collectionLocationId: undefined,
          tourId: undefined,
          tourDateShiftId: undefined,
          globalDateShiftId: undefined,
        }}
        tab="fractions"
      />
    );

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({ fractionsView: 'list', wasteFractionId: undefined }),
      replace: true,
    });
  });

  it('does not redirect fraction edit deep links before the overview has loaded', () => {
    const controller = {
      filteredFractions: [],
      filteredRegions: [],
      filteredCities: [],
      filteredStreets: [],
      filteredHouseNumbers: [],
      filteredCollectionLocations: [],
      overview: null,
      fractionForm: { id: 'stale-form-id' },
      locationForm: { id: 'location-form-1' },
      selectedLocationIds: [],
      allFilteredLocationsSelected: false,
      selectedCollectionLocations: [],
      availableTours: [],
      toggleSelectAllFilteredLocations: vi.fn(),
      toggleLocationSelection: vi.fn(),
      openCreateRegionDialog: vi.fn(),
      openCreateCityDialog: vi.fn(),
      openCreateStreetDialog: vi.fn(),
      openCreateHouseNumberDialog: vi.fn(),
      openCreateLocationDialog: vi.fn(),
      openEditRegionDialog: vi.fn(),
      openEditCityDialog: vi.fn(),
      openEditStreetDialog: vi.fn(),
      openEditHouseNumberDialog: vi.fn(),
      openBulkAssignmentsDialog: vi.fn(),
      openEditLocationDialog: vi.fn(),
      getLocationLabel: vi.fn(),
      setDialogOpen: vi.fn(),
      resetFractionForm: vi.fn(),
      setLastOutcome: vi.fn(),
      setDialogMode: vi.fn(),
      setFractionForm: vi.fn(),
      setMessage: vi.fn(),
      setLocationDialogMode: vi.fn(),
      setLocationForm: vi.fn(),
      setLocationDialogOpen: vi.fn(),
      resetLocationForm: vi.fn(),
    } as never;

    render(
      <WasteMasterDataTabContent
        controller={controller}
        search={{
          tab: 'fractions',
          masterDataTab: 'fractions',
          fractionsView: 'edit',
          toursView: 'list',
          locationsView: 'list',
          schedulingView: 'list',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'all',
          fractionsSortBy: 'name',
          fractionsSortDirection: 'asc',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: 'fraction-99',
          collectionLocationId: undefined,
          tourId: undefined,
          tourDateShiftId: undefined,
          globalDateShiftId: undefined,
        }}
        tab="fractions"
      />
    );

    expect(navigateMock).not.toHaveBeenCalled();
    expect(controller.setFractionForm).not.toHaveBeenCalled();
  });

  it('hydrates the location edit form from the route collection location id after a reload', () => {
    const controller = {
      filteredFractions: [],
      filteredRegions: [],
      filteredCities: [],
      filteredStreets: [],
      filteredHouseNumbers: [],
      filteredCollectionLocations: [],
      overview: {
        fractions: [],
        regions: [],
        cities: [],
        streets: [],
        houseNumbers: [],
        collectionLocations: [
          {
            id: 'location-99',
            regionId: 'region-1',
            cityId: 'city-1',
            streetId: 'street-1',
            houseNumberId: 'house-1',
            active: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        locationTourLinks: [],
      },
      fractionForm: { id: 'fraction-form-1' },
      locationForm: { id: 'stale-location-id' },
      selectedLocationIds: [],
      allFilteredLocationsSelected: false,
      selectedCollectionLocations: [],
      availableTours: [],
      toggleSelectAllFilteredLocations: vi.fn(),
      toggleLocationSelection: vi.fn(),
      openCreateRegionDialog: vi.fn(),
      openCreateCityDialog: vi.fn(),
      openCreateStreetDialog: vi.fn(),
      openCreateHouseNumberDialog: vi.fn(),
      openCreateLocationDialog: vi.fn(),
      openEditRegionDialog: vi.fn(),
      openEditCityDialog: vi.fn(),
      openEditStreetDialog: vi.fn(),
      openEditHouseNumberDialog: vi.fn(),
      openBulkAssignmentsDialog: vi.fn(),
      openEditLocationDialog: vi.fn(),
      getLocationLabel: vi.fn(),
      setLocationDialogMode: vi.fn(),
      setLocationForm: vi.fn(),
      setLastOutcome: vi.fn(),
      setMessage: vi.fn(),
      setLocationDialogOpen: vi.fn(),
      resetLocationForm: vi.fn(),
    } as never;

    render(
      <WasteMasterDataTabContent
        controller={controller}
        search={{
          tab: 'locations',
          masterDataTab: 'locations',
          fractionsView: 'list',
          toursView: 'list',
          locationsView: 'edit',
          schedulingView: 'list',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'all',
          fractionsSortBy: 'name',
          fractionsSortDirection: 'asc',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: undefined,
          collectionLocationId: 'location-99',
          tourId: undefined,
          tourDateShiftId: undefined,
          globalDateShiftId: undefined,
        }}
        tab="locations"
      />
    );

    expect(controller.setLocationDialogMode).toHaveBeenCalledWith('edit');
    expect(controller.setLocationForm).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'location-99',
      })
    );
  });

  it('does not redirect location edit deep links before the overview has loaded', () => {
    const controller = {
      filteredFractions: [],
      filteredRegions: [],
      filteredCities: [],
      filteredStreets: [],
      filteredHouseNumbers: [],
      filteredCollectionLocations: [],
      overview: null,
      fractionForm: { id: 'fraction-form-1' },
      locationForm: { id: 'stale-location-id' },
      selectedLocationIds: [],
      allFilteredLocationsSelected: false,
      selectedCollectionLocations: [],
      availableTours: [],
      toggleSelectAllFilteredLocations: vi.fn(),
      toggleLocationSelection: vi.fn(),
      openCreateRegionDialog: vi.fn(),
      openCreateCityDialog: vi.fn(),
      openCreateStreetDialog: vi.fn(),
      openCreateHouseNumberDialog: vi.fn(),
      openCreateLocationDialog: vi.fn(),
      openEditRegionDialog: vi.fn(),
      openEditCityDialog: vi.fn(),
      openEditStreetDialog: vi.fn(),
      openEditHouseNumberDialog: vi.fn(),
      openBulkAssignmentsDialog: vi.fn(),
      openEditLocationDialog: vi.fn(),
      getLocationLabel: vi.fn(),
      setLocationDialogMode: vi.fn(),
      setLocationForm: vi.fn(),
      setLastOutcome: vi.fn(),
      setMessage: vi.fn(),
      setLocationDialogOpen: vi.fn(),
      resetLocationForm: vi.fn(),
    } as never;

    render(
      <WasteMasterDataTabContent
        controller={controller}
        search={{
          tab: 'locations',
          masterDataTab: 'locations',
          fractionsView: 'list',
          toursView: 'list',
          locationsView: 'edit',
          schedulingView: 'list',
          q: '',
          page: 1,
          pageSize: 25,
          status: 'all',
          shiftContext: 'all',
          fractionsSortBy: 'name',
          fractionsSortDirection: 'asc',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: undefined,
          collectionLocationId: 'location-99',
          tourId: undefined,
          tourDateShiftId: undefined,
          globalDateShiftId: undefined,
        }}
        tab="locations"
      />
    );

    expect(navigateMock).not.toHaveBeenCalled();
    expect(controller.setLocationForm).not.toHaveBeenCalled();
  });
});
