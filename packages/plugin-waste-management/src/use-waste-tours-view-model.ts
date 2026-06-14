import { useEffect } from 'react';

import { createWasteToursActions } from './waste-management.tours.actions.js';
import { useWasteToursOverview } from './use-waste-tours-overview.js';
import { resolveTourAssignmentLocationOptions, resolveTourLocationOptions } from './waste-management.tours.locations.js';
import { createWasteToursMutationHandlers } from './waste-management.tours-mutations.js';
import { mapPickupDatesToTourDateLocationAssignments } from './waste-management.tours.shared.js';
import { useWasteToursState } from './use-waste-tours-state.js';
import {
  filterTours,
} from './waste-management.tours.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteToursViewModel = (pt: Translate, search: WasteManagementSearchParams) => {
  const state = useWasteToursState();
  const loadOverview = useWasteToursOverview(state, pt);
  const actions = createWasteToursActions(state);
  const mutations = createWasteToursMutationHandlers({ state, pt, loadOverview });
  const availableFractionIds = new Set(state.availableFractions.map((fraction) => fraction.id));
  const effectiveSearch =
    search.tourWasteFractionId && !availableFractionIds.has(search.tourWasteFractionId)
      ? { ...search, tourWasteFractionId: undefined }
      : search;

  useEffect(() => {
    if (state.dialogMode !== 'edit' || !state.selectedTour || !state.schedulingOverview) {
      return;
    }

    const assignments = mapPickupDatesToTourDateLocationAssignments(
      state.schedulingOverview.locationTourPickupDates,
      state.selectedTour.id
    );

    if (assignments.length === 0 || state.tourForm.id !== state.selectedTour.id || state.tourForm.dateLocationAssignments.length > 0) {
      return;
    }

    state.setTourForm((current) => ({
      ...current,
      dateLocationAssignments: assignments,
    }));
  }, [
    state.dialogMode,
    state.dialogOpen,
    state.schedulingOverview,
    state.selectedTour,
    state.setTourForm,
    state.tourForm.dateLocationAssignments.length,
    state.tourForm.id,
  ]);

  return {
    ...state,
    tours: filterTours(state.overview?.tours ?? [], effectiveSearch),
    locationOptions: resolveTourLocationOptions(pt, state.masterDataOverview),
    assignmentLocationOptions: resolveTourAssignmentLocationOptions(pt, state.masterDataOverview, state.selectedTour?.id),
    ...actions,
    ...mutations,
  };
};
