import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WasteManagementSearchParams } from '../src/search-params.js';
import { useWasteLocationsTabNavigation } from '../src/waste-management.master-data-locations-tab-view.helpers.js';
import type { useWasteMasterDataViewModel } from '../src/use-waste-master-data-view-model.js';

const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

type WasteViewModel = ReturnType<typeof useWasteMasterDataViewModel>;

const createSearch = (): WasteManagementSearchParams => ({
  tab: 'locations',
  masterDataTab: 'locations',
  fractionsView: 'list',
  toursView: 'list',
  locationsView: 'list',
  schedulingView: 'list',
  q: 'Nord',
  page: 3,
  pageSize: 25,
  status: 'active',
  tourValidityPeriod: 'all',
  shiftContext: 'all',
  fractionsSortBy: 'name',
  fractionsSortDirection: 'asc',
  locationSortMode: 'address',
  locationSortDirection: 'asc',
  regionId: 'region-1',
  cityId: 'city-1',
  wasteFractionId: undefined,
  tourId: 'tour-1',
  collectionLocationId: 'location-1',
  tourDateShiftId: undefined,
  globalDateShiftId: undefined,
});

const createController = (overrides: Partial<WasteViewModel> = {}): WasteViewModel =>
  ({
    setLocationDialogMode: vi.fn(),
    setLocationDialogOpen: vi.fn(),
    setLocationForm: vi.fn(),
    resetLocationForm: vi.fn(),
    setMessage: vi.fn(),
    setLastOutcome: vi.fn(),
    ...overrides,
  }) as WasteViewModel;

describe('useWasteLocationsTabNavigation', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('clears collection-location filters without leaving the list', () => {
    const search = { ...createSearch(), locationYear: 2027, locationTourStatus: 'draft' as const };
    const { result } = renderHook(() => useWasteLocationsTabNavigation(createController(), search));
    act(() => result.current.resetFilters());
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({
        tab: 'locations',
        q: '',
        status: 'all',
        regionId: undefined,
        cityId: undefined,
        tourId: undefined,
        locationYear: undefined,
        locationTourStatus: undefined,
        page: 1,
      }),
    });
  });

  it('keeps the year on edit and clears an incompatible selected tour when changing years', () => {
    const controller = createController({
      availableTours: [{ id: 'tour-1', firstDate: '2026-01-01', endDate: '2026-12-31' }] as never,
    });
    const search = { ...createSearch(), locationYear: 2026 };
    const { result } = renderHook(() => useWasteLocationsTabNavigation(controller, search));
    act(() => result.current.setLocationYear(2027));
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: { ...search, locationYear: 2027, page: 1, tourId: undefined },
    });
    const nextSearch = {
      ...search,
      locationYear: 2027,
      locationTourStatus: 'draft' as const,
      tourId: undefined,
    };
    const { result: updatedNavigation } = renderHook(() =>
      useWasteLocationsTabNavigation(controller, nextSearch)
    );
    act(() => updatedNavigation.current.toList());
    expect(navigateMock).toHaveBeenLastCalledWith({
      to: '/plugins/waste-management',
      search: { ...nextSearch, locationsView: 'list', collectionLocationId: undefined },
    });
  });

  it('clears a selected published tour when filtering for drafts', () => {
    const controller = createController({
      availableTours: [{ id: 'tour-1', status: 'published', firstDate: '2027-01-07' }] as never,
    });
    const search = { ...createSearch(), locationYear: 2027 };
    const { result } = renderHook(() => useWasteLocationsTabNavigation(controller, search));
    act(() => result.current.setLocationTourStatus('draft'));
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: { ...search, locationTourStatus: 'draft', page: 1, tourId: undefined },
    });
  });

  it('resets dialog state and navigates back to the list', () => {
    const controller = createController();
    const search = createSearch();
    const { result } = renderHook(() => useWasteLocationsTabNavigation(controller, search));

    act(() => {
      result.current.toList();
    });

    expect(controller.setLocationDialogOpen).toHaveBeenCalledWith(false);
    expect(controller.resetLocationForm).toHaveBeenCalledTimes(1);
    expect(controller.setMessage).toHaveBeenCalledWith(null);
    expect(controller.setLastOutcome).toHaveBeenCalledWith(null);
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: { ...search, locationsView: 'list', collectionLocationId: undefined },
    });
  });

  it('prefills create and copy flows from search params and source location data', () => {
    const controller = createController();
    const search = createSearch();
    const { result } = renderHook(() => useWasteLocationsTabNavigation(controller, search));

    act(() => {
      result.current.toCreate();
    });

    expect(controller.setLocationDialogMode).toHaveBeenCalledWith('create');
    expect(controller.setLocationForm).toHaveBeenCalledWith(
      expect.objectContaining({
        regionId: 'region-1',
        cityId: 'city-1',
      })
    );
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: { ...search, locationsView: 'create', collectionLocationId: undefined },
    });

    const location = {
      id: 'location-7',
      regionId: 'region-2',
      cityId: 'city-2',
      streetId: 'street-2',
      houseNumberId: 'house-2',
      active: false,
      createdAt: '',
      updatedAt: '',
    };

    act(() => {
      result.current.toCopy(location);
    });

    expect(controller.setLocationDialogMode).toHaveBeenLastCalledWith('create');
    expect(controller.setLocationForm).toHaveBeenLastCalledWith(
      expect.objectContaining({
        regionId: 'region-2',
        cityId: 'city-2',
        streetId: 'street-2',
        houseNumberId: 'house-2',
        active: false,
      })
    );
  });

  it('hydrates edit flow and builds filter plus paging search states', () => {
    const controller = createController();
    const search = createSearch();
    const { result } = renderHook(() => useWasteLocationsTabNavigation(controller, search));

    const location = {
      id: 'location-5',
      regionId: 'region-1',
      cityId: 'city-1',
      streetId: 'street-9',
      houseNumberId: 'house-9',
      active: true,
      createdAt: '',
      updatedAt: '',
    };

    act(() => {
      result.current.toEdit(location);
    });

    expect(controller.setLocationDialogMode).toHaveBeenCalledWith('edit');
    expect(controller.setLocationForm).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'location-5',
        cityId: 'city-1',
        streetId: 'street-9',
        houseNumberId: 'house-9',
      })
    );
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: { ...search, locationsView: 'edit', collectionLocationId: 'location-5' },
    });

    act(() => {
      result.current.setTourFilter('');
      result.current.setPage(9);
      result.current.syncPage(2);
      result.current.setPageSize(100);
      result.current.setSortMode('addressWithRegion');
      result.current.setSortDirection('desc');
    });

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: { ...search, page: 1, tourId: undefined },
    });
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: { ...search, page: 9 },
    });
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: { ...search, page: 2 },
      replace: true,
    });
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: { ...search, page: 1, pageSize: 100 },
    });
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: { ...search, page: 1, locationSortMode: 'addressWithRegion' },
    });
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: { ...search, page: 1, locationSortDirection: 'desc' },
    });
  });
});
