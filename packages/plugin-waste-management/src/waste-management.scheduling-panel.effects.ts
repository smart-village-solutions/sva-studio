import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';

import {
  mapGlobalDateShiftToForm,
  mapTourDateShiftToForm,
} from './waste-management.scheduling.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteSchedulingViewModel } from './use-waste-scheduling-view-model.js';
import {
  clearTourShiftCreateContext,
  resolveTourShiftCreatePrefill,
} from './waste-management.tour-shift-navigation.js';

type WasteViewModel = ReturnType<typeof useWasteSchedulingViewModel>;

const clearSchedulingEntryRoute = (
  search: WasteManagementSearchParams
): WasteManagementSearchParams =>
  clearTourShiftCreateContext({
    ...search,
    schedulingView: 'list',
    schedulingEntryType: undefined,
    schedulingEntryId: undefined,
  });

const navigateToSchedulingList = (
  navigate: ReturnType<typeof useNavigate>,
  search: WasteManagementSearchParams
) =>
  navigate({
    to: '/plugins/waste-management',
    search: clearSchedulingEntryRoute(search),
    replace: true,
  });

const resetSchedulingEditState = (controller: WasteViewModel) => {
  controller.setMessage(null);
  controller.setLastOutcome(null);
};

const syncTourShiftRoute = (
  controller: WasteViewModel,
  navigate: ReturnType<typeof useNavigate>,
  search: WasteManagementSearchParams
) => {
  const routeShift = controller.overview?.tourDateShifts.find(
    (shift) => shift.id === search.schedulingEntryId
  );
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
  controller: WasteViewModel,
  navigate: ReturnType<typeof useNavigate>,
  search: WasteManagementSearchParams
) => {
  const routeShift = controller.overview?.globalDateShifts.find(
    (shift) => shift.id === search.schedulingEntryId
  );
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
  readonly controller: WasteViewModel;
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

export const useWasteSchedulingCreateRouteHydration = ({
  controller,
  search,
}: {
  readonly controller: WasteViewModel;
  readonly search: WasteManagementSearchParams;
}) => {
  const hydratedContextRef = useRef<string | null>(null);
  const contextKey = `${search.schedulingTourId ?? ''}:${search.schedulingOriginalDate ?? ''}`;

  useEffect(() => {
    if (
      controller.loading ||
      search.schedulingView !== 'create' ||
      search.schedulingEntryType !== 'tour-shift'
    ) {
      return;
    }

    if (search.schedulingTourId && controller.availableTours.length === 0) {
      return;
    }

    const prefill = resolveTourShiftCreatePrefill(search, controller.availableTours);
    if (!prefill || hydratedContextRef.current === contextKey) {
      return;
    }

    controller.setTourShiftForm((current) => ({ ...current, ...prefill }));
    hydratedContextRef.current = contextKey;
  }, [
    contextKey,
    controller.availableTours,
    controller.loading,
    controller.setTourShiftForm,
    search,
  ]);
};

export const useWasteSchedulingEditRouteHydration = ({
  controller,
  navigate,
  search,
}: {
  readonly controller: WasteViewModel;
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

    if (controller.loading || !controller.overview) {
      return;
    }

    if (search.schedulingEntryType === 'holiday-rule') {
      const routeRule = controller.overview.holidayRules.find(
        (rule) => rule.id === search.schedulingEntryId
      );
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
    controller.loading,
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
