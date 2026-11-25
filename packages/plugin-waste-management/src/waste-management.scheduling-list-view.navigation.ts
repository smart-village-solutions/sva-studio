import type {
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
  WasteTourDateShiftRecord,
} from '@sva/waste-management-contracts';
import { useNavigate } from '@tanstack/react-router';

import type {
  WasteManagementSchedulingEntryType,
  WasteManagementSearchParams,
} from './search-params.js';
import { useWasteSchedulingViewModel } from './use-waste-scheduling-view-model.js';
import {
  toWasteCollectionLocationEditSearch,
  toWasteTourEditSearch,
} from './waste-management.cross-link.navigation.js';
import {
  createDefaultGlobalDateShiftForm,
  createDefaultTourDateShiftForm,
  mapGlobalDateShiftToForm,
  mapTourDateShiftToForm,
  resolveSchedulingEntryTypeFromShiftContext,
} from './waste-management.scheduling.shared.js';
import { clearTourShiftCreateContext } from './waste-management.tour-shift-navigation.js';

type WasteViewModel = ReturnType<typeof useWasteSchedulingViewModel>;

export const resolveSingleTourId = (tours: readonly { readonly id: string }[]) =>
  tours.length === 1 ? (tours[0]?.id ?? '') : '';

const clearSchedulingEntrySearch = (
  search: WasteManagementSearchParams
): WasteManagementSearchParams => ({
  ...search,
  schedulingEntryType: undefined,
  schedulingEntryId: undefined,
});

export const toCreateSchedulingEntrySearch = (
  search: WasteManagementSearchParams,
  schedulingEntryType: Exclude<WasteManagementSchedulingEntryType, 'holiday-rule'>
): WasteManagementSearchParams =>
  clearTourShiftCreateContext({
    ...clearSchedulingEntrySearch(search),
    schedulingView: 'create',
    schedulingEntryType,
  });

export const toEditSchedulingEntrySearch = (
  search: WasteManagementSearchParams,
  schedulingEntryType: WasteManagementSchedulingEntryType,
  schedulingEntryId: string
): WasteManagementSearchParams =>
  clearTourShiftCreateContext({
    ...clearSchedulingEntrySearch(search),
    schedulingView: 'edit',
    schedulingEntryType,
    schedulingEntryId,
  });

export const toSchedulingPageSearch = (
  search: WasteManagementSearchParams,
  page: number
): WasteManagementSearchParams => ({
  ...search,
  page,
});

export const toSchedulingPageSizeSearch = (
  search: WasteManagementSearchParams,
  pageSize: number
): WasteManagementSearchParams => ({
  ...search,
  page: 1,
  pageSize,
});

const resetSchedulingViewState = (controller: WasteViewModel) => {
  controller.setMessage(null);
  controller.setLastOutcome(null);
};
const resetSchedulingCreateForms = (
  controller: WasteViewModel,
  availableTours: readonly { readonly id: string }[]
) => {
  controller.setDialogOpen(false);
  controller.setGlobalDialogOpen(false);
  controller.setTourShiftForm({
    ...createDefaultTourDateShiftForm(),
    tourId: resolveSingleTourId(availableTours),
  });
  controller.setGlobalShiftForm(createDefaultGlobalDateShiftForm());
};

const navigateToSchedulingSearch = (
  navigate: ReturnType<typeof useNavigate>,
  nextSearch: WasteManagementSearchParams,
  options?: { readonly replace?: boolean }
) =>
  navigate({
    to: '/plugins/waste-management',
    search: nextSearch,
    ...(options?.replace ? { replace: true } : {}),
  });

const createSchedulingListActions = (
  navigate: ReturnType<typeof useNavigate>,
  search: WasteManagementSearchParams
) => ({
  applyFilters: (patch: Partial<WasteManagementSearchParams>) =>
    void navigate({
      to: '/plugins/waste-management',
      search: (current: WasteManagementSearchParams) => ({ ...current, ...patch, page: 1 }),
    }),
  resetFilters: () =>
    void navigateToSchedulingSearch(navigate, {
      ...search,
      q: '',
      shiftContext: 'all',
      shiftDateFrom: undefined,
      shiftDateTo: undefined,
      tourId: undefined,
      page: 1,
    }),
  openLinkedTour: (tourId: string) => {
    void navigateToSchedulingSearch(navigate, toWasteTourEditSearch(search, tourId));
  },
  openLinkedLocation: (collectionLocationId: string) =>
    void navigateToSchedulingSearch(
      navigate,
      toWasteCollectionLocationEditSearch(search, collectionLocationId)
    ),
  setPage: (page: number) => {
    void navigateToSchedulingSearch(navigate, toSchedulingPageSearch(search, page));
  },
  syncPage: (page: number) => {
    void navigateToSchedulingSearch(navigate, toSchedulingPageSearch(search, page), {
      replace: true,
    });
  },
  setPageSize: (pageSize: number) => {
    void navigateToSchedulingSearch(navigate, toSchedulingPageSizeSearch(search, pageSize));
  },
});

export const useWasteSchedulingListNavigation = (
  controller: WasteViewModel,
  search: WasteManagementSearchParams
) => {
  const navigate = useNavigate();

  return {
    ...createSchedulingListActions(navigate, search),
    openCreate: () => {
      const schedulingEntryType = resolveSchedulingEntryTypeFromShiftContext(
        search.shiftContext,
        controller.availableTours
      );
      controller.setDialogMode('create');
      controller.setGlobalDialogMode('create');
      resetSchedulingCreateForms(controller, controller.availableTours);
      resetSchedulingViewState(controller);
      void navigateToSchedulingSearch(
        navigate,
        toCreateSchedulingEntrySearch(search, schedulingEntryType)
      );
    },
    openCreateGlobal: () => {
      controller.setGlobalDialogMode('create');
      controller.setGlobalDialogOpen(false);
      controller.setGlobalShiftForm(createDefaultGlobalDateShiftForm());
      resetSchedulingViewState(controller);
      void navigateToSchedulingSearch(
        navigate,
        toCreateSchedulingEntrySearch(search, 'global-shift')
      );
    },
    openCreateTour: () => {
      controller.setDialogMode('create');
      controller.setDialogOpen(false);
      controller.setTourShiftForm({
        ...createDefaultTourDateShiftForm(),
        tourId: resolveSingleTourId(controller.availableTours),
      });
      resetSchedulingViewState(controller);
      void navigateToSchedulingSearch(
        navigate,
        toCreateSchedulingEntrySearch(search, 'tour-shift')
      );
    },
    openEditHoliday: (rule: WasteHolidayRuleRecord) => {
      resetSchedulingViewState(controller);
      void navigateToSchedulingSearch(
        navigate,
        toEditSchedulingEntrySearch(search, 'holiday-rule', rule.id)
      );
    },
    openEditGlobal: (shift: WasteGlobalDateShiftRecord) => {
      controller.setGlobalDialogMode('edit');
      controller.setGlobalDialogOpen(false);
      controller.setGlobalShiftForm(mapGlobalDateShiftToForm(shift));
      resetSchedulingViewState(controller);
      void navigateToSchedulingSearch(
        navigate,
        toEditSchedulingEntrySearch(search, 'global-shift', shift.id)
      );
    },
    openEditTour: (shift: WasteTourDateShiftRecord) => {
      controller.setDialogMode('edit');
      controller.setDialogOpen(false);
      controller.setTourShiftForm(mapTourDateShiftToForm(shift));
      resetSchedulingViewState(controller);
      void navigateToSchedulingSearch(
        navigate,
        toEditSchedulingEntrySearch(search, 'tour-shift', shift.id)
      );
    },
  };
};
