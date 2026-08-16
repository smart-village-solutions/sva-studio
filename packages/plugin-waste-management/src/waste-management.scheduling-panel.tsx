import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';
import { useNavigate } from '@tanstack/react-router';

import { useWasteSchedulingViewModel } from './use-waste-scheduling-view-model.js';
import {
  useWasteSchedulingCreateRouteHydration,
  useWasteSchedulingEditRouteHydration,
  useWasteSchedulingSuccessRedirect,
} from './waste-management.scheduling-panel.effects.js';
import {
  WasteSchedulingCreateFormView,
  WasteSchedulingDialogs,
  WasteSchedulingGlobalFormView,
  WasteSchedulingHolidayFormView,
  WasteSchedulingListView,
  WasteSchedulingTourFormView,
} from './waste-management.scheduling-panel.views.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { resolveTourShiftCreateContext } from './waste-management.tour-shift-navigation.js';

export const WasteSchedulingPanel = ({
  search,
  rawSearch = search,
}: {
  readonly search: WasteManagementSearchParams;
  readonly rawSearch?: Readonly<Record<string, unknown>>;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const controller = useWasteSchedulingViewModel(pt, search);
  const tourShiftCreateContext = resolveTourShiftCreateContext(
    rawSearch,
    controller.loading ? undefined : controller.availableTours
  );
  useWasteSchedulingSuccessRedirect({ controller, navigate, search });
  useWasteSchedulingCreateRouteHydration({ controller, context: tourShiftCreateContext, search });
  useWasteSchedulingEditRouteHydration({ controller, navigate, search });

  if (controller.loading) {
    return <StudioLoadingState>{pt('scheduling.messages.loading')}</StudioLoadingState>;
  }

  if (controller.error) {
    return <StudioErrorState>{controller.error}</StudioErrorState>;
  }

  const dialogs = <WasteSchedulingDialogs controller={controller} />;

  if (search.schedulingView === 'create') {
    return (
      <>
        <WasteSchedulingCreateFormView
          controller={controller}
          search={search}
          tourShiftCreateContext={tourShiftCreateContext}
        />
        {dialogs}
      </>
    );
  }

  if (search.schedulingView === 'edit') {
    return (
      <>
        {search.schedulingEntryType === 'holiday-rule' ? (
          <WasteSchedulingHolidayFormView controller={controller} search={search} />
        ) : search.schedulingEntryType === 'global-shift' ? (
          <WasteSchedulingGlobalFormView controller={controller} search={search} />
        ) : (
          <WasteSchedulingTourFormView controller={controller} search={search} />
        )}
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
