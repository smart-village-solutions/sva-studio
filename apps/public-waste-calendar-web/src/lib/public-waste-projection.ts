import type { PublicWasteCalendarEntry, PublicWasteFractionOption } from './public-waste-contract.js';

export type ProjectPublicWasteCalendarInput = {
  readonly referenceDate: string;
  readonly upcomingEntries: readonly PublicWasteCalendarEntry[];
};

export type PublicWasteCalendarProjection = {
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

const compareEntries = (left: PublicWasteCalendarEntry, right: PublicWasteCalendarEntry): number =>
  left.date.localeCompare(right.date) || left.fractionLabel.localeCompare(right.fractionLabel, 'de');

const buildGroupedEntries = (
  entries: readonly PublicWasteCalendarEntry[],
  selector: (entry: PublicWasteCalendarEntry) => string
): ReadonlyMap<string, readonly PublicWasteCalendarEntry[]> =>
  entries.reduce<Map<string, PublicWasteCalendarEntry[]>>((groups, entry) => {
    const groupKey = selector(entry);
    const bucket = groups.get(groupKey);
    if (bucket) {
      bucket.push(entry);
    } else {
      groups.set(groupKey, [entry]);
    }
    return groups;
  }, new Map());

const groupEntriesByMonth = (
  entries: readonly PublicWasteCalendarEntry[]
): PublicWasteCalendarProjection['monthBuckets'] =>
  Array.from(buildGroupedEntries(entries, (entry) => entry.date.slice(0, 7)).entries()).map(([month, bucket]) => ({
    month,
    entries: bucket,
  }));

const groupEntriesByYear = (
  entries: readonly PublicWasteCalendarEntry[]
): PublicWasteCalendarProjection['yearBuckets'] =>
  Array.from(buildGroupedEntries(entries, (entry) => entry.date.slice(0, 4)).entries()).map(([year, bucket]) => ({
    year,
    entries: bucket,
  }));

const deriveFractionOptions = (entries: readonly PublicWasteCalendarEntry[]): readonly PublicWasteFractionOption[] =>
  Array.from(
    new Map(
      entries.map((entry) => [
        entry.fractionId,
        {
          id: entry.fractionId,
          label: entry.fractionLabel,
          ...(entry.fractionColor ? { color: entry.fractionColor } : {}),
        },
      ])
    ).values()
  ).sort((left, right) => left.label.localeCompare(right.label, 'de'));

export const projectPublicWasteCalendar = (
  input: ProjectPublicWasteCalendarInput
): PublicWasteCalendarProjection => {
  const listEntries = [...input.upcomingEntries].sort(compareEntries);

  return {
    nextPickupDate: listEntries[0]?.date ?? null,
    listEntries,
    monthBuckets: groupEntriesByMonth(listEntries),
    yearBuckets: groupEntriesByYear(listEntries),
    fractionOptions: deriveFractionOptions(listEntries),
  };
};
