import { createWasteToursAssignmentSubmitHandlers } from './waste-management.tours.assignments-submissions.js';
import { createWasteToursTourSubmitHandlers } from './waste-management.tours.tour-submissions.js';
import type { WasteToursState } from './waste-management.tours.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const createWasteToursSubmitHandlers = ({
  state,
  pt,
  loadOverview,
}: {
  readonly state: WasteToursState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
}) => ({
  ...createWasteToursTourSubmitHandlers({ state, pt, loadOverview }),
  ...createWasteToursAssignmentSubmitHandlers({ state, pt, loadOverview }),
});
