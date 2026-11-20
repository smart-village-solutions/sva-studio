import type { PublicWasteCalendarEntry, PublicWasteFractionOption } from './public-waste-contract.js';

export type PublicWastePdfAvailability = readonly {
  readonly year: number;
  readonly fractionOptions: readonly PublicWasteFractionOption[];
}[];

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
  readonly pdfAvailability?: PublicWastePdfAvailability;
};

export type FilteredPublicWasteCalendarViewModel = PublicWasteCalendarViewModel & {
  readonly activeFractionIds: readonly string[];
};

export const combinePublicWastePdfFractionOptions = (
  calendarFractions: readonly PublicWasteFractionOption[],
  pdfAvailability?: PublicWastePdfAvailability
): readonly PublicWasteFractionOption[] => {
  const options = new Map(calendarFractions.map((fraction) => [fraction.id, fraction]));
  for (const { fractionOptions } of pdfAvailability ?? []) {
    for (const fraction of fractionOptions) {
      if (!options.has(fraction.id)) options.set(fraction.id, fraction);
    }
  }
  return [...options.values()].sort((left, right) => left.label.localeCompare(right.label, 'de'));
};

const matchesFractionFilter = (entry: PublicWasteCalendarEntry, activeFractionIds: readonly string[]): boolean =>
  activeFractionIds.includes(entry.fractionId);

export const filterPublicWasteCalendarFractions = (
  model: PublicWasteCalendarViewModel,
  activeFractionIds: readonly string[]
): FilteredPublicWasteCalendarViewModel => ({
  ...model,
  listEntries: model.listEntries.filter((entry) => matchesFractionFilter(entry, activeFractionIds)),
  activeFractionIds: [...activeFractionIds],
});
