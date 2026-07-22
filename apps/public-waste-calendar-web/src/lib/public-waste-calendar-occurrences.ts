import type { WasteHolidayRuleRecord } from '@sva/core';

import type {
  PublicWasteCalendarEntry,
  PublicWasteResolvedSelection,
} from './public-waste-contract.js';
import {
  addYearsUtc,
  createDateAdvanceStrategy,
  formatDateOnlyUtc,
  isDateWithinRange,
  normalizeDateOnly,
  parseDateOnlyUtc,
  startOfPreviousYearUtc,
} from './public-waste-date-utils.js';

type PublicWasteLinkedFraction = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly shortLabel?: string;
  readonly color?: string;
};

type PublicWasteLinkedTour = {
  readonly linkId: string;
  readonly locationId: string;
  readonly tour: {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly recurrence?:
      'weekly' | 'biweekly' | 'fourweekly' | 'yearly' | 'on-demand' | 'custom' | null;
    readonly customRecurrenceIntervalDays?: number;
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
  readonly holidayRules?: readonly WasteHolidayRuleRecord[];
};

type Occurrence = {
  readonly date: string;
  readonly note: string | null;
};

type HolidayRuleDirection = 'advance' | 'postpone';
type HolidayRuleCoverage = 'single_pickup' | 'rest_of_week';

const compareEntries = (left: PublicWasteCalendarEntry, right: PublicWasteCalendarEntry): number =>
  left.date.localeCompare(right.date) ||
  left.fractionLabel.localeCompare(right.fractionLabel, 'de');

const buildShiftMap = <
  TShift extends {
    readonly originalDate: string;
    readonly actualDate: string;
    readonly description?: string;
  },
>(
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
        return [
          originalDate,
          { actualDate, description: shift.description?.trim() || null },
        ] as const;
      })
      .filter(
        (
          entry
        ): entry is readonly [
          string,
          { readonly actualDate: string; readonly description: string | null },
        ] => entry !== null
      )
  );

