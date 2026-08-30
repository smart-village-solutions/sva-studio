import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { wasteMasterDataFormMappers } from './waste-management.master-data.forms.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteMasterDataViewModel } from './use-waste-master-data-view-model.js';

type WasteViewModel = ReturnType<typeof useWasteMasterDataViewModel>;

export const useWasteMasterDataFractionSuccessRedirect = ({
  controller,
  navigate,
  search,
}: {
  readonly controller: WasteViewModel;
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
  readonly controller: WasteViewModel;
  readonly navigate: ReturnType<typeof useNavigate>;
  readonly search: WasteManagementSearchParams;
}) => {
  const hydratedFractionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (search.fractionsView !== 'edit') {
      hydratedFractionIdRef.current = null;
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

    if (!controller.overview) {
      return;
    }

    const routeFraction = controller.overview.fractions.find((fraction) => fraction.id === search.wasteFractionId);
    if (!routeFraction) {
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

    controller.setDialogMode('edit');
    controller.setMessage(null);
    controller.setLastOutcome(null);

    if (hydratedFractionIdRef.current === routeFraction.id) {
      return;
    }

    controller.setFractionForm(wasteMasterDataFormMappers.fractionToForm(routeFraction));
    hydratedFractionIdRef.current = routeFraction.id;
  }, [
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
  readonly controller: WasteViewModel;
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
        collectionLocationId: undefined,
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

export const useWasteMasterDataLocationEditRouteHydration = ({
  controller,
  navigate,
  search,
}: {
  readonly controller: WasteViewModel;
  readonly navigate: ReturnType<typeof useNavigate>;
  readonly search: WasteManagementSearchParams;
}) => {
  const hydratedLocationIdRef = useRef<string | null>(null);
  const [formResetRevision, setFormResetRevision] = useState(0);

  useEffect(() => {
    if (search.locationsView !== 'edit') {
      hydratedLocationIdRef.current = null;
      return;
    }

    if (!search.collectionLocationId) {
      void navigate({
        to: '/plugins/waste-management',
        search: {
          ...search,
          locationsView: 'list',
          collectionLocationId: undefined,
        },
        replace: true,
      });
      return;
    }

    if (!controller.overview) {
      return;
    }

    const routeLocation = controller.overview.collectionLocations.find(
      (location) => location.id === search.collectionLocationId,
    );

    if (!routeLocation) {
      void navigate({
        to: '/plugins/waste-management',
        search: {
          ...search,
          locationsView: 'list',
          collectionLocationId: undefined,
        },
        replace: true,
      });
      return;
    }

    controller.setLocationDialogMode('edit');
    controller.setMessage(null);
    controller.setLastOutcome(null);

    if (hydratedLocationIdRef.current === routeLocation.id) {
      return;
    }

    controller.setLocationForm(wasteMasterDataFormMappers.collectionLocationToForm(routeLocation));
    hydratedLocationIdRef.current = routeLocation.id;
    setFormResetRevision((current) => current + 1);
  }, [
    controller.overview,
    controller.setLastOutcome,
    controller.setLocationDialogMode,
    controller.setLocationForm,
    controller.setMessage,
    navigate,
    search,
  ]);

  return formResetRevision;
};
