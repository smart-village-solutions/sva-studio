import { useEffect } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';
import { useNavigate } from '@tanstack/react-router';

import { useWasteSchedulingController } from './waste-management.scheduling.controller.js';
import {
  WasteSchedulingDialogs,
  WasteSchedulingGlobalFormView,
  WasteSchedulingListView,
  WasteSchedulingTourFormView,
} from './waste-management.scheduling-panel.views.js';
import { mapGlobalDateShiftToForm, mapTourDateShiftToForm } from './waste-management.scheduling.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';

export const WasteSchedulingPanel = ({ search }: { readonly search: WasteManagementSearchParams }) => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const controller = useWasteSchedulingController(pt, search);
  const schedulingViewSuccess =
    search.schedulingView !== 'list' &&
    controller.lastOutcome !== null;

  useEffect(() => {
    if (!schedulingViewSuccess) {
      return;
    }

    controller.setDialogOpen(false);
    controller.setGlobalDialogOpen(false);
    controller.setLastOutcome(null);
    if (search.schedulingView === 'create-tour' || search.schedulingView === 'edit-tour') {
      controller.resetTourShiftForm();
    } else if (search.schedulingView === 'create-global' || search.schedulingView === 'edit-global') {
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

  if (controller.loading) {
    return <StudioLoadingState>{pt('scheduling.messages.loading')}</StudioLoadingState>;
  }

  if (controller.error) {
    return <StudioErrorState>{controller.error}</StudioErrorState>;
  }

  const dialogs = <WasteSchedulingDialogs controller={controller} />;

  if (search.schedulingView === 'create-global' || search.schedulingView === 'edit-global') {
    return (
      <>
        <WasteSchedulingGlobalFormView controller={controller} search={search} />
        {dialogs}
      </>
    );
  }

  if (search.schedulingView === 'create-tour' || search.schedulingView === 'edit-tour') {
    return (
      <>
        <WasteSchedulingTourFormView controller={controller} search={search} />
        {dialogs}
      </>
    );
  }

  return (
    <>
      <WasteSchedulingListView controller={controller} search={search} />
      {dialogs}
    </>
  );
};
