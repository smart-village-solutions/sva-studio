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
    void navigate({
      to: '/plugins/waste-management',
      search: clearSchedulingEntryRoute(search),
      replace: true,
    });
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
      void navigate({
        to: '/plugins/waste-management',
        search: clearSchedulingEntryRoute(search),
        replace: true,
      });
      return;
    }

    if (search.schedulingEntryType === 'holiday-rule') {
      const routeRule = controller.overview?.holidayRules.find((rule) => rule.id === search.schedulingEntryId);
      if (!routeRule) {
        void navigate({
          to: '/plugins/waste-management',
          search: clearSchedulingEntryRoute(search),
          replace: true,
        });
      }
      return;
    }

    if (search.schedulingEntryType === 'tour-shift') {
      const routeShift = controller.overview?.tourDateShifts.find((shift) => shift.id === search.schedulingEntryId);
      if (!routeShift) {
        void navigate({
          to: '/plugins/waste-management',
          search: clearSchedulingEntryRoute(search),
          replace: true,
        });
        return;
      }
      if (controller.tourShiftForm.id === routeShift.id) {
        return;
      }

      controller.setDialogMode('edit');
      controller.setTourShiftForm(mapTourDateShiftToForm(routeShift));
      controller.setMessage(null);
      controller.setLastOutcome(null);
      return;
    }

    const routeShift = controller.overview?.globalDateShifts.find((shift) => shift.id === search.schedulingEntryId);
    if (!routeShift) {
      void navigate({
        to: '/plugins/waste-management',
        search: clearSchedulingEntryRoute(search),
        replace: true,
      });
      return;
    }
    if (controller.globalShiftForm.id === routeShift.id) {
      return;
    }

    controller.setGlobalDialogMode('edit');
    controller.setGlobalShiftForm(mapGlobalDateShiftToForm(routeShift));
    controller.setMessage(null);
    controller.setLastOutcome(null);
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
