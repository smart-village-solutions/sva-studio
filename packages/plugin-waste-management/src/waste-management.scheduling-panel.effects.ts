import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { mapGlobalDateShiftToForm, mapTourDateShiftToForm } from './waste-management.scheduling.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteSchedulingController } from './waste-management.scheduling.controller.js';

type WasteSchedulingController = ReturnType<typeof useWasteSchedulingController>;

const clearSchedulingEntryRoute = (search: WasteManagementSearchParams): WasteManagementSearchParams => ({
  ...search,
  schedulingView: 'list',
  schedulingEntryType: undefined,
  schedulingEntryId: undefined,
});

const navigateToSchedulingList = (
  navigate: ReturnType<typeof useNavigate>,
  search: WasteManagementSearchParams,
) =>
  navigate({
    to: '/plugins/waste-management',
    search: clearSchedulingEntryRoute(search),
    replace: true,
  });

const resetSchedulingEditState = (controller: WasteSchedulingController) => {
  controller.setMessage(null);
  controller.setLastOutcome(null);
};

const syncTourShiftRoute = (
  controller: WasteSchedulingController,
  navigate: ReturnType<typeof useNavigate>,
  search: WasteManagementSearchParams,
) => {
  const routeShift = controller.overview?.tourDateShifts.find((shift) => shift.id === search.schedulingEntryId);
  if (!routeShift) {
    void navigateToSchedulingList(navigate, search);
    return;
  }
  if (controller.tourShiftForm.id === routeShift.id) {
    return;
  }

  controller.setDialogMode('edit');
  controller.setTourShiftForm(mapTourDateShiftToForm(routeShift));
  resetSchedulingEditState(controller);
};

const syncGlobalShiftRoute = (
  controller: WasteSchedulingController,
  navigate: ReturnType<typeof useNavigate>,
  search: WasteManagementSearchParams,
) => {
  const routeShift = controller.overview?.globalDateShifts.find((shift) => shift.id === search.schedulingEntryId);
  if (!routeShift) {
    void navigateToSchedulingList(navigate, search);
    return;
  }
  if (controller.globalShiftForm.id === routeShift.id) {
    return;
  }

  controller.setGlobalDialogMode('edit');
  controller.setGlobalShiftForm(mapGlobalDateShiftToForm(routeShift));
  resetSchedulingEditState(controller);
};

export const useWasteSchedulingSuccessRedirect = ({
  controller,
  navigate,
  search,
}: {
  readonly controller: WasteSchedulingController;
  readonly navigate: ReturnType<typeof useNavigate>;
  readonly search: WasteManagementSearchParams;
}) => {
  const schedulingViewSuccess = search.schedulingView !== 'list' && controller.lastOutcome !== null;

  useEffect(() => {
    if (!schedulingViewSuccess) {
      return;
    }

    controller.setDialogOpen(false);
    controller.setGlobalDialogOpen(false);
    controller.resetTourShiftForm();
    controller.resetGlobalShiftForm();
    controller.setLastOutcome(null);
    void navigateToSchedulingList(navigate, search);
  }, [
    controller.resetGlobalShiftForm,
    controller.resetTourShiftForm,
    controller.setDialogOpen,
    controller.setGlobalDialogOpen,
    controller.setLastOutcome,
    navigate,
    schedulingViewSuccess,
    search,
  ]);
};

export const useWasteSchedulingEditRouteHydration = ({
  controller,
  navigate,
  search,
}: {
  readonly controller: WasteSchedulingController;
  readonly navigate: ReturnType<typeof useNavigate>;
  readonly search: WasteManagementSearchParams;
}) => {
  useEffect(() => {
    if (search.schedulingView !== 'edit') {
      return;
    }

    if (!search.schedulingEntryType || !search.schedulingEntryId) {
      void navigateToSchedulingList(navigate, search);
      return;
    }

    if (search.schedulingEntryType === 'holiday-rule') {
      const routeRule = controller.overview?.holidayRules.find((rule) => rule.id === search.schedulingEntryId);
      if (!routeRule) {
        void navigateToSchedulingList(navigate, search);
      }
      return;
    }

    if (search.schedulingEntryType === 'tour-shift') {
      syncTourShiftRoute(controller, navigate, search);
      return;
    }

    syncGlobalShiftRoute(controller, navigate, search);
  }, [
    controller.globalShiftForm.id,
    controller.overview,
    controller.setDialogMode,
    controller.setGlobalDialogMode,
    controller.setGlobalShiftForm,
    controller.setLastOutcome,
    controller.setMessage,
    controller.setTourShiftForm,
    controller.tourShiftForm.id,
    navigate,
    search,
  ]);
};
