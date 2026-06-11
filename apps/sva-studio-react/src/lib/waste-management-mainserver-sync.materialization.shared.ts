import type {
  WasteTourDateShiftFollowUpMode,
  WasteTourDateShiftRecord,
  WasteTourRecord,
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
  WasteLocationTourLinkRecord,
} from '@sva/core';

export type MaterializationRuleCoverage = 'single_pickup' | 'rest_of_week';
export type MaterializationRuleDirection = 'advance' | 'postpone';
export type MaterializationRuleSource = 'tour' | 'global' | 'holiday';

export type MaterializationRule = {
  readonly source: MaterializationRuleSource;
  readonly appliesToTourId?: string;
  readonly appliesToTourIds?: readonly string[];
  readonly triggerDate: string;
  readonly shiftDays: number;
  readonly direction: MaterializationRuleDirection;
  readonly coverage: MaterializationRuleCoverage;
  readonly hasYear: boolean;
};

const MATERIALIZATION_YEAR_OFFSET = 1;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export type WasteMaterializationContext = {
  readonly tours: readonly WasteTourRecord[];
  readonly links: readonly WasteLocationTourLinkRecord[];
  readonly tourDateShifts: readonly WasteTourDateShiftRecord[];
  readonly globalDateShifts: readonly WasteGlobalDateShiftRecord[];
  readonly holidayRules: readonly WasteHolidayRuleRecord[];
  readonly currentYear: number;
  readonly nextYear: number;
};

