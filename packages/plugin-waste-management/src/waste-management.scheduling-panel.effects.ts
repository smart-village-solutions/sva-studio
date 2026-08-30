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
  type TourShiftCreateContextResolution,
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
): boolean => {
  const routeShift = controller.overview?.tourDateShifts.find(
    (shift) => shift.id === search.schedulingEntryId
  );
  if (!routeShift) {
    void navigateToSchedulingList(navigate, search);
    return false;
  }

  controller.setDialogMode('edit');
  controller.setTourShiftForm(mapTourDateShiftToForm(routeShift));
  resetSchedulingEditState(controller);
  return true;
};

const syncGlobalShiftRoute = (
  controller: WasteViewModel,
  navigate: ReturnType<typeof useNavigate>,
  search: WasteManagementSearchParams
): boolean => {
  const routeShift = controller.overview?.globalDateShifts.find(
    (shift) => shift.id === search.schedulingEntryId
  );
  if (!routeShift) {
    void navigateToSchedulingList(navigate, search);
    return false;
  }

  controller.setGlobalDialogMode('edit');
  controller.setGlobalShiftForm(mapGlobalDateShiftToForm(routeShift));
  resetSchedulingEditState(controller);
  return true;
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
  context,
  search,
}: {
  readonly controller: WasteViewModel;
  readonly context: TourShiftCreateContextResolution;
  readonly search: WasteManagementSearchParams;
}) => {
  const initialFormRef = useRef(controller.tourShiftForm);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (
      controller.loading ||
      search.schedulingView !== 'create' ||
      search.schedulingEntryType !== 'tour-shift'
    ) {
      return;
    }

    if (
      context.kind !== 'valid' ||
      hydratedRef.current ||
      controller.tourShiftForm !== initialFormRef.current
    ) {
      return;
    }

    controller.setTourShiftForm((current) => ({
      ...current,
      tourId: context.tourId,
      ...(context.originalDate ? { originalDate: context.originalDate } : {}),
    }));
    hydratedRef.current = true;
  }, [context, controller.loading, controller.setTourShiftForm, controller.tourShiftForm, search]);
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
  const hydratedEntryKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (search.schedulingView !== 'edit') {
      hydratedEntryKeyRef.current = null;
      return;
    }

    if (!search.schedulingEntryType || !search.schedulingEntryId) {
      void navigateToSchedulingList(navigate, search);
      return;
    }

    if (controller.loading || !controller.overview) {
      return;
    }

    const routeKey = `${search.schedulingEntryType}:${search.schedulingEntryId}`;
    if (hydratedEntryKeyRef.current === routeKey) {
      return;
    }

    if (search.schedulingEntryType === 'holiday-rule') {
      const routeRule = controller.overview.holidayRules.find(
        (rule) => rule.id === search.schedulingEntryId
      );
      if (!routeRule) {
        void navigateToSchedulingList(navigate, search);
        return;
      }
      hydratedEntryKeyRef.current = routeKey;
      return;
    }

    if (search.schedulingEntryType === 'tour-shift') {
      if (syncTourShiftRoute(controller, navigate, search)) {
        hydratedEntryKeyRef.current = routeKey;
      }
      return;
    }

    if (syncGlobalShiftRoute(controller, navigate, search)) {
      hydratedEntryKeyRef.current = routeKey;
    }
  }, [
    controller.loading,
    controller.overview,
    controller.setDialogMode,
    controller.setGlobalDialogMode,
    controller.setGlobalShiftForm,
    controller.setLastOutcome,
    controller.setMessage,
    controller.setTourShiftForm,
    navigate,
    search,
  ]);
};
