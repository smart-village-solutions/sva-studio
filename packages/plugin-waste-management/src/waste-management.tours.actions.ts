import type { WasteTourRecord } from '@sva/waste-management-contracts';
import { loadWasteToursSchedulingOverview } from './waste-management.tours-overview.parts.js';

import {
  createDefaultLocationTourLinkForm,
  createDefaultTourForm,
  mapLocationTourLinkToForm,
  mapTourWithPickupDatesToForm,
} from './waste-management.tours.shared.js';
import type { WasteToursState } from './use-waste-tours-state.js';

export const createWasteToursActions = (state: WasteToursState) => ({
  openCreateDialog: () => {
    state.setDialogMode('create');
    state.setTourForm(createDefaultTourForm());
    state.setSelectedTour(null);
    state.setMessage(null);
    state.setDialogOpen(true);
  },
  openEditDialog: (tour: WasteTourRecord) => {
    state.setDialogMode('edit');
    state.setSelectedTour(tour);
    state.setTourForm(
      mapTourWithPickupDatesToForm(tour, state.schedulingOverview?.locationTourPickupDates ?? [])
    );
    state.setMessage(null);
    state.setDialogOpen(true);
  },
  openCreateAssignmentsDialog: (tour: WasteTourRecord) => {
    state.setSelectedTour(tour);
    state.setAssignmentsDialogMode('create');
    state.setLinkForm({ ...createDefaultLocationTourLinkForm(), tourId: tour.id });
    state.setMessage(null);
    state.setAssignmentsDialogOpen(true);
  },
  openEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => {
    const existingLink = state.masterDataOverview?.locationTourLinks.find(
      (link) => link.id === linkId
    );
    state.setSelectedTour(tour);
    state.setAssignmentsDialogMode('edit');
    state.setLinkForm(
      existingLink
        ? mapLocationTourLinkToForm(existingLink)
        : { ...createDefaultLocationTourLinkForm(), tourId: tour.id }
    );
    state.setMessage(null);
    state.setAssignmentsDialogOpen(true);
  },
  openCalendar: async (tour: WasteTourRecord) => {
    const request = ++state.schedulingRequestRef.current;
    state.setSelectedTour(tour);
    state.setSchedulingOverview(null);
    state.setSchedulingLoadState('loading');
    state.setCalendarOpen(true);
    await loadWasteToursSchedulingOverview({
      isMounted: () => state.schedulingRequestRef.current === request,
      setSchedulingOverview: state.setSchedulingOverview,
      setSchedulingLoadState: state.setSchedulingLoadState,
    });
  },
  resetTourForm: () => state.setTourForm(createDefaultTourForm()),
  resetLinkForm: () => state.setLinkForm(createDefaultLocationTourLinkForm()),
});
