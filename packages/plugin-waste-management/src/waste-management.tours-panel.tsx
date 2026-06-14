import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';
import { useNavigate } from '@tanstack/react-router';

import { useWasteToursViewModel } from './use-waste-tours-view-model.js';
import { WasteToursDialogs } from './waste-management.tours-dialogs-panel.js';
import {
  useWasteToursEditRouteHydration,
  useWasteToursSuccessRedirect,
} from './waste-management.tours-panel.effects.js';
import { WasteToursFormView, WasteToursListView } from './waste-management.tours-panel.views.js';
import type { WasteManagementSearchParams } from './search-params.js';

export const WasteToursPanel = ({
  search,
  canDuplicateTour = false,
}: {
  readonly search: WasteManagementSearchParams;
  readonly canDuplicateTour?: boolean;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const controller = useWasteToursViewModel(pt, search);

  useWasteToursSuccessRedirect({ controller, navigate, search });
  useWasteToursEditRouteHydration({ controller, navigate, search });

  if (controller.loading) {
    return <StudioLoadingState>{pt('tours.messages.loading')}</StudioLoadingState>;
  }

  if (controller.error) {
    return <StudioErrorState>{controller.error}</StudioErrorState>;
  }

  const dialogs = <WasteToursDialogs controller={controller} />;

  if (search.toursView !== 'list') {
    return (
      <>
        <WasteToursFormView controller={controller} search={search} />
        {dialogs}
      </>
    );
  }

  return (
    <>
      <WasteToursListView controller={controller} search={search} canDuplicateTour={canDuplicateTour} />
      {dialogs}
    </>
  );
};
