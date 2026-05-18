import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WasteManagementSearchParams } from '../src/search-params.js';
import {
  resolveSingleTourId,
  toCreateShiftSearch,
  toCreateGlobalShiftSearch,
  toCreateTourShiftSearch,
  toEditGlobalShiftSearch,
  toEditTourShiftSearch,
  toSchedulingPageSearch,
  toSchedulingPageSizeSearch,
  useWasteSchedulingListNavigation,
} from '../src/waste-management.scheduling-list-view.navigation.js';

const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

const createSearch = (): WasteManagementSearchParams => ({
  tab: 'scheduling',
  masterDataTab: 'fractions',
  fractionsView: 'list',
  toursView: 'list',
  locationsView: 'list',
  schedulingView: 'list',
  q: '',
  page: 3,
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
});

describe('waste-management.scheduling-list-view.navigation', () => {
  afterEach(() => {
    navigateMock.mockReset();
  });

  it('prefills the only available tour id', () => {
    expect(resolveSingleTourId([])).toBe('');
    expect(resolveSingleTourId([{ id: 'tour-1' }, { id: 'tour-2' }])).toBe('');
    expect(resolveSingleTourId([{ id: 'tour-1' }])).toBe('tour-1');
  });

  it('builds create and edit search states for scheduling views', () => {
    const search = createSearch();

    expect(toCreateShiftSearch(search)).toEqual({
      ...search,
      schedulingView: 'create',
      globalDateShiftId: undefined,
      tourDateShiftId: undefined,
    });

    expect(toCreateGlobalShiftSearch(search)).toEqual({
      ...search,
      schedulingView: 'create-global',
      globalDateShiftId: undefined,
      tourDateShiftId: undefined,
    });

    expect(toCreateTourShiftSearch(search)).toEqual({
      ...search,
      schedulingView: 'create-tour',
      globalDateShiftId: undefined,
      tourDateShiftId: undefined,
    });

    expect(toEditGlobalShiftSearch(search, 'global-1')).toEqual({
      ...search,
      schedulingView: 'edit-global',
      globalDateShiftId: 'global-1',
      tourDateShiftId: undefined,
    });

    expect(toEditTourShiftSearch(search, 'tour-shift-1')).toEqual({
      ...search,
      schedulingView: 'edit-tour',
      globalDateShiftId: undefined,
      tourDateShiftId: 'tour-shift-1',
    });
  });

  it('builds paging search states for scheduling views', () => {
    const search = createSearch();

    expect(toSchedulingPageSearch(search, 5)).toEqual({
      ...search,
      page: 5,
    });

    expect(toSchedulingPageSizeSearch(search, 100)).toEqual({
      ...search,
      page: 1,
      pageSize: 100,
    });
  });

  it('drives list navigation helpers through the controller state and router', () => {
    const controller = {
      availableTours: [{ id: 'tour-1' }],
      setDialogMode: vi.fn(),
      setGlobalDialogMode: vi.fn(),
      setDialogOpen: vi.fn(),
      setGlobalDialogOpen: vi.fn(),
      setTourShiftForm: vi.fn(),
      setGlobalShiftForm: vi.fn(),
      setMessage: vi.fn(),
      setLastOutcome: vi.fn(),
    };

    const search = createSearch();
    const { result } = renderHook(() =>
      useWasteSchedulingListNavigation(controller as never, search)
    );

    result.current.openCreate();
    expect(controller.setTourShiftForm).toHaveBeenCalledWith(
      expect.objectContaining({ tourId: 'tour-1' })
    );
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({ schedulingView: 'create' }),
    });

    result.current.openCreateGlobal();
    result.current.openCreateTour();
    result.current.openEditGlobal({ id: 'global-1' } as never);
    result.current.openEditTour({ id: 'tour-shift-1' } as never);
    result.current.setPage(6);
    result.current.syncPage(2);
    result.current.setPageSize(50);

    expect(controller.setGlobalShiftForm).toHaveBeenCalled();
    expect(controller.setMessage).toHaveBeenCalledWith(null);
    expect(controller.setLastOutcome).toHaveBeenCalledWith(null);
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({ page: 2 }),
      replace: true,
    });
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({ page: 1, pageSize: 50 }),
    });
  });
});
