import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WasteManagementSearchParams } from '../src/search-params.js';
import {
  toCreateTourSearch,
  toEditTourSearch,
  toToursFiltersSearch,
  toToursPageSearch,
  toToursPageSizeSearch,
  toToursQuerySearch,
  toToursStatusSearch,
  useWasteToursListNavigation,
} from '../src/waste-management.tours-list-view.navigation.js';
import type { useWasteToursViewModel } from '../src/use-waste-tours-view-model.js';

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
  tourWasteFractionId: 'fraction-1',
  firstDateFrom: '2026-01-01',
  firstDateTo: undefined,
  endDateFrom: undefined,
  endDateTo: '2026-12-31',
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

type WasteViewModel = ReturnType<typeof useWasteToursViewModel>;

const createController = (
  overrides: Partial<WasteViewModel> = {}
): WasteViewModel =>
  ({
    setDialogMode: vi.fn(),
    setTourForm: vi.fn(),
    setMessage: vi.fn(),
    setLastOutcome: vi.fn(),
    ...overrides,
  }) as WasteViewModel;

describe('waste-management.tours-list-view.navigation', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue('tour-copy-id'),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

    expect(
      toToursFiltersSearch(
        search,
        'papier',
        'inactive',
        search.tourWasteFractionId,
        search.firstDateFrom,
        search.firstDateTo,
        search.endDateFrom,
        search.endDateTo
      )
    ).toEqual({
      ...search,
      q: 'papier',
      status: 'inactive',
      tourWasteFractionId: 'fraction-1',
      page: 1,
    });

    expect(
      toToursFiltersSearch(
        search,
        'papier',
        'inactive',
        'fraction-2',
        '2026-02-01',
        '2026-03-31',
        '2026-10-01',
        '2026-11-30'
      )
    ).toEqual({
      ...search,
      q: 'papier',
      status: 'inactive',
      tourWasteFractionId: 'fraction-2',
      firstDateFrom: '2026-02-01',
      firstDateTo: '2026-03-31',
      endDateFrom: '2026-10-01',
      endDateTo: '2026-11-30',
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

  it('prefills create flow from duplicate action with copied name suffix', () => {
    const controller = createController();
    const search = createSearch();
    const { result } = renderHook(() => useWasteToursListNavigation(controller, search));

    act(() => {
      result.current.toDuplicate({
        id: 'tour-7',
        name: 'Bio Nord',
        description: 'Montag',
        wasteFractionIds: ['fraction-1'],
        recurrence: 'weekly',
        firstDate: '2026-01-07',
        endDate: '2026-12-31',
        customDates: [],
        active: true,
        createdAt: '',
        updatedAt: '',
      } as never);
    });

    expect(controller.setTourForm).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tour-copy-id',
        name: 'Bio Nord (Kopie)',
        recurrence: 'weekly',
        firstDate: '2026-01-07',
      })
    );

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({
        toursView: 'create',
        tourId: undefined,
        duplicateFromTourId: 'tour-7',
      }),
    });
  });
});
