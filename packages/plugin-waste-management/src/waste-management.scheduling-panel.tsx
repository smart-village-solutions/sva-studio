import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';
import { useNavigate } from '@tanstack/react-router';

import { useWasteSchedulingViewModel } from './use-waste-scheduling-view-model.js';
import {
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

export const WasteSchedulingPanel = ({ search }: { readonly search: WasteManagementSearchParams }) => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const controller = useWasteSchedulingViewModel(pt, search);
  useWasteSchedulingSuccessRedirect({ controller, navigate, search });
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
        <WasteSchedulingCreateFormView controller={controller} search={search} />
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
