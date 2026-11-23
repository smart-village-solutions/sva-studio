import type { WasteTourRecord } from '@sva/waste-management-contracts';
import { loadWasteToursSchedulingOverview } from './waste-management.tours-overview.parts.js';

import {
  createDefaultTourForm,
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
});
