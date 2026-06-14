import { useNavigate } from '@tanstack/react-router';

import { useWasteMasterDataViewModel } from './use-waste-master-data-view-model.js';
import {
  useWasteMasterDataFractionEditRouteHydration,
  useWasteMasterDataFractionSuccessRedirect,
  useWasteMasterDataLocationEditRouteHydration,
  useWasteMasterDataLocationSuccessRedirect,
} from './waste-management.master-data-tab-content.effects.js';
import {
  WasteMasterDataFractionsTabView,
  WasteMasterDataLocationsTabView,
} from './waste-management.master-data-tab-content.views.js';
import type { WasteManagementSearchParams } from './search-params.js';

export const WasteMasterDataTabContent = ({
  controller,
  search,
  tab,
}: {
  readonly controller: ReturnType<typeof useWasteMasterDataViewModel>;
  readonly search: WasteManagementSearchParams;
  readonly tab: WasteManagementSearchParams['masterDataTab'];
}) => {
  const navigate = useNavigate();
  useWasteMasterDataFractionSuccessRedirect({ controller, navigate, search });
  useWasteMasterDataFractionEditRouteHydration({ controller, navigate, search });
  useWasteMasterDataLocationSuccessRedirect({ controller, navigate, search });
  useWasteMasterDataLocationEditRouteHydration({ controller, navigate, search });

  if (tab === 'fractions') {
    return <WasteMasterDataFractionsTabView controller={controller} search={search} />;
  }

  return <WasteMasterDataLocationsTabView controller={controller} search={search} />;
};
