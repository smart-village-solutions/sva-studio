import { useEffect, useRef } from 'react';
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

const useLatestRef = <T,>(value: T) => {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
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
  const latestSearchRef = useLatestRef(search);
  const latestControllerRef = useLatestRef({
    resetTourForm: controller.resetTourForm,
    setDialogOpen: controller.setDialogOpen,
    setLastOutcome: controller.setLastOutcome,
  });
  const toursViewSuccess =
    search.toursView !== 'list' &&
    (controller.lastOutcome === 'create-success' || controller.lastOutcome === 'update-success');

  useEffect(() => {
    if (!toursViewSuccess) {
      return;
    }

    const latestSearch = latestSearchRef.current;
    const latestController = latestControllerRef.current;

    latestController.setDialogOpen(false);
    latestController.resetTourForm();
    latestController.setLastOutcome(null);
    void navigate({
      to: '/plugins/waste-management',
      search: {
        ...latestSearch,
        toursView: 'list',
        tourId: undefined,
      },
      replace: true,
    });
  }, [latestControllerRef, latestSearchRef, navigate, toursViewSuccess]);
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
  const latestSearchRef = useLatestRef(search);
  const latestControllerRef = useLatestRef({
    setDialogMode: controller.setDialogMode,
    setTourForm: controller.setTourForm,
  });

  useEffect(() => {
    if (search.toursView !== 'edit') {
      return;
    }

    if (!search.tourId) {
      const latestSearch = latestSearchRef.current;
      void navigate({
        to: '/plugins/waste-management',
        search: {
          ...latestSearch,
          toursView: 'list',
          tourId: undefined,
        },
        replace: true,
      });
      return;
    }

    if (!controller.overview) {
      return;
    }

    const routeTour = controller.overview?.tours.find((tour) => tour.id === search.tourId);

    if (!routeTour) {
      const latestSearch = latestSearchRef.current;
      void navigate({
        to: '/plugins/waste-management',
        search: {
          ...latestSearch,
          toursView: 'list',
          tourId: undefined,
        },
        replace: true,
      });
      return;
    }

    const latestController = latestControllerRef.current;
    latestController.setDialogMode('edit');

    if (controller.tourForm.id === routeTour.id) {
      return;
    }

    latestController.setTourForm(mapTourToForm(routeTour));
    controller.setLastOutcome(null);
  }, [
    controller.overview,
    controller.setLastOutcome,
    controller.tourForm.id,
    latestControllerRef,
    latestSearchRef,
    navigate,
    search.tourId,
    search.toursView,
  ]);
};
