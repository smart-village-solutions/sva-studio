import React from 'react';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteManagementApiError } from '../src/waste-management.api.js';
import { WasteSettingsPanel } from '../src/waste-management.settings-panel.js';
import { useWasteMasterDataOverview } from '../src/use-waste-master-data-overview.js';
import { useWasteMasterDataState } from '../src/use-waste-master-data-state.js';
import { useWasteCollectionLocationList } from '../src/use-waste-collection-location-list.js';
import { useWasteSchedulingOverview } from '../src/use-waste-scheduling-overview.js';
import { useWasteSchedulingState } from '../src/use-waste-scheduling-state.js';
import { useWasteToursOverview } from '../src/use-waste-tours-overview.js';
import { useWasteToursState } from '../src/use-waste-tours-state.js';

const apiMocks = vi.hoisted(() => ({
  getWasteManagementMasterDataOverview: vi.fn(),
  getWasteCollectionLocationIds: vi.fn(),
  getWasteCollectionLocationPage: vi.fn(),
  getWasteManagementSchedulingOverview: vi.fn(),
  getWasteManagementSettings: vi.fn(),
  getWasteManagementToursOverview: vi.fn(),
  updateWasteManagementSettings: vi.fn(),
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
  wasteManagementMasterDataContract: {
    fractionReminderLeadDayMin: 1,
  },
}));

