import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { mapGlobalDateShiftToForm, mapTourDateShiftToForm } from './waste-management.scheduling.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteSchedulingController } from './waste-management.scheduling.controller.js';

type WasteSchedulingController = ReturnType<typeof useWasteSchedulingController>;

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
    controller.setLastOutcome(null);
    if (
      search.schedulingView === 'create-tour' ||
      search.schedulingView === 'edit-tour' ||
      controller.lastOutcome === 'create-tour-success' ||
      controller.lastOutcome === 'update-tour-success'
    ) {
      controller.resetTourShiftForm();
    }
    if (
      search.schedulingView === 'create-global' ||
      search.schedulingView === 'edit-global' ||
      controller.lastOutcome === 'create-global-success' ||
      controller.lastOutcome === 'update-global-success'
    ) {
      controller.resetGlobalShiftForm();
    }
    void navigate({
      to: '/plugins/waste-management',
      search: {
        ...search,
        schedulingView: 'list',
        globalDateShiftId: undefined,
        tourDateShiftId: undefined,
      },
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

export const useWasteTourShiftEditRouteHydration = ({
  controller,
  navigate,
  search,
}: {
  readonly controller: WasteSchedulingController;
  readonly navigate: ReturnType<typeof useNavigate>;
  readonly search: WasteManagementSearchParams;
}) => {
  useEffect(() => {
    if (search.schedulingView !== 'edit-tour') {
      return;
    }

    if (!search.tourDateShiftId) {
      void navigate({
        to: '/plugins/waste-management',
        search: {
          ...search,
          schedulingView: 'list',
          tourDateShiftId: undefined,
          globalDateShiftId: undefined,
        },
        replace: true,
      });
      return;
    }

    const routeShift = controller.overview?.tourDateShifts.find((shift) => shift.id === search.tourDateShiftId);
    if (!routeShift || controller.tourShiftForm.id === routeShift.id) {
      return;
    }

    controller.setDialogMode('edit');
    controller.setTourShiftForm(mapTourDateShiftToForm(routeShift));
    controller.setMessage(null);
    controller.setLastOutcome(null);
  }, [
    controller.overview,
    controller.setDialogMode,
    controller.setLastOutcome,
    controller.setMessage,
    controller.setTourShiftForm,
    controller.tourShiftForm.id,
    navigate,
    search,
  ]);
};

export const useWasteGlobalShiftEditRouteHydration = ({
  controller,
  navigate,
  search,
}: {
  readonly controller: WasteSchedulingController;
  readonly navigate: ReturnType<typeof useNavigate>;
  readonly search: WasteManagementSearchParams;
}) => {
  useEffect(() => {
    if (search.schedulingView !== 'edit-global') {
      return;
    }

    if (!search.globalDateShiftId) {
      void navigate({
        to: '/plugins/waste-management',
        search: {
          ...search,
          schedulingView: 'list',
          tourDateShiftId: undefined,
          globalDateShiftId: undefined,
        },
        replace: true,
      });
      return;
    }

    const routeShift = controller.overview?.globalDateShifts.find((shift) => shift.id === search.globalDateShiftId);
    if (!routeShift || controller.globalShiftForm.id === routeShift.id) {
      return;
    }

    controller.setGlobalDialogMode('edit');
    controller.setGlobalShiftForm(mapGlobalDateShiftToForm(routeShift));
    controller.setMessage(null);
    controller.setLastOutcome(null);
  }, [
    controller.globalShiftForm.id,
    controller.overview,
    controller.setGlobalDialogMode,
    controller.setGlobalShiftForm,
    controller.setLastOutcome,
    controller.setMessage,
    navigate,
    search,
  ]);
};
