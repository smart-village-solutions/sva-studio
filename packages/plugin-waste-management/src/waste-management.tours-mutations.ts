import { createWasteToursAssignmentMutationHandlers } from './waste-management.tours.assignments-mutations.js';
import { createWasteToursTourMutationHandlers } from './waste-management.tours.tour-mutations.js';
import type { WasteToursState } from './use-waste-tours-state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const createWasteToursMutationHandlers = ({
  state,
  pt,
  loadOverview,
}: {
  readonly state: WasteToursState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
}) => ({
  ...createWasteToursTourMutationHandlers({ state, pt, loadOverview }),
  ...createWasteToursAssignmentMutationHandlers({ state, pt, loadOverview }),
});
