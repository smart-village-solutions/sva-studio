import {
  buildPublicWasteLocationKey,
  type PublicWasteSelectionState,
} from './public-waste-contract.js';
import { projectPublicWasteCalendar } from './public-waste-projection.js';
import type { PublicWasteRepository } from './public-waste-repository.server.js';

export const loadNextPublicWasteSelection = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'listSelectionOptions'>;
  readonly input: {
    readonly selection: PublicWasteSelectionState;
  };
}) => {
  const result = await input.repository.listSelectionOptions({
    selection: input.input.selection,
  });

  return {
    status: 'incomplete' as const,
    step: result.step,
    options: result.options,
  };
};

export const loadResolvedPublicWasteCalendar = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'loadCalendarEntries'>;
  readonly input: {
    readonly selection: Required<PublicWasteSelectionState>;
    readonly referenceDate: string;
  };
}) => {
  const entries = await input.repository.loadCalendarEntries({
    selection: input.input.selection,
  });
  const projection = projectPublicWasteCalendar({
    referenceDate: input.input.referenceDate,
    upcomingEntries: entries,
  });

  return {
    locationKey: buildPublicWasteLocationKey(input.input.selection),
    ...projection,
  };
};