export const parseIsoDateUtc = (value: string): Date | undefined => {
  if (!isoDatePattern.test(value)) {
    return undefined;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

export const addDays = (value: string, days: number): string | undefined => {
  const date = parseIsoDateUtc(value);
  if (!date) {
    return undefined;
  }
  const shiftedDate = new Date(date);
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + days);
  return Number.isNaN(shiftedDate.getTime()) ? undefined : toIsoDate(shiftedDate);
};

export const addDaysWithWeekendClampForAdvance = (value: string, shiftDays: number): string | undefined => {
  const shiftedDate = addDays(value, shiftDays);
  if (!shiftedDate) {
    return undefined;
  }
  if (shiftDays >= 0) {
    return shiftedDate;
  }
  const date = parseIsoDateUtc(shiftedDate);
  if (!date) {
    return shiftedDate;
  }

  // Historical business behavior: if an advance move would land on Sunday, use Saturday.
  if (date.getUTCDay() === 0) {
    return addDays(shiftedDate, -1);
  }

  return shiftedDate;
};

export const shiftDirection = (
  originalDate: string,
  actualDate: string
): { readonly direction: MaterializationRuleDirection; readonly shiftDays: number } | undefined => {
  const original = parseIsoDateUtc(originalDate);
  const actual = parseIsoDateUtc(actualDate);
  if (!original || !actual) {
    return undefined;
  }
  const dayDistance = Math.round((actual.getTime() - original.getTime()) / (24 * 60 * 60 * 1000));
  if (!Number.isFinite(dayDistance) || dayDistance === 0) {
    return undefined;
  }

  return {
    direction: dayDistance > 0 ? 'postpone' : 'advance',
    shiftDays: Math.abs(dayDistance),
  };
};

export const toCoverage = (
  followUpMode: WasteTourDateShiftFollowUpMode | undefined
): MaterializationRuleCoverage => (followUpMode === 'propagate-series' ? 'rest_of_week' : 'single_pickup');

export const toDirectionFromHolidayStrategy = (
  strategy: string | undefined
): MaterializationRuleDirection | undefined => {
  if (strategy === 'advance') {
    return 'advance';
  }
  if (strategy === 'postpone') {
    return 'postpone';
  }
  return undefined;
};

const resolveAdvanceDays = (
  recurrence: WasteTourRecord['recurrence'],
  customRecurrenceIntervalDays: number | undefined
): number | null => {
  if (recurrence === 'weekly') {
    return 7;
  }
  if (recurrence === 'biweekly') {
    return 14;
  }
  if (recurrence === 'fourweekly') {
    return 28;
  }
  if (recurrence === 'yearly') {
    return 365;
  }
  if (recurrence === 'custom' && typeof customRecurrenceIntervalDays === 'number' && customRecurrenceIntervalDays > 0) {
    return customRecurrenceIntervalDays;
  }
  return null;
};

export const getEffectiveYearWindow = (currentYear: number, nextYear: number): readonly number[] => {
  const normalizedCurrentYear = Number.isInteger(currentYear) ? currentYear : new Date().getUTCFullYear();
  const normalizedNextYear = Number.isInteger(nextYear)
    ? nextYear
    : normalizedCurrentYear + MATERIALIZATION_YEAR_OFFSET;
  return [normalizedCurrentYear, normalizedNextYear];
};

export const isAllowedByRuleYear = (
  ruleDate: string,
  hasYear: boolean,
  yearWindow: readonly number[]
): boolean => {
  if (!hasYear) {
    return true;
  }
  const parsed = parseIsoDateUtc(ruleDate);
  if (!parsed) {
    return false;
  }
  return yearWindow.includes(parsed.getUTCFullYear());
};

export const collectRecurrenceDates = (
  tour: WasteTourRecord,
  yearWindow: readonly number[]
): readonly string[] => {
  const yearSet = new Set(yearWindow);
  const endOfWindow = new Date(`${Math.max(...yearWindow)}-12-31T00:00:00.000Z`);
  const dates = new Set<string>();

  for (const entry of tour.customDates ?? []) {
    if (!isoDatePattern.test(entry.date)) {
      continue;
    }
    const parsed = parseIsoDateUtc(entry.date);
    if (!parsed) {
      continue;
    }
    if (yearSet.has(parsed.getUTCFullYear())) {
      dates.add(entry.date);
    }
  }

  if (!tour.recurrence || tour.recurrence === 'on-demand') {
    return [...dates];
  }

  const step = resolveAdvanceDays(tour.recurrence, tour.customRecurrenceIntervalDays);
  if (step === null) {
    return [...dates];
  }

  const startDate = parseIsoDateUtc(tour.firstDate ?? '');
  if (!startDate) {
    return [...dates];
  }

  const tourEndDate = tour.endDate ? parseIsoDateUtc(tour.endDate) : null;
  const maxEndDate = tourEndDate && tourEndDate < endOfWindow ? tourEndDate : endOfWindow;

  let current = new Date(startDate);
  while (current <= maxEndDate) {
    const entry = toIsoDate(current);
    if (yearSet.has(current.getUTCFullYear())) {
      dates.add(entry);
    }
    current = new Date(current);
    current.setUTCDate(current.getUTCDate() + step);
  }

  return [...dates];
};

export const isDateInRange = (
  date: string,
  startDate: string | undefined,
  endDate: string | undefined
): boolean => {
  const normalized = parseIsoDateUtc(date);
  if (!normalized) {
    return false;
  }

  const start = startDate ? parseIsoDateUtc(startDate) : null;
  if (start && normalized < start) {
    return false;
  }

  const end = endDate ? parseIsoDateUtc(endDate) : null;
  if (end && normalized > end) {
    return false;
  }

  return true;
};

const getWeekStartIso = (value: string): string | undefined => {
  const date = parseIsoDateUtc(value);
  if (!date) {
    return undefined;
  }
  const weekday = date.getUTCDay();
  const mondayShift = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() + mondayShift);
  return toIsoDate(monday);
};

const isSameWeek = (left: string, right: string): boolean => getWeekStartIso(left) === getWeekStartIso(right);

export const isDateAffectedByRule = (
  date: string,
  rule: Readonly<{
    readonly triggerDate: string;
    readonly direction: MaterializationRuleDirection;
    readonly coverage: MaterializationRuleCoverage;
    readonly shiftDays: number;
  }>
): boolean => {
  if (rule.coverage === 'single_pickup') {
    return date === rule.triggerDate;
  }

  if (rule.shiftDays === 0 || !isSameWeek(date, rule.triggerDate)) {
    return false;
  }

  const parsedDate = parseIsoDateUtc(date);
  const parsedTrigger = parseIsoDateUtc(rule.triggerDate);
  if (!parsedDate || !parsedTrigger) {
    return false;
  }

  const dateWeekday = parsedDate.getUTCDay();
  const triggerWeekday = parsedTrigger.getUTCDay();

  return rule.direction === 'postpone'
    ? dateWeekday >= triggerWeekday
    : dateWeekday <= triggerWeekday;
};
