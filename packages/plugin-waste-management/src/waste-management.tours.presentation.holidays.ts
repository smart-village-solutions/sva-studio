import type { WasteManagementSchedulingOverview } from './waste-management.api.js';

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

export const normalizeDateOnly = (value: string): string => {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? value : (formatDateOnlyParts(parsed) ?? value);
};

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

export const applyHolidayRule = (
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

export const resolveHolidayRulesForYear = (
  scheduling: WasteManagementSchedulingOverview,
  year: number
) =>
  (scheduling.holidayRules ?? [])
    .map((rule) => ({ ...rule, holidayDate: normalizeDateOnly(rule.holidayDate) }))
    .filter((rule) => rule.holidayDate.startsWith(`${year}-`) && rule.scope && rule.strategy)
    .map((rule) => ({
      triggerDate: rule.holidayDate,
      holidayName: rule.holidayName,
      direction:
        rule.strategy === 'advance' ? 'advance' : rule.strategy === 'postpone' ? 'postpone' : null,
      coverage: rule.scope === 'full-week' ? 'rest_of_week' : 'single_pickup',
    }))
    .filter(
      (
        rule
      ): rule is {
        readonly triggerDate: string;
        readonly holidayName: string;
        readonly direction: HolidayRuleDirection;
        readonly coverage: HolidayRuleCoverage;
      } => rule.direction !== null
    );
