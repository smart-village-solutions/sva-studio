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
});
