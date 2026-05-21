import type { PublicWasteCalendarEntry, PublicWasteResolvedSelection } from './public-waste-contract.js';

type PublicWasteLinkedFraction = {
  readonly id: string;
  readonly label: string;
  readonly color?: string;
};

type PublicWasteLinkedTour = {
  readonly linkId: string;
  readonly locationId: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly tour: {
    readonly id: string;
    readonly name: string;
    readonly recurrence?: 'weekly' | 'biweekly' | 'fourweekly' | 'yearly' | 'on-demand' | 'custom' | null;
    readonly firstDate?: string;
    readonly endDate?: string;
    readonly customDates?: readonly {
      readonly date: string;
      readonly description?: string;
    }[];
    readonly fractions: readonly PublicWasteLinkedFraction[];
  };
};

type PublicWasteTourDateShift = {
  readonly id: string;
  readonly tourId: string;
  readonly originalDate: string;
  readonly actualDate: string;
  readonly description?: string;
};

type PublicWasteGlobalDateShift = {
  readonly id: string;
  readonly originalDate: string;
  readonly actualDate: string;
  readonly description?: string;
  readonly tourIds?: readonly string[];
};

export type CalculatePublicWasteCalendarEntriesInput = {
  readonly referenceDate: string;
  readonly selection: PublicWasteResolvedSelection;
  readonly linkedTours: readonly PublicWasteLinkedTour[];
  readonly tourDateShifts: readonly PublicWasteTourDateShift[];
  readonly globalDateShifts: readonly PublicWasteGlobalDateShift[];
};

type Occurrence = {
  readonly date: string;
  readonly note: string | null;
};

const compareEntries = (left: PublicWasteCalendarEntry, right: PublicWasteCalendarEntry): number =>
  left.date.localeCompare(right.date) || left.fractionLabel.localeCompare(right.fractionLabel, 'de');

const normalizeDateOnly = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
};

const parseDateOnlyUtc = (value: string): Date => new Date(`${value}T00:00:00Z`);

const formatDateOnlyUtc = (value: Date): string => value.toISOString().slice(0, 10);

const addYearsUtc = (value: string, years: number): string => {
  const date = parseDateOnlyUtc(value);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return formatDateOnlyUtc(date);
};

const resolveAdvanceStrategy = (
  recurrence: PublicWasteLinkedTour['tour']['recurrence']
): ((current: Date) => void) | null => {
  if (recurrence === 'weekly') {
    return (current) => current.setUTCDate(current.getUTCDate() + 7);
  }
  if (recurrence === 'biweekly') {
    return (current) => current.setUTCDate(current.getUTCDate() + 14);
  }
  if (recurrence === 'fourweekly') {
    return (current) => current.setUTCDate(current.getUTCDate() + 28);
  }
  if (recurrence === 'yearly') {
    return (current) => current.setUTCFullYear(current.getUTCFullYear() + 1);
  }
  return null;
};

const buildShiftMap = <TShift extends { readonly originalDate: string; readonly actualDate: string; readonly description?: string }>(
  shifts: readonly TShift[]
): Map<string, { readonly actualDate: string; readonly description: string | null }> =>
  new Map(
    shifts
      .map((shift) => {
        const originalDate = normalizeDateOnly(shift.originalDate);
        const actualDate = normalizeDateOnly(shift.actualDate);
        if (!originalDate || !actualDate) {
          return null;
        }
        return [originalDate, { actualDate, description: shift.description?.trim() || null }] as const;
      })
      .filter((entry): entry is readonly [string, { readonly actualDate: string; readonly description: string | null }] => entry !== null)
  );

const isDateWithinRange = (date: string, startDate: string, endDate: string): boolean =>
  date >= startDate && date <= endDate;

const calculateTourOccurrences = (
  tour: PublicWasteLinkedTour['tour'],
  windowStart: string,
  windowEnd: string
): readonly Occurrence[] => {
  const occurrences = new Map<string, string | null>();

  const recurringStartDate = normalizeDateOnly(tour.firstDate);
  if (tour.recurrence && recurringStartDate) {
    const recurringEndDate = normalizeDateOnly(tour.endDate) ?? windowEnd;
    const advance = resolveAdvanceStrategy(tour.recurrence);
    if (advance) {
      const current = parseDateOnlyUtc(recurringStartDate);
      const end = parseDateOnlyUtc(recurringEndDate);
      while (current <= end) {
        const date = formatDateOnlyUtc(current);
        if (isDateWithinRange(date, windowStart, windowEnd)) {
          occurrences.set(date, occurrences.get(date) ?? null);
        }
        advance(current);
      }
    }
  }

  for (const customDate of tour.customDates ?? []) {
    const date = normalizeDateOnly(customDate.date);
    if (!date || !isDateWithinRange(date, windowStart, windowEnd)) {
      continue;
    }
    occurrences.set(date, customDate.description?.trim() || null);
  }

  return Array.from(occurrences.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, note]) => ({ date, note }));
};

export const calculatePublicWasteCalendarEntries = (
  input: CalculatePublicWasteCalendarEntriesInput
): readonly PublicWasteCalendarEntry[] => {
  const windowStart = normalizeDateOnly(input.referenceDate);
  if (!windowStart) {
    return [];
  }
  const windowEnd = addYearsUtc(windowStart, 1);

  const entries = new Map<string, PublicWasteCalendarEntry>();

  for (const linkedTour of input.linkedTours) {
    const linkStartDate = normalizeDateOnly(linkedTour.startDate) ?? windowStart;
    const linkEndDate = normalizeDateOnly(linkedTour.endDate) ?? windowEnd;
    const occurrences = calculateTourOccurrences(
      linkedTour.tour,
      linkStartDate > windowStart ? linkStartDate : windowStart,
      linkEndDate < windowEnd ? linkEndDate : windowEnd
    );
    const tourShiftMap = buildShiftMap(input.tourDateShifts.filter((shift) => shift.tourId === linkedTour.tour.id));
    const globalShiftMap = buildShiftMap(
      input.globalDateShifts.filter((shift) => !shift.tourIds || shift.tourIds.includes(linkedTour.tour.id))
    );

    for (const occurrence of occurrences) {
      const tourShift = tourShiftMap.get(occurrence.date);
      const globalShift = globalShiftMap.get(occurrence.date);
      const shiftedDate = tourShift?.actualDate ?? globalShift?.actualDate ?? occurrence.date;
      const note = tourShift?.description ?? globalShift?.description ?? occurrence.note;

      if (!isDateWithinRange(shiftedDate, windowStart, windowEnd)) {
        continue;
      }

      for (const fraction of linkedTour.tour.fractions) {
        const entryId = `${linkedTour.tour.id}:${shiftedDate}:${fraction.id}`;
        entries.set(entryId, {
          id: entryId,
          date: shiftedDate,
          fractionId: fraction.id,
          fractionLabel: fraction.label,
          ...(fraction.color ? { fractionColor: fraction.color } : {}),
          note,
        });
      }
    }
  }

  return Array.from(entries.values()).sort(compareEntries);
};
