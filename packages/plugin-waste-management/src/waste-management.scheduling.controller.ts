import { createWasteSchedulingActions } from './waste-management.scheduling.actions.js';
import { useWasteSchedulingDataLoading } from './waste-management.scheduling.loaders.js';
import { createWasteSchedulingSubmitHandlers } from './waste-management.scheduling.submissions.js';
import {
  filterGlobalDateShifts,
  filterTourDateShifts,
} from './waste-management.scheduling.shared.js';
import { useWasteSchedulingState } from './waste-management.scheduling.state.js';
import type { WasteManagementSearchParams } from './search-params.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteSchedulingController = (pt: Translate, search: WasteManagementSearchParams) => {
  const state = useWasteSchedulingState();
  const loadOverview = useWasteSchedulingDataLoading(state, pt);
  const actions = createWasteSchedulingActions(state);
  const submissions = createWasteSchedulingSubmitHandlers({ state, pt, loadOverview });

  return {
    ...state,
    holidayRules: state.overview?.holidayRules ?? [],
    tourDateShifts: filterTourDateShifts(state.overview?.tourDateShifts ?? [], search),
    globalDateShifts: filterGlobalDateShifts(state.overview?.globalDateShifts ?? [], search),
    ...actions,
    ...submissions,
  };
};
