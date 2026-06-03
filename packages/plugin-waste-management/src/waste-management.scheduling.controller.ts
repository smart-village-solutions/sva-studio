import { createWasteSchedulingActions } from './waste-management.scheduling.actions.js';
import { useWasteSchedulingDataLoading } from './waste-management.scheduling.loaders.js';
import { createWasteSchedulingSubmitHandlers } from './waste-management.scheduling.submissions.js';
import {
  createSchedulingTableEntries,
  filterSchedulingTableEntries,
} from './waste-management.scheduling.shared.js';
import { useWasteSchedulingState } from './waste-management.scheduling.state.js';
import type { WasteManagementSearchParams } from './search-params.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteSchedulingController = (pt: Translate, search: WasteManagementSearchParams) => {
  const state = useWasteSchedulingState();
  const loadOverview = useWasteSchedulingDataLoading(state, pt);
  const actions = createWasteSchedulingActions(state);
  const submissions = createWasteSchedulingSubmitHandlers({ state, pt, loadOverview });
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
    ...submissions,
  };
};
