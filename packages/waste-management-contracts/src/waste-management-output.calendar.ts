import type { WasteCalendarPdfHoliday } from './waste-management-output.messages.js';

export const normalizeWeekday = (utcDay: number): number => (utcDay === 0 ? 6 : utcDay - 1);

export const formatIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

export const getIsoWeekNumber = (date: Date): number => {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

const computeEasterSunday = (year: number): Date => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
};

const addUtcDays = (value: Date, days: number): Date => {
  const copy = new Date(value.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

export const buildHolidayMap = (year: number): ReadonlyMap<string, WasteCalendarPdfHoliday> => {
  const easterSunday = computeEasterSunday(year);
  return new Map<string, WasteCalendarPdfHoliday>([
    [`${year}-01-01`, 'newYear'],
    [formatIsoDate(addUtcDays(easterSunday, -2)), 'goodFriday'],
    [formatIsoDate(addUtcDays(easterSunday, 1)), 'easterMonday'],
    [`${year}-05-01`, 'labourDay'],
    [formatIsoDate(addUtcDays(easterSunday, 39)), 'ascension'],
    [formatIsoDate(addUtcDays(easterSunday, 50)), 'whitMonday'],
    [`${year}-10-03`, 'germanUnity'],
    [`${year}-12-25`, 'christmasDay'],
    [`${year}-12-26`, 'secondChristmasDay'],
  ]);
};
