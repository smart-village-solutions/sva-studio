import type { WasteTourRecord } from '@sva/waste-management-contracts';

import {
  createDefaultTourForm,
  mapTourWithPickupDatesToForm,
} from './waste-management.tours.shared.js';
import type { WasteToursState } from './use-waste-tours-state.js';

export const createWasteToursActions = (
  state: WasteToursState,
  refreshScheduling: () => Promise<unknown>
) => ({
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
  openCalendar: async (tour: WasteTourRecord) => {
    state.setSelectedTour(tour);
    state.setCalendarOpen(true);
    await refreshScheduling();
  },
  resetTourForm: () => state.setTourForm(createDefaultTourForm()),
});
