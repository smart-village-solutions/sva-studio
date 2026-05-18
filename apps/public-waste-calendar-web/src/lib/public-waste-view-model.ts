import type { PublicWasteCalendarEntry, PublicWasteFractionOption } from './public-waste-contract.js';

export type PublicWasteCalendarViewModel = {
  readonly locationKey: string;
  readonly nextPickupDate: string | null;
  readonly listEntries: readonly PublicWasteCalendarEntry[];
  readonly monthBuckets: readonly {
    readonly month: string;
    readonly entries: readonly PublicWasteCalendarEntry[];
  }[];
  readonly yearBuckets: readonly {
    readonly year: string;
    readonly entries: readonly PublicWasteCalendarEntry[];
  }[];
  readonly fractionOptions: readonly PublicWasteFractionOption[];
};

export type FilteredPublicWasteCalendarViewModel = PublicWasteCalendarViewModel & {
  readonly activeFractionIds: readonly string[];
};

const matchesFractionFilter = (entry: PublicWasteCalendarEntry, activeFractionIds: readonly string[]): boolean =>
  activeFractionIds.length === 0 || activeFractionIds.includes(entry.fractionId);

export const filterPublicWasteCalendarFractions = (
  model: PublicWasteCalendarViewModel,
  activeFractionIds: readonly string[]
): FilteredPublicWasteCalendarViewModel => ({
  ...model,
  listEntries: model.listEntries.filter((entry) => matchesFractionFilter(entry, activeFractionIds)),
  activeFractionIds: [...activeFractionIds],
});
