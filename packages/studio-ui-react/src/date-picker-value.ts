import { UTCDate } from '@date-fns/utc';
import { formatCalendarDate, toDatetimeLocalValue } from '@sva/plugin-sdk/temporal';
import { isValid, parseISO } from 'date-fns';

export type DatePickerLocale = 'de-DE' | 'en-GB' | 'en-US';
export type DatePickerError = 'invalid' | 'required' | 'min' | 'max';

const formats = {
  'de-DE': { input: /^\d{1,2}\.\d{1,2}\.\d{4}$/ },
  'en-GB': { input: /^\d{1,2}\/\d{1,2}\/\d{4}$/ },
  'en-US': { input: /^\d{1,2}\/\d{1,2}\/\d{4}$/ },
} as const;
const isoPattern = /^\d{4}-\d{2}-\d{2}$/;

export const parseDatePickerValue = (value: string): Date | undefined => {
  if (!isoPattern.test(value)) return undefined;
  const date = new UTCDate(parseISO(`${value}T00:00:00Z`));
  return isValid(date) ? date : undefined;
};

export const toDatePickerValue = (date: Date): string => date.toISOString().slice(0, 10);

export const initialDatePickerMonth = (
  selected: Date | undefined,
  min?: string,
  max?: string
): Date => {
  const date =
    selected ??
    new UTCDate(
      parseISO(`${toDatetimeLocalValue(new Date().toISOString()).slice(0, 10)}T00:00:00Z`)
    );
  const minimum = min ? parseDatePickerValue(min) : undefined;
  const maximum = max ? parseDatePickerValue(max) : undefined;
  if (minimum && date < minimum) return minimum;
  if (maximum && date > maximum) return maximum;
  return date;
};

export const formatDatePickerValue = (value: string | null, locale: DatePickerLocale): string => {
  const date = value ? parseDatePickerValue(value) : undefined;
  return date ? (formatCalendarDate(value ?? undefined, locale) ?? '') : '';
};

export const readDatePickerInput = (
  input: string,
  locale: DatePickerLocale,
  constraints: Readonly<{ required?: boolean; min?: string; max?: string }> = {}
): Readonly<{ value: string | null; error: DatePickerError | null }> => {
  const text = input.trim();
  if (!text) return { value: null, error: constraints.required ? 'required' : null };
  const local = formats[locale];
  let normalized = text;
  if (!isoPattern.test(text)) {
    if (!local.input.test(text)) return { value: null, error: 'invalid' };
    const [first, second, year] = text.split(/[./]/);
    const [day, month] = locale === 'en-US' ? [second!, first!] : [first!, second!];
    normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const date = parseDatePickerValue(normalized);
  if (!date || !isValid(date)) return { value: null, error: 'invalid' };
  const value = toDatePickerValue(date);
  if (constraints.min && value < constraints.min) return { value: null, error: 'min' };
  if (constraints.max && value > constraints.max) return { value: null, error: 'max' };
  return { value, error: null };
};
