import type {
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
  WasteTourDateShiftRecord,
} from '@sva/plugin-sdk';
import { useNavigate } from '@tanstack/react-router';

import type {
  WasteManagementSchedulingEntryType,
  WasteManagementSearchParams,
} from './search-params.js';
import { useWasteSchedulingController } from './waste-management.scheduling.controller.js';
import {
  createDefaultGlobalDateShiftForm,
  createDefaultTourDateShiftForm,
  mapGlobalDateShiftToForm,
  mapTourDateShiftToForm,
  resolveSchedulingEntryTypeFromShiftContext,
} from './waste-management.scheduling.shared.js';

type WasteSchedulingController = ReturnType<typeof useWasteSchedulingController>;

export const resolveSingleTourId = (tours: readonly { readonly id: string }[]) =>
  tours.length === 1 ? tours[0]?.id ?? '' : '';

const clearSchedulingEntrySearch = (
  search: WasteManagementSearchParams,
): WasteManagementSearchParams => ({
  ...search,
  schedulingEntryType: undefined,
  schedulingEntryId: undefined,
});

export const toCreateSchedulingEntrySearch = (
  search: WasteManagementSearchParams,
  schedulingEntryType: Exclude<WasteManagementSchedulingEntryType, 'holiday-rule'>,
): WasteManagementSearchParams => ({
  ...clearSchedulingEntrySearch(search),
  schedulingView: 'create',
  schedulingEntryType,
});

export const toEditSchedulingEntrySearch = (
  search: WasteManagementSearchParams,
  schedulingEntryType: WasteManagementSchedulingEntryType,
  schedulingEntryId: string,
): WasteManagementSearchParams => ({
  ...clearSchedulingEntrySearch(search),
  schedulingView: 'edit',
  schedulingEntryType,
  schedulingEntryId,
});

export const toSchedulingPageSearch = (
  search: WasteManagementSearchParams,
  page: number,
): WasteManagementSearchParams => ({
  ...search,
  page,
});

export const toSchedulingPageSizeSearch = (
  search: WasteManagementSearchParams,
  pageSize: number,
): WasteManagementSearchParams => ({
  ...search,
  page: 1,
  pageSize,
});

const resetSchedulingViewState = (controller: WasteSchedulingController) => {
  controller.setMessage(null);
  controller.setLastOutcome(null);
};

export const useWasteSchedulingListNavigation = (
  controller: WasteSchedulingController,
  search: WasteManagementSearchParams,
) => {
  const navigate = useNavigate();

  return {
    openCreate: () => {
      const schedulingEntryType = resolveSchedulingEntryTypeFromShiftContext(
        search.shiftContext,
        controller.availableTours,
      );
      controller.setDialogMode('create');
      controller.setGlobalDialogMode('create');
      controller.setDialogOpen(false);
      controller.setGlobalDialogOpen(false);
      controller.setTourShiftForm({
        ...createDefaultTourDateShiftForm(),
        tourId: resolveSingleTourId(controller.availableTours),
      });
      controller.setGlobalShiftForm(createDefaultGlobalDateShiftForm());
      resetSchedulingViewState(controller);
      void navigate({
        to: '/plugins/waste-management',
        search: toCreateSchedulingEntrySearch(search, schedulingEntryType),
      });
    },
    openCreateGlobal: () => {
      controller.setGlobalDialogMode('create');
      controller.setGlobalDialogOpen(false);
      controller.setGlobalShiftForm(createDefaultGlobalDateShiftForm());
      resetSchedulingViewState(controller);
      void navigate({
        to: '/plugins/waste-management',
        search: toCreateSchedulingEntrySearch(search, 'global-shift'),
      });
    },
    openCreateTour: () => {
      controller.setDialogMode('create');
      controller.setDialogOpen(false);
      controller.setTourShiftForm({
        ...createDefaultTourDateShiftForm(),
        tourId: resolveSingleTourId(controller.availableTours),
      });
      resetSchedulingViewState(controller);
      void navigate({
        to: '/plugins/waste-management',
        search: toCreateSchedulingEntrySearch(search, 'tour-shift'),
      });
    },
    openEditHoliday: (rule: WasteHolidayRuleRecord) => {
      resetSchedulingViewState(controller);
      void navigate({
        to: '/plugins/waste-management',
        search: toEditSchedulingEntrySearch(search, 'holiday-rule', rule.id),
      });
    },
    openEditGlobal: (shift: WasteGlobalDateShiftRecord) => {
      controller.setGlobalDialogMode('edit');
      controller.setGlobalDialogOpen(false);
      controller.setGlobalShiftForm(mapGlobalDateShiftToForm(shift));
      resetSchedulingViewState(controller);
      void navigate({
        to: '/plugins/waste-management',
        search: toEditSchedulingEntrySearch(search, 'global-shift', shift.id),
      });
    },
    openEditTour: (shift: WasteTourDateShiftRecord) => {
      controller.setDialogMode('edit');
      controller.setDialogOpen(false);
      controller.setTourShiftForm(mapTourDateShiftToForm(shift));
      resetSchedulingViewState(controller);
      void navigate({
        to: '/plugins/waste-management',
        search: toEditSchedulingEntrySearch(search, 'tour-shift', shift.id),
      });
    },
    setPage: (page: number) => {
      void navigate({ to: '/plugins/waste-management', search: toSchedulingPageSearch(search, page) });
    },
    syncPage: (page: number) => {
      void navigate({
        to: '/plugins/waste-management',
        search: toSchedulingPageSearch(search, page),
        replace: true,
      });
    },
    setPageSize: (pageSize: number) => {
      void navigate({ to: '/plugins/waste-management', search: toSchedulingPageSizeSearch(search, pageSize) });
    },
  };
};
