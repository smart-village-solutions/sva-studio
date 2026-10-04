import { resolveEffectiveWasteTourDateShiftsForYear } from '@sva/waste-management-contracts';

import type { WasteManagementSchedulingOverview, WasteTourRecord } from './waste-management.api.js';
import {
  applyHolidayRule,
  resolveHolidayRulesForYear,
} from './waste-management.tours.presentation.holidays.js';

const addRecurringDates = (
  results: Set<string>,
  year: number,
  start: Date,
  end: Date,
  advance: (current: Date) => void
) => {
  const current = new Date(start);
  while (current <= end) {
    const iso = formatUtcDate(current);
    if (iso.startsWith(`${year}-`)) {
      results.add(iso);
    }
    advance(current);
  }
};

const parseDateOnlyUtc = (value: string): Date => new Date(`${value}T00:00:00Z`);

const formatUtcDate = (value: Date): string => value.toISOString().slice(0, 10);

const resolveAdvanceStrategy = (
  recurrence: WasteTourRecord['recurrence'],
  customRecurrenceIntervalDays?: number
) => {
  if (typeof customRecurrenceIntervalDays === 'number' && customRecurrenceIntervalDays > 0) {
    return (current: Date) =>
      current.setUTCDate(current.getUTCDate() + customRecurrenceIntervalDays);
  }
  if (recurrence === 'weekly') {
    return (current: Date) => current.setUTCDate(current.getUTCDate() + 7);
  }
  if (recurrence === 'biweekly') {
    return (current: Date) => current.setUTCDate(current.getUTCDate() + 14);
  }
  if (recurrence === 'fourweekly') {
    return (current: Date) => current.setUTCDate(current.getUTCDate() + 28);
  }
  if (recurrence === 'yearly') {
    return (current: Date) => current.setUTCFullYear(current.getUTCFullYear() + 1);
  }
  return null;
};

const collectScheduledTourDates = (results: Set<string>, tour: WasteTourRecord, year: number) => {
  if (!tour.firstDate) {
    return;
  }
  const start = parseDateOnlyUtc(tour.firstDate);
  const end = parseDateOnlyUtc(tour.endDate ?? `${year}-12-31`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return;
  }
  const advance = resolveAdvanceStrategy(tour.recurrence, tour.customRecurrenceIntervalDays);
  if (advance) {
    addRecurringDates(results, year, start, end, advance);
  }
};

const collectCustomTourDates = (results: Set<string>, tour: WasteTourRecord, year: number) => {
  for (const customDate of tour.customDates ?? []) {
    if (customDate.date.startsWith(`${year}-`)) {
      results.add(customDate.date);
    }
  }
};

const buildShiftMap = (
  shifts: readonly { readonly originalDate: string; readonly actualDate: string }[]
): Map<string, string> =>
  new Map(shifts.map((shift) => [shift.originalDate, shift.actualDate] as const));

type TourOccurrenceEntryInternal = Readonly<{
  readonly date: string;
  readonly shifted: boolean;
  readonly originalDate: string | null;
  readonly shiftedByHoliday: boolean;
  readonly holidayNames: readonly string[];
}>;

type ShiftedTourOccurrence = Omit<TourOccurrenceEntryInternal, 'date'>;

