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
  shiftContext: 'all',
  fractionsSortBy: 'name',
  fractionsSortDirection: 'asc',
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
      }),
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
      }),
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
      }),
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
    });

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: { ...search, tourId: undefined },
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
  });
});
