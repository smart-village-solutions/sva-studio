import type { WasteTourRecord } from '@sva/plugin-sdk';
import { getWasteManagementSchedulingOverview } from './waste-management.api.js';

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
    state.setTourForm(mapTourWithPickupDatesToForm(tour, state.schedulingOverview?.locationTourPickupDates ?? []));
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
    const existingLink = state.masterDataOverview?.locationTourLinks.find((link) => link.id === linkId);
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
    state.setSelectedTour(tour);
    try {
      state.setSchedulingOverview(await getWasteManagementSchedulingOverview());
    } catch {
      state.setSchedulingOverview(null);
    }
    state.setCalendarOpen(true);
  },
  resetTourForm: () => state.setTourForm(createDefaultTourForm()),
  resetLinkForm: () => state.setLinkForm(createDefaultLocationTourLinkForm()),
});
