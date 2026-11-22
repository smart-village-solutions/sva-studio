import { useMemo } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';
import { useNavigate } from '@tanstack/react-router';

import { useWasteToursViewModel } from './use-waste-tours-view-model.js';
import { TourAssignmentsPage } from './waste-management.tours-assignments-page.js';
import { resolveTourAssignmentLocationOptions } from './waste-management.tours.locations.js';
import { toToursListSearch } from './waste-management.tours-list-view.navigation.js';
import { captureWasteTourAssignmentWriteAccess } from './waste-management.ui-access.js';
import { WasteToursDialogs } from './waste-management.tours-dialogs-panel.js';
import {
  useWasteToursDuplicateRouteHydration,
  useWasteToursEditRouteHydration,
  useWasteToursSuccessRedirect,
} from './waste-management.tours-panel.effects.js';
import { WasteToursFormView, WasteToursListView } from './waste-management.tours-panel.views.js';
import type { WasteManagementSearchParams } from './search-params.js';

export const WasteToursPanel = ({
  search,
  assignmentContextKey = null,
  canDuplicateTour = false,
  canManageScheduling = false,
}: {
  readonly search: WasteManagementSearchParams;
  readonly assignmentContextKey?: string | null;
  readonly canDuplicateTour?: boolean;
  readonly canManageScheduling?: boolean;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const controller = useWasteToursViewModel(pt, search);

  const assignmentTour =
    search.toursView === 'assignments'
      ? controller.overview?.tours.find((tour) => tour.id === search.tourId)
      : undefined;
  const assignmentLocations = useMemo(
    () =>
      resolveTourAssignmentLocationOptions(pt, controller.masterDataOverview, assignmentTour?.id),
    [pt, controller.masterDataOverview, assignmentTour?.id]
  );

  useWasteToursSuccessRedirect({ controller, navigate, search });
  useWasteToursEditRouteHydration({ controller, navigate, search });
  useWasteToursDuplicateRouteHydration({ controller, search });

  if (controller.loading) {
    return <StudioLoadingState>{pt('tours.messages.loading')}</StudioLoadingState>;
  }

  if (controller.error) {
    return <StudioErrorState>{controller.error}</StudioErrorState>;
  }

  if (search.toursView === 'assignments') {
    const goToList = (saved = false) =>
      void navigate({
        to: '/plugins/waste-management',
        search: toToursListSearch(search),
        replace: true,
        ignoreBlocker: saved,
      });
    if (!assignmentContextKey || !assignmentTour) {
      return (
        <>
          <Button type="button" variant="secondary" onClick={() => goToList()}>
            {pt('tours.assignments.actions.backToList')}
          </Button>
          <StudioErrorState>
            {pt(
              assignmentContextKey
                ? 'tours.messages.loadError'
                : 'tours.assignments.messages.saveForbidden'
            )}
          </StudioErrorState>
        </>
      );
    }
    return (
      <TourAssignmentsPage
        key={assignmentTour.id}
        tour={assignmentTour}
        locations={assignmentLocations}
        saving={controller.saving}
        loading={controller.assignmentContextLoading}
        unavailable={!controller.masterDataOverview}
        message={controller.message}
        onBack={() => goToList()}
        onSubmit={async (changes) => {
          const canContinue = captureWasteTourAssignmentWriteAccess(assignmentContextKey);
          if (
            canContinue &&
            (await controller.onSubmitAssignments(assignmentTour.id, changes, canContinue))
          ) {
            goToList(true);
          }
        }}
      />
    );
  }

  const dialogs = (
    <WasteToursDialogs
      controller={controller}
      search={search}
      canManageScheduling={canManageScheduling}
    />
  );

  if (search.toursView !== 'list') {
    return (
      <>
        <WasteToursFormView
          controller={controller}
          search={search}
          canManageAssignments={assignmentContextKey !== null}
          canManageScheduling={canManageScheduling}
        />
        {dialogs}
      </>
    );
  }

  return (
    <>
      <WasteToursListView
        controller={controller}
        search={search}
        canDuplicateTour={canDuplicateTour}
        canManageAssignments={assignmentContextKey !== null}
        canManageScheduling={canManageScheduling}
      />
      {dialogs}
    </>
  );
};
