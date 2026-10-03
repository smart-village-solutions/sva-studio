import type { WasteHolidayRuleRecord } from '@sva/waste-management-contracts';
import {
  formatDateOnlyUtc,
  normalizeDateOnly,
  parseDateOnlyUtc,
} from './public-waste-date-utils.js';

export type HolidayRuleDirection = 'advance' | 'postpone';
export type HolidayRuleCoverage = 'single_pickup' | 'rest_of_week';

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
