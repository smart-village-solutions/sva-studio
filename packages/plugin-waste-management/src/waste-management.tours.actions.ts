import type { WasteTourRecord } from '@sva/core';

import {
  createDefaultLocationTourLinkForm,
  createDefaultTourForm,
  mapLocationTourLinkToForm,
  mapTourToForm,
} from './waste-management.tours.shared.js';
import type { WasteToursState } from './waste-management.tours.state.js';

export const createWasteToursActions = (state: WasteToursState) => ({
  openCreateDialog: () => {
    state.setDialogMode('create');
    state.setTourForm(createDefaultTourForm());
    state.setMessage(null);
    state.setDialogOpen(true);
  },
  openEditDialog: (tour: WasteTourRecord) => {
    state.setDialogMode('edit');
    state.setTourForm(mapTourToForm(tour));
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
    const link = (state.masterDataOverview?.locationTourLinks ?? []).find((entry) => entry.id === linkId);
    if (!link) {
      return;
    }
    state.setSelectedTour(tour);
    state.setAssignmentsDialogMode('edit');
    state.setLinkForm(mapLocationTourLinkToForm(link));
    state.setMessage(null);
    state.setAssignmentsDialogOpen(true);
  },
  openCalendar: (tour: WasteTourRecord) => {
    state.setSelectedTour(tour);
    state.setCalendarOpen(true);
  },
  resetTourForm: () => state.setTourForm(createDefaultTourForm()),
  resetLinkForm: () => state.setLinkForm(createDefaultLocationTourLinkForm()),
});
