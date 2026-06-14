import type { WasteGlobalDateShiftRecord, WasteTourDateShiftRecord } from '@sva/plugin-sdk';

import {
  createDefaultGlobalDateShiftForm,
  createDefaultTourDateShiftForm,
  mapGlobalDateShiftToForm,
  mapTourDateShiftToForm,
} from './waste-management.scheduling.shared.js';
import type { WasteSchedulingState } from './use-waste-scheduling-state.js';

export const createWasteSchedulingActions = (state: WasteSchedulingState) => ({
  openCreateTourShiftDialog: () => {
    state.setDialogMode('create');
    state.setTourShiftForm({
      ...createDefaultTourDateShiftForm(),
      tourId: state.availableTours.length === 1 ? state.availableTours[0]?.id ?? '' : '',
    });
    state.setMessage(null);
    state.setDialogOpen(true);
  },
  openEditTourShiftDialog: (shift: WasteTourDateShiftRecord) => {
    state.setDialogMode('edit');
    state.setTourShiftForm(mapTourDateShiftToForm(shift));
    state.setMessage(null);
    state.setDialogOpen(true);
  },
  openCreateGlobalShiftDialog: () => {
    state.setGlobalDialogMode('create');
    state.setGlobalShiftForm(createDefaultGlobalDateShiftForm());
    state.setMessage(null);
    state.setGlobalDialogOpen(true);
  },
  openEditGlobalShiftDialog: (shift: WasteGlobalDateShiftRecord) => {
    state.setGlobalDialogMode('edit');
    state.setGlobalShiftForm(mapGlobalDateShiftToForm(shift));
    state.setMessage(null);
    state.setGlobalDialogOpen(true);
  },
  resetTourShiftForm: () => state.setTourShiftForm(createDefaultTourDateShiftForm()),
  resetGlobalShiftForm: () => state.setGlobalShiftForm(createDefaultGlobalDateShiftForm()),
});
