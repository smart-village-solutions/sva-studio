import { createWasteSchedulingGlobalSubmitHandlers } from './waste-management.scheduling-global-submissions.js';
import { createWasteSchedulingTourSubmitHandlers } from './waste-management.scheduling-tour-submissions.js';
import type { WasteSchedulingState } from './waste-management.scheduling.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const createWasteSchedulingSubmitHandlers = ({
  state,
  pt,
  loadOverview,
}: {
  readonly state: WasteSchedulingState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
}) => ({
  ...createWasteSchedulingTourSubmitHandlers({ state, pt, loadOverview }),
  ...createWasteSchedulingGlobalSubmitHandlers({ state, pt, loadOverview }),
});
