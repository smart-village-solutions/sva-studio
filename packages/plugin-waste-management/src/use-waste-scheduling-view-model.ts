import { createWasteSchedulingActions } from './waste-management.scheduling.actions.js';
import { useWasteSchedulingOverview } from './use-waste-scheduling-overview.js';
import { createWasteSchedulingMutationHandlers } from './waste-management.scheduling-mutations.js';
import {
  createSchedulingTableEntries,
  filterSchedulingTableEntries,
} from './waste-management.scheduling.shared.js';
import { useWasteSchedulingState } from './use-waste-scheduling-state.js';
import type { WasteManagementSearchParams } from './search-params.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteSchedulingViewModel = (pt: Translate, search: WasteManagementSearchParams) => {
  const state = useWasteSchedulingState();
  const loadOverview = useWasteSchedulingOverview(state, pt);
  const actions = createWasteSchedulingActions(state);
  const mutations = createWasteSchedulingMutationHandlers({ state, pt, loadOverview });
  const allSchedulingEntries = createSchedulingTableEntries({
    holidayRules: state.overview?.holidayRules ?? [],
    globalDateShifts: state.overview?.globalDateShifts ?? [],
    tourDateShifts: state.overview?.tourDateShifts ?? [],
    availableTours: state.availableTours,
    pt,
  });

  return {
    ...state,
    holidayRules: state.overview?.holidayRules ?? [],
    allSchedulingEntries,
    schedulingEntries: filterSchedulingTableEntries(allSchedulingEntries, search),
    ...actions,
    ...mutations,
  };
};