const addInboundTourShifts = (
  target: Map<string, ShiftedTourOccurrence>,
  tour: WasteTourRecord,
  year: number,
  scheduling: WasteManagementSchedulingOverview,
  holidayRules: ReturnType<typeof resolveHolidayRulesForYear>
) => {
  const priorYearDates = new Set<string>();
  collectScheduledTourDates(priorYearDates, tour, year - 1);
  collectCustomTourDates(priorYearDates, tour, year - 1);
  const shifts = resolveEffectiveWasteTourDateShiftsForYear(
    (scheduling.tourDateShifts ?? []).filter((shift) => shift.tourId === tour.id),
    year - 1
  ).filter(
    (shift) => priorYearDates.has(shift.originalDate) && shift.actualDate.startsWith(`${year}-`)
  );
  for (const shift of shifts) {
    const holidayNames: string[] = [];
    const date = holidayRules.reduce((currentDate, rule) => {
      const nextDate = applyHolidayRule(currentDate, rule);
      if (nextDate !== currentDate) holidayNames.push(rule.holidayName);
      return nextDate;
    }, shift.actualDate);
    if (!date.startsWith(`${year}-`)) continue;
    const previous = target.get(date);
    const combinedHolidayNames = [...new Set([...(previous?.holidayNames ?? []), ...holidayNames])];
    target.set(date, {
      shifted: true,
      originalDate: previous?.originalDate ?? shift.originalDate,
      shiftedByHoliday: combinedHolidayNames.length > 0,
      holidayNames: combinedHolidayNames,
    });
  }
};

export const calculateTourOccurrenceEntriesForYearInternal = (
  tour: WasteTourRecord,
  year: number,
  scheduling: WasteManagementSchedulingOverview
): readonly TourOccurrenceEntryInternal[] => {
  const results = new Set<string>();
  collectScheduledTourDates(results, tour, year);
  collectCustomTourDates(results, tour, year);

  const tourShiftMap = buildShiftMap(
    resolveEffectiveWasteTourDateShiftsForYear(
      (scheduling.tourDateShifts ?? []).filter((shift) => shift.tourId === tour.id),
      year
    )
  );
  const globalShiftMap = buildShiftMap(
    (scheduling.globalDateShifts ?? []).filter(
      (shift) => !shift.tourIds || shift.tourIds.length === 0 || shift.tourIds.includes(tour.id)
    )
  );
  const holidayRules = resolveHolidayRulesForYear(scheduling, year);

  const shiftedResults = new Map<string, ShiftedTourOccurrence>();
  for (const date of results) {
    const manuallyShifted = tourShiftMap.get(date) ?? globalShiftMap.get(date) ?? date;
    const holidayNames: string[] = [];
    const holidayShifted = holidayRules.reduce((currentDate, rule) => {
      const nextDate = applyHolidayRule(currentDate, rule);
      if (nextDate !== currentDate) {
        holidayNames.push(rule.holidayName);
      }
      return nextDate;
    }, manuallyShifted);
    const shifted = holidayShifted !== date;
    const previous = shiftedResults.get(holidayShifted);
    const combinedHolidayNames = Array.from(
      new Set([...(previous?.holidayNames ?? []), ...holidayNames])
    );
    shiftedResults.set(holidayShifted, {
      shifted: previous?.shifted === true || shifted,
      originalDate: previous?.originalDate ?? (shifted ? date : null),
      shiftedByHoliday: combinedHolidayNames.length > 0,
      holidayNames: combinedHolidayNames,
    });
  }

  addInboundTourShifts(shiftedResults, tour, year, scheduling, holidayRules);

  return Array.from(shiftedResults.entries())
    .filter(([date]) => date.startsWith(`${year}-`))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, entry]) => ({
      date,
      shifted: entry.shifted,
      originalDate: entry.originalDate,
      shiftedByHoliday: entry.shiftedByHoliday,
      holidayNames: entry.holidayNames,
    }));
};

export const calculateTourOccurrencesForYear = (
  tour: WasteTourRecord,
  year: number,
  scheduling: WasteManagementSchedulingOverview
): readonly string[] =>
  calculateTourOccurrenceEntriesForYearInternal(tour, year, scheduling).map((entry) => entry.date);

export const calculateTourOccurrenceEntriesForYear = (
  tour: WasteTourRecord,
  year: number,
  scheduling: WasteManagementSchedulingOverview
): readonly Readonly<{
  readonly date: string;
  readonly shifted: boolean;
  readonly originalDate: string | null;
}>[] =>
  calculateTourOccurrenceEntriesForYearInternal(tour, year, scheduling).map(
    ({ date, shifted, originalDate }) => ({
      date,
      shifted,
      originalDate,
    })
  );