const addDays = (value: string, days: number): string | undefined => {
  const parsed = parseDateOnlyUtc(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  parsed.setUTCDate(parsed.getUTCDate() + days);
  return formatDateOnlyUtc(parsed);
};

const addDaysWithWeekendClampForAdvance = (value: string, days: number): string | undefined => {
  const shifted = addDays(value, days);
  if (!shifted || days >= 0) {
    return shifted;
  }

  const parsed = parseDateOnlyUtc(shifted);
  if (Number.isNaN(parsed.getTime())) {
    return shifted;
  }

  return parsed.getUTCDay() === 0 ? addDays(shifted, -1) : shifted;
};

const getWeekStartIso = (value: string): string | undefined => {
  const parsed = parseDateOnlyUtc(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  const weekday = parsed.getUTCDay();
  const mondayShift = weekday === 0 ? -6 : 1 - weekday;
  parsed.setUTCDate(parsed.getUTCDate() + mondayShift);
  return formatDateOnlyUtc(parsed);
};

const isDateAffectedByHolidayRule = (
  date: string,
  rule: Readonly<{
    readonly triggerDate: string;
    readonly direction: HolidayRuleDirection;
    readonly coverage: HolidayRuleCoverage;
  }>
): boolean => {
  if (rule.coverage === 'single_pickup') {
    return date === rule.triggerDate;
  }

  if (getWeekStartIso(date) !== getWeekStartIso(rule.triggerDate)) {
    return false;
  }

  const parsedDate = parseDateOnlyUtc(date);
  const parsedTrigger = parseDateOnlyUtc(rule.triggerDate);
  if (Number.isNaN(parsedDate.getTime()) || Number.isNaN(parsedTrigger.getTime())) {
    return false;
  }

  const dateWeekday = parsedDate.getUTCDay();
  const triggerWeekday = parsedTrigger.getUTCDay();

  return rule.direction === 'postpone'
    ? dateWeekday >= triggerWeekday
    : dateWeekday <= triggerWeekday;
};

const applyHolidayRule = (
  date: string,
  rule: Readonly<{
    readonly triggerDate: string;
    readonly direction: HolidayRuleDirection;
    readonly coverage: HolidayRuleCoverage;
  }>
): string => {
  if (!isDateAffectedByHolidayRule(date, rule)) {
    return date;
  }

  return rule.direction === 'advance'
    ? (addDaysWithWeekendClampForAdvance(date, -1) ?? date)
    : (addDays(date, 1) ?? date);
};

export const applyPublicWasteHolidayRulesToDate = (
  date: string,
  holidayRules: readonly WasteHolidayRuleRecord[]
): string =>
  holidayRules
    .map((rule) => ({
      triggerDate: normalizeDateOnly(rule.holidayDate),
      direction:
        rule.strategy === 'advance' ? 'advance' : rule.strategy === 'postpone' ? 'postpone' : null,
      coverage:
        rule.scope === 'full-week'
          ? 'rest_of_week'
          : rule.scope === 'holiday-only'
            ? 'single_pickup'
            : null,
    }))
    .filter(
      (
        rule
      ): rule is {
        readonly triggerDate: string;
        readonly direction: HolidayRuleDirection;
        readonly coverage: HolidayRuleCoverage;
      } => Boolean(rule.triggerDate && rule.direction && rule.coverage)
    )
    .reduce((currentDate, rule) => applyHolidayRule(currentDate, rule), date);

const calculateTourOccurrences = (
  tour: PublicWasteLinkedTour['tour'],
  windowStart: string,
  windowEnd: string
): readonly Occurrence[] => {
  const occurrences = new Map<string, string | null>();

  const recurringStartDate = normalizeDateOnly(tour.firstDate);
  if ((tour.recurrence || tour.customRecurrenceIntervalDays) && recurringStartDate) {
    const recurringEndDate = normalizeDateOnly(tour.endDate) ?? windowEnd;
    const advance = createDateAdvanceStrategy(tour.recurrence, tour.customRecurrenceIntervalDays);
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
  const normalizedReferenceDate = normalizeDateOnly(input.referenceDate);
  if (!normalizedReferenceDate) {
    return [];
  }
  const windowStart = startOfPreviousYearUtc(normalizedReferenceDate);
  const windowEnd = addYearsUtc(normalizedReferenceDate, 1);
  const entries = new Map<string, PublicWasteCalendarEntry>();
  const holidayRules = (input.holidayRules ?? [])
    .map((rule) => ({
      triggerDate: normalizeDateOnly(rule.holidayDate),
      direction:
        rule.strategy === 'advance' ? 'advance' : rule.strategy === 'postpone' ? 'postpone' : null,
      coverage:
        rule.scope === 'full-week'
          ? 'rest_of_week'
          : rule.scope === 'holiday-only'
            ? 'single_pickup'
            : null,
    }))
    .filter(
      (
        rule
      ): rule is {
        readonly triggerDate: string;
        readonly direction: HolidayRuleDirection;
        readonly coverage: HolidayRuleCoverage;
      } => Boolean(rule.triggerDate) && rule.direction !== null && rule.coverage !== null
    );

  for (const linkedTour of input.linkedTours) {
    const relevantTourDateShifts = input.tourDateShifts.filter(
      (shift) => shift.tourId === linkedTour.tour.id
    );
    const relevantGlobalDateShifts = input.globalDateShifts.filter(
      (shift) => !shift.tourIds || shift.tourIds.includes(linkedTour.tour.id)
    );
    const occurrences = calculateTourOccurrences(linkedTour.tour, windowStart, windowEnd);
    const tourShiftMap = buildShiftMap(relevantTourDateShifts);
    const globalShiftMap = buildShiftMap(relevantGlobalDateShifts);

    for (const occurrence of occurrences) {
      const tourShift = tourShiftMap.get(occurrence.date);
      const globalShift = globalShiftMap.get(occurrence.date);
      const manuallyShiftedDate =
        tourShift?.actualDate ?? globalShift?.actualDate ?? occurrence.date;
      const shiftedDate = holidayRules.reduce(
        (currentDate, rule) => applyHolidayRule(currentDate, rule),
        manuallyShiftedDate
      );
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
          ...(fraction.description ? { fractionDescription: fraction.description } : {}),
          ...(fraction.shortLabel ? { fractionShortLabel: fraction.shortLabel } : {}),
          ...(fraction.color ? { fractionColor: fraction.color } : {}),
          ...(linkedTour.tour.name.trim() ? { tourName: linkedTour.tour.name.trim() } : {}),
          ...(linkedTour.tour.description?.trim()
            ? { tourDescription: linkedTour.tour.description.trim() }
            : {}),
          note,
        });
      }
    }
  }

  return Array.from(entries.values()).sort(compareEntries);
};
