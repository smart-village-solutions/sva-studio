export const normalizeDateOnly = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
};

export const parseDateOnlyUtc = (value: string): Date => new Date(`${value}T00:00:00Z`);

export const formatDateOnlyUtc = (value: Date): string => value.toISOString().slice(0, 10);

export const addYearsUtc = (value: string, years: number): string => {
  const date = parseDateOnlyUtc(value);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return formatDateOnlyUtc(date);
};

export const isDateWithinRange = (date: string, startDate: string, endDate: string): boolean =>
  date >= startDate && date <= endDate;

export const createDateAdvanceStrategy = (
  recurrence: 'weekly' | 'biweekly' | 'fourweekly' | 'yearly' | 'on-demand' | 'custom' | null | undefined,
  customRecurrenceIntervalDays?: number
): ((current: Date) => void) | null => {
  if (typeof customRecurrenceIntervalDays === 'number' && customRecurrenceIntervalDays > 0) {
    return (current) => current.setUTCDate(current.getUTCDate() + customRecurrenceIntervalDays);
  }
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
