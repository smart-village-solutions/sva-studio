import { createToursAssignmentSubmitHandler } from './waste-management.tours.assignment-mutation.helpers.js';
import type { WasteToursState } from './use-waste-tours-state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const createWasteToursAssignmentMutationHandlers = ({
  state,
  pt,
}: {
  readonly state: WasteToursState;
  readonly pt: Translate;
}) => ({
  onSubmitAssignments: createToursAssignmentSubmitHandler({
    state,
    pt,
  }),
});
