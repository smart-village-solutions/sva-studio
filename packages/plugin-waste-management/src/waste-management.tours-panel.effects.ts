import { useEffect } from 'react';
import type { WasteTourRecord } from '@sva/plugin-sdk';
import { useNavigate } from '@tanstack/react-router';

import { mapTourToForm } from './waste-management.tours.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteToursPanelController = {
  readonly lastOutcome: 'create-success' | 'update-success' | null;
  readonly overview: { readonly tours: readonly WasteTourRecord[] } | null;
  readonly tourForm: { readonly id: string };
  readonly setDialogOpen: (open: boolean) => void;
  readonly setDialogMode: (mode: 'create' | 'edit') => void;
  readonly resetTourForm: () => void;
  readonly setTourForm: (form: ReturnType<typeof mapTourToForm>) => void;
  readonly setLastOutcome: (outcome: 'create-success' | 'update-success' | null) => void;
};

export const useWasteToursSuccessRedirect = ({
  controller,
  navigate,
  search,
}: {
  readonly controller: WasteToursPanelController;
  readonly navigate: ReturnType<typeof useNavigate>;
  readonly search: WasteManagementSearchParams;
}) => {
  const toursViewSuccess =
    search.toursView !== 'list' &&
    (controller.lastOutcome === 'create-success' || controller.lastOutcome === 'update-success');

  useEffect(() => {
    if (!toursViewSuccess) {
      return;
    }

    controller.setDialogOpen(false);
    controller.resetTourForm();
    controller.setLastOutcome(null);
    void navigate({
      to: '/plugins/waste-management',
      search: {
        ...search,
        toursView: 'list',
        tourId: undefined,
      },
      replace: true,
    });
  }, [
    controller.resetTourForm,
    controller.setDialogOpen,
    controller.setLastOutcome,
    navigate,
    search.fractionsSortBy,
    search.fractionsSortDirection,
    search.fractionsView,
    search.globalDateShiftId,
    search.locationsView,
    search.masterDataTab,
    search.page,
    search.pageSize,
    search.q,
    search.regionId,
    search.schedulingView,
    search.shiftContext,
    search.status,
    search.tab,
    search.tourId,
    search.tourDateShiftId,
    search.toursView,
    search.wasteFractionId,
    search.cityId,
    toursViewSuccess,
  ]);
};

export const useWasteToursEditRouteHydration = ({
  controller,
  navigate,
  search,
}: {
  readonly controller: WasteToursPanelController;
  readonly navigate: ReturnType<typeof useNavigate>;
  readonly search: WasteManagementSearchParams;
}) => {
  useEffect(() => {
    if (search.toursView !== 'edit') {
      return;
    }

    if (!search.tourId) {
      void navigate({
        to: '/plugins/waste-management',
        search: {
          ...search,
          toursView: 'list',
        },
        replace: true,
      });
      return;
    }

    const routeTour = controller.overview?.tours.find((tour) => tour.id === search.tourId);
    if (!routeTour || controller.tourForm.id === routeTour.id) {
      return;
    }

    controller.setDialogMode('edit');
    controller.setTourForm(mapTourToForm(routeTour));
  }, [
    controller.overview,
    controller.setDialogMode,
    controller.setTourForm,
    controller.tourForm.id,
    navigate,
    search.fractionsSortBy,
    search.fractionsSortDirection,
    search.fractionsView,
    search.globalDateShiftId,
    search.locationsView,
    search.masterDataTab,
    search.page,
    search.pageSize,
    search.q,
    search.regionId,
    search.schedulingView,
    search.shiftContext,
    search.status,
    search.tab,
    search.tourId,
    search.tourDateShiftId,
    search.toursView,
    search.wasteFractionId,
    search.cityId,
  ]);
};
