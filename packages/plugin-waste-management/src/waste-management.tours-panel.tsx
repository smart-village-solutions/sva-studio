import { useEffect } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';
import { useNavigate } from '@tanstack/react-router';

import { useWasteToursController } from './waste-management.tours.controller.js';
import { WasteToursDialogs } from './waste-management.tours-dialogs-panel.js';
import { WasteToursFormView, WasteToursListView } from './waste-management.tours-panel.views.js';
import { mapTourToForm } from './waste-management.tours.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';

export const WasteToursPanel = ({ search }: { readonly search: WasteManagementSearchParams }) => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const controller = useWasteToursController(pt, search);
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
  }, [controller.resetTourForm, controller.setDialogOpen, controller.setLastOutcome, navigate, search, toursViewSuccess]);

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
    if (!routeTour) {
      return;
    }

    if (controller.tourForm.id === routeTour.id) {
      return;
    }

    controller.setDialogMode('edit');
    controller.setTourForm(mapTourToForm(routeTour));
  }, [controller.overview?.tours, controller.setDialogMode, controller.setTourForm, controller.tourForm.id, navigate, search]);

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
      <WasteToursListView controller={controller} search={search} />
      {dialogs}
    </>
  );
};
