import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WasteManagementSearchParams } from '../src/search-params.js';
import {
  toCreateTourSearch,
  toEditTourSearch,
  toToursPageSearch,
  toToursPageSizeSearch,
  toToursQuerySearch,
  toToursStatusSearch,
  useWasteToursListNavigation,
} from '../src/waste-management.tours-list-view.navigation.js';
import type { useWasteToursController } from '../src/waste-management.tours.controller.js';

const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

const createSearch = (): WasteManagementSearchParams => ({
  tab: 'tours',
  masterDataTab: 'fractions',
  fractionsView: 'list',
  toursView: 'list',
  locationsView: 'list',
  schedulingView: 'list',
  q: 'bio',
  page: 3,
  pageSize: 25,
  status: 'active',
  shiftContext: 'all',
  fractionsSortBy: 'name',
  fractionsSortDirection: 'asc',
  regionId: undefined,
  cityId: undefined,
  wasteFractionId: undefined,
  tourId: undefined,
  tourDateShiftId: undefined,
  globalDateShiftId: undefined,
});

type WasteToursController = ReturnType<typeof useWasteToursController>;

const createController = (
  overrides: Partial<WasteToursController> = {}
): WasteToursController =>
  ({
    setDialogMode: vi.fn(),
    setTourForm: vi.fn(),
    setMessage: vi.fn(),
    setLastOutcome: vi.fn(),
    ...overrides,
  }) as WasteToursController;

describe('waste-management.tours-list-view.navigation', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('builds create and edit search states for tours', () => {
    const search = createSearch();

    expect(toCreateTourSearch(search)).toEqual({
      ...search,
      toursView: 'create',
      tourId: undefined,
    });

    expect(toEditTourSearch(search, 'tour-1')).toEqual({
      ...search,
      toursView: 'edit',
      tourId: 'tour-1',
    });
  });

  it('builds filter and paging search states for tours', () => {
    const search = createSearch();

    expect(toToursPageSearch(search, 5)).toEqual({
      ...search,
      page: 5,
    });

    expect(toToursPageSizeSearch(search, 100)).toEqual({
      ...search,
      page: 1,
      pageSize: 100,
    });

    expect(toToursQuerySearch(search, 'papier')).toEqual({
      ...search,
      q: 'papier',
      page: 1,
    });

    expect(toToursStatusSearch(search, 'inactive')).toEqual({
      ...search,
      status: 'inactive',
      page: 1,
    });
  });

  it('replaces history entries when syncing an invalid page back into range', () => {
    const controller = createController();
    const search = createSearch();
    const { result } = renderHook(() => useWasteToursListNavigation(controller, search));

    act(() => {
      result.current.syncPage(2);
    });

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: {
        ...search,
        page: 2,
      },
      replace: true,
    });
  });
});
