import type { WasteGlobalDateShiftRecord, WasteTourDateShiftRecord } from '@sva/plugin-sdk';
import { useNavigate } from '@tanstack/react-router';

import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteSchedulingController } from './waste-management.scheduling.controller.js';
import {
  createDefaultGlobalDateShiftForm,
  createDefaultTourDateShiftForm,
  mapGlobalDateShiftToForm,
  mapTourDateShiftToForm,
} from './waste-management.scheduling.shared.js';

type WasteSchedulingController = ReturnType<typeof useWasteSchedulingController>;

export const resolveSingleTourId = (tours: readonly { readonly id: string }[]) =>
  tours.length === 1 ? tours[0]?.id ?? '' : '';

export const toCreateGlobalShiftSearch = (
  search: WasteManagementSearchParams,
): WasteManagementSearchParams => ({
  ...search,
  schedulingView: 'create-global',
  globalDateShiftId: undefined,
  tourDateShiftId: undefined,
});

export const toCreateTourShiftSearch = (
  search: WasteManagementSearchParams,
): WasteManagementSearchParams => ({
  ...search,
  schedulingView: 'create-tour',
  globalDateShiftId: undefined,
  tourDateShiftId: undefined,
});

export const toEditGlobalShiftSearch = (
  search: WasteManagementSearchParams,
  globalDateShiftId: string,
): WasteManagementSearchParams => ({
  ...search,
  schedulingView: 'edit-global',
  globalDateShiftId,
  tourDateShiftId: undefined,
});

export const toEditTourShiftSearch = (
  search: WasteManagementSearchParams,
  tourDateShiftId: string,
): WasteManagementSearchParams => ({
  ...search,
  schedulingView: 'edit-tour',
  globalDateShiftId: undefined,
  tourDateShiftId,
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
    openCreateGlobal: () => {
      controller.setGlobalDialogMode('create');
      controller.setGlobalDialogOpen(false);
      controller.setGlobalShiftForm(createDefaultGlobalDateShiftForm());
      resetSchedulingViewState(controller);
      void navigate({ to: '/plugins/waste-management', search: toCreateGlobalShiftSearch(search) });
    },
    openCreateTour: () => {
      controller.setDialogMode('create');
      controller.setDialogOpen(false);
      controller.setTourShiftForm({
        ...createDefaultTourDateShiftForm(),
        tourId: resolveSingleTourId(controller.availableTours),
      });
      resetSchedulingViewState(controller);
      void navigate({ to: '/plugins/waste-management', search: toCreateTourShiftSearch(search) });
    },
    openEditGlobal: (shift: WasteGlobalDateShiftRecord) => {
      controller.setGlobalDialogMode('edit');
      controller.setGlobalDialogOpen(false);
      controller.setGlobalShiftForm(mapGlobalDateShiftToForm(shift));
      controller.setMessage(null);
      controller.setLastOutcome(null);
      void navigate({ to: '/plugins/waste-management', search: toEditGlobalShiftSearch(search, shift.id) });
    },
    openEditTour: (shift: WasteTourDateShiftRecord) => {
      controller.setDialogMode('edit');
      controller.setDialogOpen(false);
      controller.setTourShiftForm(mapTourDateShiftToForm(shift));
      controller.setMessage(null);
      controller.setLastOutcome(null);
      void navigate({ to: '/plugins/waste-management', search: toEditTourShiftSearch(search, shift.id) });
    },
    setPage: (page: number) => {
      void navigate({ to: '/plugins/waste-management', search: toSchedulingPageSearch(search, page) });
    },
    setPageSize: (pageSize: number) => {
      void navigate({ to: '/plugins/waste-management', search: toSchedulingPageSizeSearch(search, pageSize) });
    },
  };
};
