import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { wasteMasterDataFormMappers } from './waste-management.master-data.forms.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteMasterDataController } from './waste-management.master-data.controller.js';

type WasteMasterDataController = ReturnType<typeof useWasteMasterDataController>;

export const useWasteMasterDataFractionSuccessRedirect = ({
  controller,
  navigate,
  search,
}: {
  readonly controller: WasteMasterDataController;
  readonly navigate: ReturnType<typeof useNavigate>;
  readonly search: WasteManagementSearchParams;
}) => {
  const fractionViewSuccess =
    search.fractionsView !== 'list' &&
    (controller.lastOutcome === 'fraction-create-success' || controller.lastOutcome === 'fraction-update-success');

  useEffect(() => {
    if (!fractionViewSuccess) {
      return;
    }

    controller.setDialogOpen(false);
    controller.resetFractionForm();
    controller.setLastOutcome(null);
    void navigate({
      to: '/plugins/waste-management',
      search: {
        ...search,
        fractionsView: 'list',
        wasteFractionId: undefined,
      },
      replace: true,
    });
  }, [controller.resetFractionForm, controller.setDialogOpen, controller.setLastOutcome, fractionViewSuccess, navigate, search]);
};

export const useWasteMasterDataFractionEditRouteHydration = ({
  controller,
  navigate,
  search,
}: {
  readonly controller: WasteMasterDataController;
  readonly navigate: ReturnType<typeof useNavigate>;
  readonly search: WasteManagementSearchParams;
}) => {
  useEffect(() => {
    if (search.fractionsView !== 'edit') {
      return;
    }

    if (!search.wasteFractionId) {
      void navigate({
        to: '/plugins/waste-management',
        search: {
          ...search,
          fractionsView: 'list',
          wasteFractionId: undefined,
        },
        replace: true,
      });
      return;
    }

    const routeFraction = controller.overview?.fractions.find((fraction) => fraction.id === search.wasteFractionId);
    if (!routeFraction || controller.fractionForm.id === routeFraction.id) {
      return;
    }

    controller.setDialogMode('edit');
    controller.setFractionForm(wasteMasterDataFormMappers.fractionToForm(routeFraction));
    controller.setMessage(null);
    controller.setLastOutcome(null);
  }, [
    controller.fractionForm.id,
    controller.overview,
    controller.setDialogMode,
    controller.setFractionForm,
    controller.setLastOutcome,
    controller.setMessage,
    navigate,
    search,
  ]);
};

export const useWasteMasterDataLocationSuccessRedirect = ({
  controller,
  navigate,
  search,
}: {
  readonly controller: WasteMasterDataController;
  readonly navigate: ReturnType<typeof useNavigate>;
  readonly search: WasteManagementSearchParams;
}) => {
  const locationViewSuccess =
    search.locationsView !== 'list' &&
    (controller.lastOutcome === 'location-create-success' || controller.lastOutcome === 'location-update-success');

  useEffect(() => {
    if (!locationViewSuccess) {
      return;
    }

    controller.setLocationDialogOpen(false);
    controller.resetLocationForm();
    controller.setLastOutcome(null);
    void navigate({
      to: '/plugins/waste-management',
      search: {
        ...search,
        locationsView: 'list',
      },
      replace: true,
    });
  }, [
    controller.resetLocationForm,
    controller.setLastOutcome,
    controller.setLocationDialogOpen,
    locationViewSuccess,
    navigate,
    search,
  ]);
};
