import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { useWasteMasterDataController } from './waste-management.master-data.controller.js';
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
  readonly controller: ReturnType<typeof useWasteMasterDataController>;
  readonly search: WasteManagementSearchParams;
  readonly tab: WasteManagementSearchParams['masterDataTab'];
}) => {
  const navigate = useNavigate();
  const fractionViewSuccess =
    search.fractionsView !== 'list' &&
    (controller.lastOutcome === 'fraction-create-success' || controller.lastOutcome === 'fraction-update-success');
  const locationViewSuccess =
    search.locationsView !== 'list' &&
    (controller.lastOutcome === 'location-create-success' || controller.lastOutcome === 'location-update-success');

  useEffect(() => {
    if (!fractionViewSuccess) {
      return;
    }

    controller.setDialogOpen(false);
    controller.resetFractionForm();
    void navigate({
      to: '/plugins/waste-management',
      search: {
        ...search,
        fractionsView: 'list',
      },
      replace: true,
    });
  }, [controller.resetFractionForm, controller.setDialogOpen, fractionViewSuccess, navigate, search]);

  useEffect(() => {
    if (!locationViewSuccess) {
      return;
    }

    controller.setLocationDialogOpen(false);
    controller.resetLocationForm();
    void navigate({
      to: '/plugins/waste-management',
      search: {
        ...search,
        locationsView: 'list',
      },
      replace: true,
    });
  }, [controller.resetLocationForm, controller.setLocationDialogOpen, locationViewSuccess, navigate, search]);

  if (tab === 'fractions') {
    return <WasteMasterDataFractionsTabView controller={controller} search={search} />;
  }

  return <WasteMasterDataLocationsTabView controller={controller} search={search} />;
};
