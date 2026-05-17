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
      },
      replace: true,
    });
  }, [
    controller.resetGlobalShiftForm,
    controller.resetTourShiftForm,
    controller.setDialogOpen,
    controller.setGlobalDialogOpen,
    navigate,
    schedulingViewSuccess,
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
