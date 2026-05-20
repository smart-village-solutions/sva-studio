import { loadResolvedPublicWasteCalendar } from './public-waste-api.js';
import { parsePublicWasteLocationKey } from './public-waste-contract.js';
import { readPublicWastePreferenceCookie } from './public-waste-preferences.server.js';
import type { PublicWasteRepository } from './public-waste-repository.server.js';

export const loadInitialPublicWastePage = async (input: {
  readonly request: Request;
  readonly repository: Pick<PublicWasteRepository, 'loadCalendarEntries'>;
  readonly referenceDate: string;
}) => {
  const storedLocationKey = readPublicWastePreferenceCookie(input.request);
  const restoredSelection = storedLocationKey ? parsePublicWasteLocationKey(storedLocationKey) : null;

  if (!restoredSelection) {
    return {
      selectionState: 'incomplete' as const,
    };
  }

  const calendar = await loadResolvedPublicWasteCalendar({
    repository: input.repository,
    input: {
      selection: restoredSelection,
      referenceDate: input.referenceDate,
    },
  });

  return {
    selectionState: 'complete' as const,
    ...calendar,
  };
};
