import {
  isValidWasteIsoDateOnly,
  isWasteTourValidityApplicable,
  resolveEffectiveWasteTourDateShiftsForYear,
} from '@sva/waste-management-contracts';

import type { WasteManagementSchedulingOverview, WasteTourRecord } from './waste-management.api.js';
import {
  applyTourHolidayRules,
  resolveHolidayRulesForYear,
} from './waste-management.tours.presentation.holidays.js';

export type TourCalendarIssue =
  'missingStartDate' | 'invalidDates' | 'unresolvedRecurrence' | 'incompleteHolidayRule';

type CalendarIssues = Set<TourCalendarIssue>;

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
  if (
    typeof customRecurrenceIntervalDays === 'number' &&
    Number.isInteger(customRecurrenceIntervalDays) &&
    customRecurrenceIntervalDays > 0
  ) {
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

const hasUnresolvedRecurrence = (
  tour: WasteTourRecord,
  advance: ReturnType<typeof resolveAdvanceStrategy>
): boolean =>
  Boolean(
    (tour.customRecurrenceId &&
      (!Number.isInteger(tour.customRecurrenceIntervalDays) ||
        (tour.customRecurrenceIntervalDays ?? 0) <= 0)) ||
    (!advance &&
      (Boolean(tour.customRecurrenceId) ||
        (tour.recurrence != null && !['custom', 'on-demand'].includes(tour.recurrence))))
  );

const collectScheduledTourDates = (
  results: Set<string>,
  tour: WasteTourRecord,
  year: number,
  issues?: CalendarIssues
) => {
  const advance = resolveAdvanceStrategy(tour.recurrence, tour.customRecurrenceIntervalDays);
  if (hasUnresolvedRecurrence(tour, advance)) {
    issues?.add('unresolvedRecurrence');
  }
  if (!advance) return;
  if (!tour.firstDate) {
    issues?.add('missingStartDate');
    return;
  }
  if (
    !isValidWasteIsoDateOnly(tour.firstDate) ||
    (tour.endDate && (!isValidWasteIsoDateOnly(tour.endDate) || tour.endDate < tour.firstDate))
  ) {
    issues?.add('invalidDates');
    return;
  }
  addRecurringDates(
    results,
    year,
    parseDateOnlyUtc(tour.firstDate),
    parseDateOnlyUtc(tour.endDate ?? `${year}-12-31`),
    advance
  );
};

const collectCustomTourDates = (
  results: Set<string>,
  tour: WasteTourRecord,
  year: number,
  issues?: CalendarIssues
) => {
  for (const customDate of tour.customDates ?? []) {
    if (!isValidWasteIsoDateOnly(customDate.date)) {
      issues?.add('invalidDates');
    } else if (customDate.date.startsWith(`${year}-`)) {
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
  holidayRules: ReturnType<typeof resolveHolidayRulesForYear>,
  issues?: CalendarIssues
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
    const { date, holidayNames } = applyTourHolidayRules(
      shift.actualDate, scheduling, holidayRules, issues
    );
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
  scheduling: WasteManagementSchedulingOverview,
  issues?: CalendarIssues
): readonly TourOccurrenceEntryInternal[] => {
  const results = new Set<string>();
  collectScheduledTourDates(results, tour, year, issues);
  collectCustomTourDates(results, tour, year, issues);

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
    const shiftTarget = tourShiftMap.get(date) ?? globalShiftMap.get(date) ?? date;
    const manuallyShifted = isValidWasteIsoDateOnly(shiftTarget) ? shiftTarget : date;
    if (manuallyShifted !== shiftTarget) issues?.add('invalidDates');
    const { date: holidayShifted, holidayNames } = applyTourHolidayRules(
      manuallyShifted, scheduling, holidayRules, issues
    );
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

  addInboundTourShifts(shiftedResults, tour, year, scheduling, holidayRules, issues);

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

export const calculateTourCalendarForYear = (
  tour: WasteTourRecord,
  year: number,
  scheduling: WasteManagementSchedulingOverview
) => {
  const issues = new Set<TourCalendarIssue>();
  const entries = calculateTourOccurrenceEntriesForYearInternal(tour, year, scheduling, issues).map(
    ({ date, shifted, originalDate }) => ({ date, shifted, originalDate })
  );
  const outsideValidityMonths = Array.from({ length: 12 }, (_, monthIndex) => {
    const firstDay = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const lastDay = formatUtcDate(new Date(Date.UTC(year, monthIndex + 1, 0)));
    return (
      isWasteTourValidityApplicable(tour) &&
      issues.size === 0 &&
      !entries.some((entry) => entry.date.slice(0, 7) === firstDay.slice(0, 7)) &&
      Boolean(
        (tour.firstDate && tour.firstDate > lastDay) || (tour.endDate && tour.endDate < firstDay)
      )
    );
  });
  return { entries, issues: [...issues], outsideValidityMonths };
};
