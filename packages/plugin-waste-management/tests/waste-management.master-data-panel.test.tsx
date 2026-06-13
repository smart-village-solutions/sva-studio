import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { WasteMasterDataPanel } from '../src/waste-management.master-data-panel.js';

const navigateMock = vi.fn();

const controllerState = {
  loading: false,
  error: null,
  message: null,
  overview: {
    fractions: [{ id: 'fraction-1', name: 'Restmüll', active: true }],
    regions: [{ id: 'region-1', name: 'Nord' }],
    cities: [{ id: 'city-1', name: 'Musterstadt', regionId: 'region-1' }],
    streets: [{ id: 'street-1', name: 'Hauptstraße', cityId: 'city-1' }],
    houseNumbers: [{ id: 'house-1', number: '12', streetId: 'street-1' }],
    collectionLocations: [{ id: 'location-1', cityId: 'city-1', active: true }],
    locationTourLinks: [],
  },
  filteredFractions: [{ id: 'fraction-1', name: 'Restmüll', active: true }],
  filteredRegions: [{ id: 'region-1', name: 'Nord' }],
  filteredCities: [{ id: 'city-1', name: 'Musterstadt', regionId: 'region-1' }],
  filteredStreets: [{ id: 'street-1', name: 'Hauptstraße', cityId: 'city-1' }],
  filteredHouseNumbers: [{ id: 'house-1', number: '12', streetId: 'street-1' }],
  filteredCollectionLocations: [{ id: 'location-1', cityId: 'city-1', active: true }],
  fractionForm: { id: 'fraction-form-1' },
  selectedLocationIds: [],
  selectedCollectionLocations: [],
  allFilteredLocationsSelected: false,
  availableTours: [{ id: 'tour-1', name: 'Tour 1' }],
  getLocationLabel: () => 'Nord / Musterstadt / Hauptstraße / 12',
  openCreateDialog: vi.fn(),
  openCreateRegionDialog: vi.fn(),
  openCreateCityDialog: vi.fn(),
  openCreateStreetDialog: vi.fn(),
  openCreateHouseNumberDialog: vi.fn(),
  openEditDialog: vi.fn(),
  openEditRegionDialog: vi.fn(),
  openEditCityDialog: vi.fn(),
  openEditStreetDialog: vi.fn(),
  openEditHouseNumberDialog: vi.fn(),
  toggleSelectAllFilteredLocations: vi.fn(),
  toggleLocationSelection: vi.fn(),
  openCreateLocationDialog: vi.fn(),
  openBulkAssignmentsDialog: vi.fn(),
  openEditLocationDialog: vi.fn(),
  setDialogOpen: vi.fn(),
  resetFractionForm: vi.fn(),
  setLastOutcome: vi.fn(),
  setDialogMode: vi.fn(),
  setFractionForm: vi.fn(),
  setMessage: vi.fn(),
};

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
  wasteManagementMasterDataContract: {
    fractionReminderLeadDayMin: 1,
    fractionReminderLeadDayMax: 14,
  },
}));

vi.mock('@sva/studio-ui-react', () => ({
  StudioErrorState: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  StudioLoadingState: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  Tabs: ({
    value,
    onValueChange,
    children,
  }: {
    readonly value: string;
    readonly onValueChange: (value: string) => void;
    readonly children: React.ReactNode;
  }) => (
    <div data-value={value}>
      <button onClick={() => onValueChange('fractions')}>switch-fractions</button>
      <button onClick={() => onValueChange('locations')}>switch-locations</button>
      {children}
    </div>
  ),
  TabsList: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ value, children }: { readonly value: string; readonly children: React.ReactNode }) => (
    <button role="tab" data-state={value === 'locations' ? 'active' : 'inactive'}>
      {children}
    </button>
  ),
  TabsContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../src/waste-management.master-data.controller.js', () => ({
  useWasteMasterDataController: () => controllerState,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  StatusNotice: () => <div>status-notice</div>,
}));

vi.mock('../src/waste-management.master-data-dialogs.js', () => ({
  WasteMasterDataDialogs: () => <div>dialogs</div>,
}));

vi.mock('../src/waste-management.master-data-empty-state.js', () => ({
  WasteMasterDataEmptyState: () => <div>empty-state</div>,
}));

vi.mock('../src/waste-management.master-data-fractions-content.js', () => ({
  WasteMasterDataFractionsContent: () => <div>masterData.fractions.title</div>,
}));

vi.mock('../src/waste-management.master-data-locations-workspace.js', () => ({
  WasteMasterDataLocationsWorkspace: () => <div>masterData.locationsWorkspace.title</div>,
}));

describe('WasteMasterDataPanel', () => {
  beforeEach(() => {
    cleanup();
    navigateMock.mockReset();
    controllerState.overview = {
      fractions: [{ id: 'fraction-1', name: 'Restmüll', active: true }],
      regions: [{ id: 'region-1', name: 'Nord' }],
      cities: [{ id: 'city-1', name: 'Musterstadt', regionId: 'region-1' }],
      streets: [{ id: 'street-1', name: 'Hauptstraße', cityId: 'city-1' }],
      houseNumbers: [{ id: 'house-1', number: '12', streetId: 'street-1' }],
      collectionLocations: [{ id: 'location-1', cityId: 'city-1', active: true }],
      locationTourLinks: [],
    };
    controllerState.filteredFractions = [{ id: 'fraction-1', name: 'Restmüll', active: true }];
    controllerState.filteredRegions = [{ id: 'region-1', name: 'Nord' }];
    controllerState.filteredCities = [{ id: 'city-1', name: 'Musterstadt', regionId: 'region-1' }];
    controllerState.filteredStreets = [{ id: 'street-1', name: 'Hauptstraße', cityId: 'city-1' }];
    controllerState.filteredHouseNumbers = [{ id: 'house-1', number: '12', streetId: 'street-1' }];
    controllerState.filteredCollectionLocations = [{ id: 'location-1', cityId: 'city-1', active: true }];
  });

  it('renders the fractions workspace directly for the fractions top-level tab', () => {
    render(
      <WasteMasterDataPanel
        tab="fractions"
        search={{
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
        }}
      />
    );

    expect(screen.getByText('masterData.fractions.title')).toBeTruthy();
    expect(screen.queryByText('masterData.locationsWorkspace.title')).toBeNull();
  });

  it('renders the locations workspace directly for the collection locations top-level tab', () => {
    render(
      <WasteMasterDataPanel
        tab="locations"
        search={{
          tab: 'locations',
          masterDataTab: 'locations',
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
        }}
      />
    );

    expect(screen.getByText('masterData.locationsWorkspace.title')).toBeTruthy();
    expect(screen.queryByText('masterData.fractions.title')).toBeNull();
  });

  it('keeps the fractions workspace visible when filters hide all results but overview data still exists', () => {
    controllerState.filteredFractions = [];
    controllerState.filteredRegions = [];
    controllerState.filteredCities = [];
    controllerState.filteredStreets = [];
    controllerState.filteredHouseNumbers = [];
    controllerState.filteredCollectionLocations = [];

    render(
      <WasteMasterDataPanel
        tab="fractions"
        search={{
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
          fractionsStatus: 'inactive',
          regionId: undefined,
          cityId: undefined,
          wasteFractionId: undefined,
          tourId: undefined,
          tourDateShiftId: undefined,
          globalDateShiftId: undefined,
        }}
      />
    );

    expect(screen.getByText('masterData.fractions.title')).toBeTruthy();
    expect(screen.queryByText('empty-state')).toBeNull();
  });
});
