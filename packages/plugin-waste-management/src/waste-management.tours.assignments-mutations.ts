import { createToursAssignmentSubmitHandler } from './waste-management.tours.assignment-mutation.helpers.js';
import type { WasteToursState } from './use-waste-tours-state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const createWasteToursAssignmentMutationHandlers = ({
  state,
  pt,
  loadOverview,
}: {
  readonly state: WasteToursState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
}) => ({
  onSubmitAssignments: createToursAssignmentSubmitHandler({
    state,
    pt,
    loadOverview,
  }),
});