vi.mock('@sva/studio-ui-react', async () => ({
  ...(await vi.importActual<typeof import('@sva/studio-ui-react')>('@sva/studio-ui-react')),
  StudioErrorState: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  StudioLoadingState: ({ children }: { readonly children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('../src/waste-management.api.js', async () => {
  const actual = await vi.importActual<typeof import('../src/waste-management.api.js')>(
    '../src/waste-management.api.js'
  );

  return {
    ...actual,
    ...apiMocks,
  };
});

vi.mock('../src/waste-management.page.support.js', async () => {
  const actual = await vi.importActual<typeof import('../src/waste-management.page.support.js')>(
    '../src/waste-management.page.support.js'
  );

  return {
    ...actual,
    StatusNotice: () => <div>status-notice</div>,
  };
});

vi.mock('../src/waste-management.settings-form.js', () => ({
  WasteSettingsForm: () => <form>settings-form</form>,
}));

vi.mock('../src/waste-management.settings-status-panel.js', () => ({
  WasteSettingsStatusPanel: () => <div>settings-status</div>,
}));

const createForbiddenError = () => new WasteManagementApiError('forbidden');

const MasterDataLoaderHarness = () => {
  const state = useWasteMasterDataState();
  useWasteMasterDataOverview(state, (key) => key, 'fractions');

  return <div>{state.error ?? (state.loading ? 'loading' : 'loaded')}</div>;
};

const LocationsMasterDataLoaderHarness = () => {
  const state = useWasteMasterDataState();
  useWasteMasterDataOverview(state, (key) => key, 'locations');

  return (
    <div>
      <span>{state.error ?? (state.loading ? 'loading' : 'loaded')}</span>
      <span data-testid="coverage-fractions-state">
        {state.locationCoverageFractionsStatus}:{state.locationCoverageFractions.length}
      </span>
    </div>
  );
};

const DynamicMasterDataLoaderHarness = ({ tab }: { readonly tab: 'fractions' | 'locations' }) => {
  const state = useWasteMasterDataState();
  useWasteMasterDataOverview(state, (key) => key, tab);

  return <div>{state.error ?? (state.loading ? 'loading' : 'loaded')}</div>;
};

const CollectionLocationLoaderHarness = () => {
  const state = useWasteMasterDataState();
  useWasteMasterDataOverview(state, (key) => key, 'locations');
  useWasteCollectionLocationList(state, (key) => key, {
    tab: 'locations',
    masterDataTab: 'locations',
    locationsView: 'list',
    q: '',
    status: 'all',
    regionId: undefined,
    cityId: undefined,
    tourId: undefined,
    locationSortMode: 'address',
    locationSortDirection: 'asc',
    page: 1,
    pageSize: 25,
  } as never);

  return <div>{state.error ?? (state.loading ? 'loading' : 'loaded')}</div>;
};

const ToursLoaderHarness = () => {
  const state = useWasteToursState();
  useWasteToursOverview(state, (key) => key);

  return <div>{state.error ?? (state.loading ? 'loading' : 'loaded')}</div>;
};

const SchedulingLoaderHarness = () => {
  const state = useWasteSchedulingState();
  useWasteSchedulingOverview(state, (key) => key);

  return <div>{state.error ?? (state.loading ? 'loading' : 'loaded')}</div>;
};

describe('waste management data loaders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps the master-data loader on a single failed fetch cycle', async () => {
    apiMocks.getWasteManagementMasterDataOverview.mockRejectedValue(createForbiddenError());

    render(<MasterDataLoaderHarness />);

    await waitFor(() => {
      expect(screen.getByText('masterData.messages.loadForbidden')).toBeTruthy();
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(1);
    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledWith({
      scope: 'fractions',
    });
    expect(apiMocks.getWasteManagementToursOverview).toHaveBeenCalledTimes(0);
  });

  it('keeps an overview failure visible when the concurrent location list succeeds later', async () => {
    let resolvePage: ((value: object) => void) | undefined;
    apiMocks.getWasteManagementMasterDataOverview.mockRejectedValue(new Error('overview failed'));
    apiMocks.getWasteCollectionLocationPage.mockImplementation(
      () => new Promise((resolve) => (resolvePage = resolve))
    );

    render(<CollectionLocationLoaderHarness />);

    await waitFor(() => {
      expect(screen.getByText('masterData.messages.loadError')).toBeTruthy();
    });

    resolvePage?.({ items: [], page: 1, pageSize: 25, total: 0, pageCount: 0 });

    await waitFor(() => {
      expect(apiMocks.getWasteCollectionLocationPage).toHaveBeenCalledTimes(1);
    });
    expect(apiMocks.getWasteCollectionLocationIds).not.toHaveBeenCalled();
    expect(screen.getByText('masterData.messages.loadError')).toBeTruthy();
  });

  it('keeps a location-list failure visible when the concurrent overview succeeds later', async () => {
    let resolveOverview: ((value: object) => void) | undefined;
    apiMocks.getWasteManagementMasterDataOverview.mockImplementation(
      () => new Promise((resolve) => (resolveOverview = resolve))
    );
    apiMocks.getWasteCollectionLocationPage.mockRejectedValue(new Error('list failed'));

    render(<CollectionLocationLoaderHarness />);

    await waitFor(() => {
      expect(apiMocks.getWasteCollectionLocationPage).toHaveBeenCalledTimes(1);
    });

    resolveOverview?.({
      fractions: [],
      regions: [],
      cities: [],
      streets: [],
      houseNumbers: [],
      collectionLocations: [],
      locationTourLinks: [],
    });

    await waitFor(() => {
      expect(screen.getByText('masterData.messages.loadError')).toBeTruthy();
    });
  });

  it('retains filtered ids across page and sort reloads and clears them for filters or refreshes', async () => {
    apiMocks.getWasteCollectionLocationPage.mockImplementation(() => new Promise(() => undefined));
    let resolveIds: ((value: readonly string[]) => void) | undefined;
    apiMocks.getWasteCollectionLocationIds.mockImplementation(
      () => new Promise((resolve) => (resolveIds = resolve))
    );
    const setCollectionLocationPage = vi.fn();
    const setFilteredLocationIds = vi.fn();

    const state = {
      setCollectionLocationListError: vi.fn(),
      setCollectionLocationPage,
      setFilteredLocationIds,
    } as never;
    const initialSearch = {
      tab: 'locations',
      masterDataTab: 'locations',
      locationsView: 'list',
      q: 'neue Suche',
      status: 'all',
      locationSortMode: 'address',
      locationSortDirection: 'asc',
      page: 2,
      pageSize: 25,
    } as never;
    const { result, rerender } = renderHook(
      ({ search }) => useWasteCollectionLocationList(state, (key) => key, search),
      { initialProps: { search: initialSearch } }
    );

    await waitFor(() => {
      expect(apiMocks.getWasteCollectionLocationPage).toHaveBeenCalledOnce();
    });
    expect(setCollectionLocationPage).toHaveBeenCalledWith(null);
    expect(setFilteredLocationIds).toHaveBeenCalledWith([]);
    expect(apiMocks.getWasteCollectionLocationIds).not.toHaveBeenCalled();

    let loadedIds: readonly string[] | null = null;
    await act(async () => {
      const request = result.current.loadFilteredLocationIds();
      resolveIds?.(['location-1', 'location-2']);
      loadedIds = await request;
    });
    expect(loadedIds).toEqual(['location-1', 'location-2']);
    expect(setFilteredLocationIds).toHaveBeenLastCalledWith(['location-1', 'location-2']);

    setFilteredLocationIds.mockClear();
    rerender({
      search: {
        ...initialSearch,
        page: 3,
        locationSortDirection: 'desc',
      } as never,
    });
    await waitFor(() => {
      expect(apiMocks.getWasteCollectionLocationPage).toHaveBeenCalledTimes(2);
    });
    expect(setFilteredLocationIds).not.toHaveBeenCalled();

    apiMocks.getWasteCollectionLocationPage.mockResolvedValueOnce({
      items: [],
      page: 3,
      pageSize: 25,
      total: 0,
      pageCount: 0,
    });
    await act(async () => result.current.refreshList());
    expect(setFilteredLocationIds).toHaveBeenCalledWith([]);

    setFilteredLocationIds.mockClear();
    rerender({
      search: {
        ...initialSearch,
        q: 'anderer Filter',
      } as never,
    });
    await waitFor(() => {
      expect(setFilteredLocationIds).toHaveBeenCalledWith([]);
    });
  });

  it('stops the location loader while its tab is hidden and reloads when it becomes active', async () => {
    apiMocks.getWasteCollectionLocationPage.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
      pageCount: 0,
    });
    const state = {
      setCollectionLocationListError: vi.fn(),
      setCollectionLocationPage: vi.fn(),
      setFilteredLocationIds: vi.fn(),
    } as never;
    const activeSearch = {
      tab: 'locations',
      masterDataTab: 'locations',
      locationsView: 'list',
      q: '',
      status: 'all',
      locationSortMode: 'address',
      locationSortDirection: 'asc',
      page: 1,
      pageSize: 25,
    } as never;
    const { rerender } = renderHook(
      ({ search }) => useWasteCollectionLocationList(state, (key) => key, search),
      { initialProps: { search: activeSearch } }
    );

    await waitFor(() => {
      expect(apiMocks.getWasteCollectionLocationPage).toHaveBeenCalledOnce();
    });

    rerender({ search: { ...activeSearch, tab: 'tours', q: 'hidden change' } as never });
    await waitFor(() => {
      expect(state.setCollectionLocationListError).toHaveBeenLastCalledWith(null);
    });
    expect(apiMocks.getWasteCollectionLocationPage).toHaveBeenCalledOnce();

    rerender({ search: activeSearch });
    await waitFor(() => {
      expect(apiMocks.getWasteCollectionLocationPage).toHaveBeenCalledTimes(2);
    });
  });

  it('keeps the tours loader on a single failed fetch cycle', async () => {
    apiMocks.getWasteManagementToursOverview.mockRejectedValue(createForbiddenError());
    apiMocks.getWasteManagementMasterDataOverview.mockResolvedValue({ fractions: [] });
    apiMocks.getWasteManagementSchedulingOverview.mockResolvedValue({
      globalDateShifts: [],
      locationTourPickupDates: [],
      tourDateShifts: [],
    });

    render(<ToursLoaderHarness />);

    await waitFor(() => {
      expect(screen.getByText('tours.messages.loadForbidden')).toBeTruthy();
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(apiMocks.getWasteManagementToursOverview).toHaveBeenCalledTimes(1);
    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(1);
    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledWith({
      scope: 'fractions',
    });
    expect(apiMocks.getWasteManagementSchedulingOverview).toHaveBeenCalledTimes(0);
  });

  it('loads location master data through the scoped locations endpoint and tours separately', async () => {
    apiMocks.getWasteManagementMasterDataOverview.mockImplementation(
      async (options?: { readonly scope?: string }) =>
        options?.scope === 'fractions'
          ? { fractions: [{ id: 'fraction-1' }] }
          : {
              fractions: [],
              regions: [],
              cities: [],
              streets: [],
              houseNumbers: [],
              collectionLocations: [],
              locationTourLinks: [],
            }
    );
    apiMocks.getWasteManagementToursOverview.mockResolvedValue({ tours: [] });

    render(<LocationsMasterDataLoaderHarness />);

    await waitFor(() => {
      expect(screen.getByText('loaded')).toBeTruthy();
    });

    await waitFor(() => {
      expect(apiMocks.getWasteManagementToursOverview).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('coverage-fractions-state').textContent).toBe('ready:1');
    });

    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(2);
    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenNthCalledWith(1, {
      scope: 'locations',
    });
    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenNthCalledWith(2, {
      scope: 'fractions',
    });
  });

  it('keeps location master data usable when the coverage fractions fail to load', async () => {
    apiMocks.getWasteManagementMasterDataOverview.mockImplementation(
      async (options?: { readonly scope?: string }) => {
        if (options?.scope === 'fractions') {
          throw new Error('fractions failed');
        }

        return {
          fractions: [],
          regions: [],
          cities: [],
          streets: [],
          houseNumbers: [],
          collectionLocations: [],
          locationTourLinks: [],
        };
      }
    );
    apiMocks.getWasteManagementToursOverview.mockResolvedValue({ tours: [] });

    render(<LocationsMasterDataLoaderHarness />);

    await waitFor(() => {
      expect(screen.getByText('loaded')).toBeTruthy();
      expect(screen.getByTestId('coverage-fractions-state').textContent).toBe('error:0');
    });

    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(2);
  });

  it('reloads the master-data overview when the active tab scope changes', async () => {
    apiMocks.getWasteManagementMasterDataOverview
      .mockResolvedValueOnce({
        fractions: [],
      })
      .mockResolvedValueOnce({
        fractions: [],
        regions: [],
        cities: [],
        streets: [],
        houseNumbers: [],
        collectionLocations: [],
        locationTourLinks: [],
      });
    apiMocks.getWasteManagementToursOverview.mockResolvedValue({ tours: [] });

    const { rerender } = render(<DynamicMasterDataLoaderHarness tab="fractions" />);

    await waitFor(() => {
      expect(screen.getByText('loaded')).toBeTruthy();
    });

    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenNthCalledWith(1, {
      scope: 'fractions',
    });

    rerender(<DynamicMasterDataLoaderHarness tab="locations" />);

    await waitFor(() => {
      expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenNthCalledWith(2, {
        scope: 'locations',
      });
    });
  });

  it('keeps the scheduling loader on a single failed fetch cycle', async () => {
    apiMocks.getWasteManagementSchedulingOverview.mockRejectedValue(createForbiddenError());

    render(<SchedulingLoaderHarness />);

    await waitFor(() => {
      expect(screen.getByText('scheduling.messages.loadForbidden')).toBeTruthy();
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(apiMocks.getWasteManagementSchedulingOverview).toHaveBeenCalledTimes(1);
    expect(apiMocks.getWasteManagementToursOverview).toHaveBeenCalledTimes(0);
    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(0);
  });

  it('loads the scheduling overview first and fetches tours plus locations in the background', async () => {
    apiMocks.getWasteManagementSchedulingOverview.mockResolvedValue({
      holidayRules: [],
      globalDateShifts: [],
      locationTourPickupDates: [],
      tourDateShifts: [],
    });
    apiMocks.getWasteManagementToursOverview.mockResolvedValue({ tours: [] });
    apiMocks.getWasteManagementMasterDataOverview.mockResolvedValue({
      fractions: [],
      regions: [],
      cities: [],
      streets: [],
      houseNumbers: [],
      collectionLocations: [],
      locationTourLinks: [],
    });

    render(<SchedulingLoaderHarness />);

    await waitFor(() => {
      expect(screen.getByText('loaded')).toBeTruthy();
    });

    await waitFor(() => {
      expect(apiMocks.getWasteManagementToursOverview).toHaveBeenCalledTimes(1);
      expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(1);
    });

    expect(apiMocks.getWasteManagementSchedulingOverview).toHaveBeenCalledTimes(1);
    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledWith({
      scope: 'locations',
    });
  });

  it('loads tour fractions first and the location assignment context in the background', async () => {
    apiMocks.getWasteManagementToursOverview.mockResolvedValue({ tours: [] });
    apiMocks.getWasteManagementMasterDataOverview
      .mockResolvedValueOnce({
        fractions: [{ id: 'fraction-1' }],
        regions: [],
        cities: [],
        streets: [],
        houseNumbers: [],
        collectionLocations: [],
        locationTourLinks: [],
      })
      .mockResolvedValueOnce({
        fractions: [],
        regions: [{ id: 'region-1' }],
        cities: [],
        streets: [],
        houseNumbers: [],
        collectionLocations: [{ id: 'location-1' }],
        locationTourLinks: [{ id: 'link-1' }],
      });
    apiMocks.getWasteManagementSchedulingOverview.mockResolvedValue({
      globalDateShifts: [],
      locationTourPickupDates: [],
      tourDateShifts: [],
    });

    render(<ToursLoaderHarness />);

    await waitFor(() => {
      expect(screen.getByText('loaded')).toBeTruthy();
    });

    await waitFor(() => {
      expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenCalledTimes(2);
      expect(apiMocks.getWasteManagementSchedulingOverview).toHaveBeenCalledTimes(1);
    });

    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenNthCalledWith(1, {
      scope: 'fractions',
    });
    expect(apiMocks.getWasteManagementMasterDataOverview).toHaveBeenNthCalledWith(2, {
      scope: 'locations',
    });
  });

  it('keeps the settings loader on a single failed fetch cycle', async () => {
    apiMocks.getWasteManagementSettings.mockRejectedValue(createForbiddenError());

    render(<WasteSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText('settings.messages.loadForbidden')).toBeTruthy();
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(apiMocks.getWasteManagementSettings).toHaveBeenCalledTimes(1);
  });
});
