import type { WasteToursState } from './use-waste-tours-state.js';

export type Translate = (
  key: string,
  variables?: Readonly<Record<string, string | number>>
) => string;

export type WasteToursSubmissionContext = Readonly<{
  state: WasteToursState;
  pt: Translate;
  loadOverview: (active?: boolean) => Promise<void>;
}>;

export const validateTourAssignments = (state: WasteToursState, pt: Translate) => {
  const activeDates = new Set(state.tourForm.customDates.map((entry) => entry.date));
  for (const assignment of state.tourForm.dateLocationAssignments) {
    if (!activeDates.has(assignment.pickupDate)) continue;
    if (assignment.locationId.trim().length === 0 || assignment.note.trim().length === 0) {
      state.setMessage({ kind: 'error', text: pt('tours.messages.assignmentIncomplete') });
      return false;
    }
  }
  return true;
};
