import type {
  WasteManagementSchedulingOverview,
  WasteTourRecord,
} from './waste-management.api.js';

export const formatTourRecurrence = (
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string,
  value: WasteTourRecord['recurrence'] | undefined,
  customRecurrenceName?: string,
  customRecurrenceIntervalDays?: number
) => {
  if (customRecurrenceName) {
    if (typeof customRecurrenceIntervalDays === 'number' && customRecurrenceIntervalDays > 0) {
      return pt('tours.meta.customRecurrenceLabel', {
        name: customRecurrenceName,
        days: customRecurrenceIntervalDays,
      });
    }
    return customRecurrenceName;
  }

  if (!value) {
    return '—';
  }

  const translationKeyMap = {
    weekly: 'tours.recurrence.weekly',
    biweekly: 'tours.recurrence.biweekly',
    fourweekly: 'tours.recurrence.fourweekly',
    yearly: 'tours.recurrence.yearly',
    'on-demand': 'tours.recurrence.onDemand',
    custom: 'tours.recurrence.custom',
  } as const satisfies Record<NonNullable<WasteTourRecord['recurrence']>, string>;

  return pt(translationKeyMap[value as NonNullable<WasteTourRecord['recurrence']>]);
};

export const formatTourDateRange = (tour: WasteTourRecord) => {
  if (tour.firstDate && tour.endDate) {
    return `${tour.firstDate} – ${tour.endDate}`;
  }
  return tour.firstDate ?? tour.endDate ?? '—';
};

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

const editorDateOnlyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const formatDateOnlyParts = (value: Date): string | undefined => {
  const parts = editorDateOnlyFormatter.formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return year && month && day ? `${year}-${month}-${day}` : undefined;
};

const normalizeDateOnly = (value: string): string => {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? value : (formatDateOnlyParts(parsed) ?? value);
};

const resolveAdvanceStrategy = (
  recurrence: WasteTourRecord['recurrence'],
  customRecurrenceIntervalDays?: number
) => {
  if (typeof customRecurrenceIntervalDays === 'number' && customRecurrenceIntervalDays > 0) {
    return (current: Date) => current.setUTCDate(current.getUTCDate() + customRecurrenceIntervalDays);
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
): Map<string, string> => new Map(shifts.map((shift) => [shift.originalDate, shift.actualDate] as const));

type HolidayRuleDirection = 'advance' | 'postpone';
type HolidayRuleCoverage = 'single_pickup' | 'rest_of_week';

const addDays = (value: string, days: number): string | undefined => {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const addDaysWithWeekendClampForAdvance = (value: string, days: number): string | undefined => {
  const shifted = addDays(value, days);
  if (!shifted || days >= 0) {
    return shifted;
  }

  const parsed = new Date(`${shifted}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return shifted;
  }

  return parsed.getUTCDay() === 0 ? addDays(shifted, -1) : shifted;
};

const getWeekStartIso = (value: string): string | undefined => {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  const weekday = parsed.getUTCDay();
  const mondayShift = weekday === 0 ? -6 : 1 - weekday;
  parsed.setUTCDate(parsed.getUTCDate() + mondayShift);
  return parsed.toISOString().slice(0, 10);
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

  const parsedDate = new Date(`${date}T00:00:00Z`);
  const parsedTrigger = new Date(`${rule.triggerDate}T00:00:00Z`);
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

type TourOccurrenceEntryInternal = Readonly<{
  readonly date: string;
  readonly shifted: boolean;
  readonly originalDate: string | null;
  readonly shiftedByHoliday: boolean;
}>;

const calculateTourOccurrenceEntriesForYearInternal = (
  tour: WasteTourRecord,
  year: number,
  scheduling: WasteManagementSchedulingOverview
): readonly TourOccurrenceEntryInternal[] => {
  const results = new Set<string>();
  collectScheduledTourDates(results, tour, year);
  collectCustomTourDates(results, tour, year);

  const tourShiftMap = buildShiftMap(
    (scheduling.tourDateShifts ?? []).filter((shift) => shift.tourId === tour.id)
  );
  const globalShiftMap = buildShiftMap(
    (scheduling.globalDateShifts ?? []).filter((shift) => !shift.tourIds || shift.tourIds.includes(tour.id))
  );
  const holidayRules = (scheduling.holidayRules ?? [])
    .map((rule) => ({
      ...rule,
      holidayDate: normalizeDateOnly(rule.holidayDate),
    }))
    .filter((rule) => rule.holidayDate.startsWith(`${year}-`) && rule.scope && rule.strategy)
    .map((rule) => ({
      triggerDate: rule.holidayDate,
      direction: rule.strategy === 'advance' ? 'advance' : rule.strategy === 'postpone' ? 'postpone' : null,
      coverage: rule.scope === 'full-week' ? 'rest_of_week' : 'single_pickup',
    }))
    .filter(
      (rule): rule is {
        readonly triggerDate: string;
        readonly direction: HolidayRuleDirection;
        readonly coverage: HolidayRuleCoverage;
      } => rule.direction !== null
    );

  const shiftedResults = new Map<
    string,
    {
      readonly shifted: boolean;
      readonly originalDate: string | null;
      readonly shiftedByHoliday: boolean;
    }
  >();
  for (const date of results) {
    const manuallyShifted = tourShiftMap.get(date) ?? globalShiftMap.get(date) ?? date;
    let shiftedByHoliday = false;
    const holidayShifted = holidayRules.reduce((currentDate, rule) => {
      const nextDate = applyHolidayRule(currentDate, rule);
      if (nextDate !== currentDate) {
        shiftedByHoliday = true;
      }
      return nextDate;
    }, manuallyShifted);
    const shifted = holidayShifted !== date;
    const previous = shiftedResults.get(holidayShifted);
    shiftedResults.set(holidayShifted, {
      shifted: previous?.shifted === true || shifted,
      originalDate: previous?.originalDate ?? (shifted ? date : null),
      shiftedByHoliday: previous?.shiftedByHoliday === true || shiftedByHoliday,
    });
  }

  return Array.from(shiftedResults.entries())
    .filter(([date]) => date.startsWith(`${year}-`))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, entry]) => ({
      date,
      shifted: entry.shifted,
      originalDate: entry.originalDate,
      shiftedByHoliday: entry.shiftedByHoliday,
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
  calculateTourOccurrenceEntriesForYearInternal(tour, year, scheduling).map(({ date, shifted, originalDate }) => ({
    date,
    shifted,
    originalDate,
  }));

export const countHolidayShiftedTourOccurrences = (
  tour: WasteTourRecord,
  scheduling: WasteManagementSchedulingOverview
): number => {
  const holidayYears = Array.from(
    new Set(
      (scheduling.holidayRules ?? [])
        .map((rule) => normalizeDateOnly(rule.holidayDate))
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
        .map((value) => Number(value.slice(0, 4)))
        .filter((value) => Number.isInteger(value))
    )
  );

  return holidayYears.reduce(
    (sum, year) =>
      sum +
      calculateTourOccurrenceEntriesForYearInternal(tour, year, scheduling).filter((entry) => entry.shiftedByHoliday).length,
    0
  );
};
