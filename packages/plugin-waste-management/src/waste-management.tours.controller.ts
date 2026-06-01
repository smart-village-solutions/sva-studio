import { createWasteToursActions } from './waste-management.tours.actions.js';
import { useWasteToursDataLoading } from './waste-management.tours.loaders.js';
import { resolveTourAssignmentLocationOptions, resolveTourLocationOptions } from './waste-management.tours.locations.js';
import { createWasteToursSubmitHandlers } from './waste-management.tours.submissions.js';
import { useWasteToursState } from './waste-management.tours.state.js';
import {
  filterTours,
} from './waste-management.tours.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteToursController = (pt: Translate, search: WasteManagementSearchParams) => {
  const state = useWasteToursState();
  const loadOverview = useWasteToursDataLoading(state, pt);
  const actions = createWasteToursActions(state);
  const submissions = createWasteToursSubmitHandlers({ state, pt, loadOverview });
  const availableFractionIds = new Set(state.availableFractions.map((fraction) => fraction.id));
  const effectiveSearch =
    search.tourWasteFractionId && !availableFractionIds.has(search.tourWasteFractionId)
      ? { ...search, tourWasteFractionId: undefined }
      : search;

  return {
    ...state,
    tours: filterTours(state.overview?.tours ?? [], effectiveSearch),
    locationOptions: resolveTourLocationOptions(pt, state.masterDataOverview),
    assignmentLocationOptions: resolveTourAssignmentLocationOptions(pt, state.masterDataOverview, state.selectedTour?.id),
    ...actions,
    ...submissions,
  };
};
