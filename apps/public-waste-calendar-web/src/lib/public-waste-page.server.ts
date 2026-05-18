import { loadResolvedPublicWasteCalendar } from './public-waste-api.js';
import { readPublicWastePreferenceCookie } from './public-waste-preferences.server.js';
import type { PublicWasteRepository } from './public-waste-repository.server.js';

const parseStoredLocationKey = (
  locationKey: string
):
  | {
      readonly regionId: string;
      readonly cityId: string;
      readonly streetId: string;
      readonly houseNumberId: string;
    }
  | null => {
  const [regionId, cityId, streetId, houseNumberId] = locationKey.split(':');
  if (!regionId || !cityId || !streetId || !houseNumberId) {
    return null;
  }

  return {
    regionId,
    cityId,
    streetId,
    houseNumberId,
  };
};

export const loadInitialPublicWastePage = async (input: {
  readonly request: Request;
  readonly repository: Pick<PublicWasteRepository, 'loadCalendarEntries'>;
  readonly referenceDate: string;
}) => {
  const storedLocationKey = readPublicWastePreferenceCookie(input.request);
  const restoredSelection = storedLocationKey ? parseStoredLocationKey(storedLocationKey) : null;

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
    restoredLocationNotice: 'Gespeicherte Adresse geladen. Sie können die Auswahl ändern.',
    ...calendar,
  };
};
